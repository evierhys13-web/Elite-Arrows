import { useMemo, useState } from 'react'
import { db, doc, setDoc, deleteDoc } from '../firebase'

const norm = (s) => String(s || '').toLowerCase().trim()

const STYLE_PLAYED = { background: 'rgba(76, 175, 80, 0.15)', color: '#81c784', borderColor: 'rgba(76, 175, 80, 0.4)' }
const STYLE_WARN = { background: 'rgba(255, 193, 7, 0.15)', color: '#ffd54f', borderColor: 'rgba(255, 193, 7, 0.45)' }

export default function FixtureTracker({
  user,
  allPlayers,
  allFixtures,
  allResults,
  adminData,
  updateFixtures,
  notifyUser,
  triggerDataRefresh,
  showToast,
  onReviewResults,
  onOpenSubmitResult
}) {
  const [divisionFilter, setDivisionFilter] = useState('all')
  const [view, setView] = useState('toplay')
  const [setDateFor, setSetDateFor] = useState(null)
  const [dateVal, setDateVal] = useState('')
  const [timeVal, setTimeVal] = useState('')
  const [forfeitFor, setForfeitFor] = useState(null)
  const [winner, setWinner] = useState('')
  const [busyId, setBusyId] = useState('')

  const currentSeason = adminData?.currentSeason || ''

  const logAudit = async (action, details) => {
    try {
      await setDoc(doc(db, 'auditLogs', `fix_${Date.now()}_${Math.floor(Math.random() * 10000)}`), {
        adminId: user?.id || 'unknown',
        adminName: user?.username || 'unknown',
        action,
        details,
        timestamp: new Date().toISOString()
      })
    } catch (e) { console.error('Audit log failed', e) }
  }

  const findUser = (idOrName) => {
    const s = String(idOrName || '')
    if (!s) return null
    return allPlayers.find(u =>
      String(u.id) === s ||
      (u.username && norm(u.username) === norm(s)) ||
      (u.nickname && norm(u.nickname) === norm(s))
    ) || null
  }

  const resultForFixture = (fixture) => {
    const hit = allResults.find(r => r.fixtureId && String(r.fixtureId) === String(fixture.id))
    if (hit) return hit
    const p1 = fixture.p1.id
    const p2 = fixture.p2.id
    return allResults.find(r =>
      norm(r.status) === 'approved' &&
      !r.cupId &&
      String(r.gameType || '').toLowerCase().includes('league') &&
      (
        (String(r.player1Id) === String(p1) && String(r.player2Id) === String(p2)) ||
        (String(r.player1Id) === String(p2) && String(r.player2Id) === String(p1))
      ) &&
      (!fixture.season || !r.season || String(r.season) === String(fixture.season))
    ) || null
  }

  const fixtures = useMemo(() => {
    const isLeagueFixture = (f) => {
      const gt = norm(f.gameType)
      if (f.cupId) return false
      if (gt && gt !== 'league') return false
      if (f.season && String(f.season) !== String(currentSeason)) return false
      return true
    }
    return allFixtures
      .filter(f => !f._deleted && isLeagueFixture(f))
      .map(f => {
        const p1 = findUser(f.player1Id || f.player1)
        const p2 = findUser(f.player2Id || f.player2)
        if (!p1 || !p2) return null
        return {
          id: f.id,
          raw: f,
          p1,
          p2,
          competition: 'League',
          season: currentSeason,
          division: f.division && f.division !== 'Unassigned' ? f.division : (p1.division && p1.division !== 'Unassigned' ? p1.division : (p2.division || 'Unassigned')),
          status: norm(f.status) || 'pending',
          createdAt: f.createdAt,
          scheduledDate: f.fixtureDate || '',
          scheduledTime: f.fixtureTime || '',
          proposedDate: f.proposedDate || '',
          counterDate: f.counterDate || ''
        }
      })
      .filter(Boolean)
  }, [allFixtures, allPlayers, currentSeason, allResults])

  const isOverdue = (f) => {
    if (!f.scheduledDate) return false
    const d = new Date(`${f.scheduledDate}T23:59:59`)
    if (isNaN(d.getTime())) return false
    return d.getTime() < Date.now()
  }

  const enriched = useMemo(() => {
    return fixtures.map(f => {
      const result = resultForFixture(f)
      const resultStatus = result ? norm(result.status) : ''
      const played = ['approved', 'completed'].includes(f.status) || resultStatus === 'approved'
      const awaiting = f.status === 'result_submitted' || (result && !['approved', 'rejected'].includes(resultStatus))
      return { f, result, played: played || awaiting, awaiting, overdue: !played && !awaiting && isOverdue(f) }
    })
  }, [fixtures, allResults])

  const divisions = useMemo(() => {
    const set = new Set()
    allPlayers.forEach(u => { if (u.division && u.division !== 'Unassigned') set.add(u.division) })
    fixtures.forEach(f => { if (f.division && f.division !== 'Unassigned') set.add(f.division) })
    return Array.from(set).sort()
  }, [allPlayers, fixtures])

  const toPlay = useMemo(() => {
    return enriched
      .filter(e => !e.played)
      .filter(e => divisionFilter === 'all' || e.f.division === divisionFilter)
      .sort((a, b) => {
        const so = (e) => e.overdue ? 0 : (e.f.scheduledDate ? 1 : 2)
        return so(a) - so(b) || String(a.f.scheduledDate || '').localeCompare(String(b.f.scheduledDate || ''))
      })
  }, [enriched, divisionFilter])

  const played = useMemo(() => {
    return enriched
      .filter(e => e.played)
      .filter(e => divisionFilter === 'all' || e.f.division === divisionFilter)
      .sort((a, b) => String(b.result?.date || b.result?.approvedAt || '').localeCompare(String(a.result?.date || a.result?.approvedAt || '')))
  }, [enriched, divisionFilter])

  const groupByDivision = (list) => {
    const groups = []
    list.forEach(e => {
      let g = groups.find(x => x.division === e.f.division)
      if (!g) { g = { division: e.f.division, rows: [] }; groups.push(g) }
      g.rows.push(e)
    })
    return groups
  }

  const updateFixture = async (fixture, updates) => {
    const updatedFixture = { ...fixture.raw, ...updates, updatedAt: new Date().toISOString() }
    await setDoc(doc(db, 'fixtures', String(fixture.id)), updatedFixture, { merge: true })
    const list = [...allFixtures]
    const idx = list.findIndex(x => String(x.id) === String(fixture.id))
    if (idx !== -1) list[idx] = updatedFixture
    else list.push(updatedFixture)
    updateFixtures(list)
    return updatedFixture
  }

  const handleRemind = async (fixture) => {
    if (busyId) return
    setBusyId(`r_${fixture.id}`)
    try {
      const dateTxt = fixture.scheduledDate ? ` on ${fixture.scheduledDate}` : (fixture.proposedDate ? ` (proposed: ${fixture.proposedDate})` : '')
      const msg = `Your League match vs ` + `{opp}` + ` is due${dateTxt}. Arrange a time to play!`
      await notifyUser(fixture.p1.id, 'Fixture Reminder', msg.replace('{opp}', fixture.p2.username), 'fixture_reminder', { fixtureId: fixture.id })
      await notifyUser(fixture.p2.id, 'Fixture Reminder', msg.replace('{opp}', fixture.p1.username), 'fixture_reminder', { fixtureId: fixture.id })
      await logAudit('FIXTURE_REMIND', `Reminded ${fixture.p1.username} & ${fixture.p2.username} re: League fixture (${fixture.id})`)
      showToast('Reminder sent to both players', 'success')
    } catch (e) { showToast('Remind failed: ' + e.message, 'error') }
    setBusyId('')
  }

  const handleSetDate = async () => {
    if (!setDateFor) return
    if (!dateVal) return showToast('Pick an agreed date', 'error')
    if (busyId) return
    setBusyId(`d_${setDateFor.id}`)
    try {
      await updateFixture(setDateFor, { status: 'accepted', fixtureDate: dateVal, fixtureTime: timeVal || '', acceptedBy: user?.username || 'admin', acceptedAt: new Date().toISOString() })
      await logAudit('FIXTURE_DATE', `Admin set date ${dateVal}${timeVal ? ' ' + timeVal : ''} for ${setDateFor.p1.username} vs ${setDateFor.p2.username}`)
      showToast('Fixture date set', 'success')
      setSetDateFor(null); setDateVal(''); setTimeVal('')
    } catch (e) { showToast('Failed: ' + e.message, 'error') }
    setBusyId('')
  }

  const handleApplyForfeit = async () => {
    if (!forfeitFor) return
    if (!winner) return showToast('Select the forfeit winner', 'error')
    if (busyId) return
    setBusyId(`f_${forfeitFor.id}`)
    const fixture = forfeitFor
    const winIsP1 = String(winner) === String(fixture.p1.id)
    const winnerP = winIsP1 ? fixture.p1 : fixture.p2
    const loserP = winIsP1 ? fixture.p2 : fixture.p1
    const resultId = `admin_${Date.now()}`
    try {
      const newMatch = {
        id: resultId,
        player1: fixture.p1.username,
        player1Id: fixture.p1.id,
        player2: fixture.p2.username,
        player2Id: fixture.p2.id,
        score1: winIsP1 ? 1 : 0,
        score2: winIsP1 ? 0 : 1,
        gameType: 'League',
        status: 'approved',
        season: fixture.season || currentSeason,
        division: fixture.p1.division || '',
        date: new Date().toISOString().split('T')[0],
        submittedAt: new Date().toISOString(),
        submittedBy: 'admin',
        forfeit: true,
        forfeitWinner: winnerP.id,
        forfeitNote: `${winnerP.username} wins by forfeit`,
        player1Stats: {},
        player2Stats: {}
      }
      await setDoc(doc(db, 'results', resultId), newMatch)
      await updateFixture(fixture, { status: 'approved', resultId, score1: newMatch.score1, score2: newMatch.score2 })
      await logAudit('FIXTURE_FORFEIT', `Forfeit: ${winnerP.username} def ${loserP.username} (League)`)
      triggerDataRefresh('all')
      showToast(`${winnerP.username} wins by forfeit - 3 points awarded`, 'success')
      setForfeitFor(null); setWinner('')
    } catch (e) { showToast('Forfeit failed: ' + e.message, 'error') }
    setBusyId('')
  }

  const handleRemove = async (fixture) => {
    if (!window.confirm(`Delete this League fixture between ${fixture.p1.username} and ${fixture.p2.username}?`)) return
    if (busyId) return
    setBusyId(`x_${fixture.id}`)
    try {
      await deleteDoc(doc(db, 'fixtures', String(fixture.id)))
      updateFixtures(allFixtures.filter(x => String(x.id) !== String(fixture.id)))
      await logAudit('FIXTURE_DELETE', `Deleted League fixture: ${fixture.p1.username} vs ${fixture.p2.username}`)
      showToast('Fixture deleted', 'success')
    } catch (e) { showToast('Delete failed: ' + e.message, 'error') }
    setBusyId('')
  }

  const coverage = useMemo(() => {
    return divisions.map(div => {
      const roster = allPlayers.filter(u => u.division === div)
      const rows = roster.map(u => {
        const resultsFor = allResults.filter(r =>
          norm(r.status) === 'approved' &&
          !r.cupId &&
          String(r.gameType || '').toLowerCase().includes('league') &&
          (!currentSeason || !r.season || String(r.season) === String(currentSeason)) &&
          (String(r.player1Id) === String(u.id) || String(r.player2Id) === String(u.id))
        )
        const opponentsPlayed = new Set(resultsFor.map(r => String(r.player1Id) === String(u.id) ? r.player2Id : r.player1Id))
        const remaining = Math.max(0, roster.length - 1 - opponentsPlayed.size)
        return { user: u, played: resultsFor.length, remaining }
      })
      return { div, rows }
    })
  }, [divisions, allPlayers, allResults, currentSeason])

  const actionBtn = (onClick, label, variant = 'btn-secondary', busy = false) => (
    <button
      className={`btn ${variant} btn-sm`}
      onClick={onClick}
      disabled={!!busyId}
      style={{ whiteSpace: 'nowrap', opacity: busyId ? 0.5 : 1 }}
    >
      {busy ? '...' : label}
    </button>
  )

  const badge = (style, text) => (
    <span className="btn btn-sm" style={{ ...style, border: '1px solid', cursor: 'default', padding: '4px 10px', fontSize: 11, whiteSpace: 'nowrap' }}>
      {text}
    </span>
  )

  const toggleCard = (active, count, label, sub, onClick) => (
    <button
      onClick={onClick}
      className="glass"
      style={{
        padding: '18px',
        borderRadius: '12px',
        textAlign: 'center',
        cursor: 'pointer',
        border: active ? '2px solid var(--accent-cyan)' : '2px solid transparent',
        opacity: active ? 1 : 0.55,
        transition: 'opacity 0.15s ease'
      }}
    >
      <div style={{ fontSize: 34, fontWeight: 800 }}>{count}</div>
      <div style={{ fontWeight: 700, marginTop: '2px' }}>{label}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sub}</div>
    </button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="glass" style={{ padding: '16px', borderRadius: '12px' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent-cyan)', marginBottom: '4px' }}>
          {currentSeason ? `Live Season: ${currentSeason}` : 'Live Season'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: '12px' }}>League fixtures only · click To Play / Played to switch the list</div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button className={`btn btn-sm ${divisionFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setDivisionFilter('all')}>All Divisions</button>
          {divisions.map(d => (
            <button key={d} className={`btn btn-sm ${divisionFilter === d ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setDivisionFilter(d)}>{d}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
        {toggleCard(view === 'toplay', toPlay.length, 'To Play', 'Remaining games', () => setView('toplay'))}
        {toggleCard(view === 'played', played.length, 'Played', 'Completed games', () => setView('played'))}
      </div>

      {view === 'toplay' ? (
        <div className="glass" style={{ padding: '16px', borderRadius: '12px' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Remaining Games ({toPlay.length})</h3>
          {toPlay.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px' }}>No games left to play. All fixtures for this season are complete!</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {groupByDivision(toPlay).map(g => (
                <div key={g.division}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent-cyan)', marginBottom: '8px' }}>{g.division} · {g.rows.length} to play</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {g.rows.map(({ f, overdue }) => {
                      const dateTxt = f.scheduledDate ? `${f.scheduledDate}${f.scheduledTime ? ' ' + f.scheduledTime : ''}` : (f.counterDate || f.proposedDate || '')
                      return (
                        <div key={f.id} className="glass" style={{ padding: '12px', borderRadius: '10px', border: overdue ? '1px solid rgba(229, 115, 115, 0.5)' : '1px solid transparent' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            <div style={{ minWidth: '180px' }}>
                              <strong>{f.p1.username}</strong> vs <strong>{f.p2.username}</strong>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: '140px' }}>
                              {dateTxt ? <>📅 {dateTxt}</> : <span style={{ color: '#aaa' }}>no date yet</span>}
                              {overdue && <div style={{ color: '#e57373', fontWeight: 700 }}>⚠ Overdue</div>}
                            </div>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                              {actionBtn(() => handleRemind(f), 'Remind', 'btn-secondary', busyId === `r_${f.id}`)}
                              {actionBtn(() => { setSetDateFor(f); setDateVal(f.scheduledDate || ''); setTimeVal(f.scheduledTime || '') }, 'Set Date', 'btn-secondary', busyId === `d_${f.id}`)}
                              {actionBtn(() => { setForfeitFor(f); setWinner('') }, 'Forfeit', 'btn-danger', busyId === `f_${f.id}`)}
                              {onOpenSubmitResult && actionBtn(() => onOpenSubmitResult(f), 'Result', 'btn-secondary', busyId === `o_${f.id}`)}
                              {actionBtn(() => handleRemove(f), 'Delete', 'btn-secondary', busyId === `x_${f.id}`)}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="glass" style={{ padding: '16px', borderRadius: '12px' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Games Played ({played.length})</h3>
          {played.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px' }}>No played games for this season yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {groupByDivision(played).map(g => (
                <div key={g.division}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#81c784', marginBottom: '8px' }}>{g.division} · {g.rows.length} played</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {g.rows.map(({ f, result, awaiting }) => {
                      const scoreTxt = result ? `${result.score1} - ${result.score2}` : '—'
                      const dateTxt = result?.date || result?.approvedAt?.split('T')[0] || f.scheduledDate || '—'
                      return (
                        <div key={f.id} className="glass" style={{ padding: '12px', borderRadius: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            <div style={{ minWidth: '180px' }}>
                              <strong>{result?.player1 || f.p1.username}</strong> vs <strong>{result?.player2 || f.p2.username}</strong>
                              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>📅 {dateTxt}{result?.forfeit ? ' · ⚖ Forfeit' : ''}</div>
                            </div>
                            <div style={{ fontSize: 18, fontWeight: 800, minWidth: '60px', textAlign: 'center' }}>{scoreTxt}</div>
                            {awaiting ? badge(STYLE_WARN, 'Awaiting approval') : badge(STYLE_PLAYED, 'Played')}
                            {awaiting && onReviewResults && actionBtn(() => onReviewResults(), 'Review', 'btn-primary', busyId === `v_${f.id}`)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {coverage.filter(c => divisionFilter === 'all' || c.div === divisionFilter).map(({ div, rows }) => (
        <div className="glass" key={div} style={{ padding: '16px', borderRadius: '12px' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>{div} · Games Left per Player</h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr><th>Player</th><th>Played</th><th>Remaining</th></tr>
              </thead>
              <tbody>
                {rows.map(({ user: u, played, remaining }) => (
                  <tr key={u.id}>
                    <td style={{ padding: '8px' }}>{u.username}</td>
                    <td style={{ padding: '8px' }}>{played}</td>
                    <td style={{ padding: '8px', color: remaining > 0 ? '#ffb14e' : '#81c784' }}>{remaining}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {setDateFor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="glass" style={{ padding: '20px', borderRadius: '14px', width: '100%', maxWidth: '360px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Set Fixture Date</h3>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: '12px' }}>{setDateFor.p1.username} vs {setDateFor.p2.username}</div>
            <div className="form-group"><label>Date</label><input type="date" value={dateVal} onChange={e => setDateVal(e.target.value)} /></div>
            <div className="form-group"><label>Time (optional)</label><input type="time" value={timeVal} onChange={e => setTimeVal(e.target.value)} /></div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => { setSetDateFor(null); setDateVal(''); setTimeVal('') }}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleSetDate} disabled={!dateVal}>{busyId ? '...' : 'Save Date'}</button>
            </div>
          </div>
        </div>
      )}

      {forfeitFor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="glass" style={{ padding: '20px', borderRadius: '14px', width: '100%', maxWidth: '380px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Apply Forfeit</h3>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: '12px' }}>{forfeitFor.p1.username} vs {forfeitFor.p2.username} · winner gets 3 points</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[forfeitFor.p1, forfeitFor.p2].map(u => (
                <button
                  key={u.id}
                  className={`btn btn-sm ${String(winner) === String(u.id) ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setWinner(u.id)}
                >
                  {u.username}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => { setForfeitFor(null); setWinner('') }}>Cancel</button>
              <button className="btn btn-danger btn-sm" onClick={handleApplyForfeit} disabled={!winner}>{busyId ? '...' : 'Confirm Forfeit'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}