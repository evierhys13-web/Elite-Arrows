import { useMemo, useState } from 'react'
import { db, doc, setDoc, deleteDoc } from '../firebase'

const norm = (s) => String(s || '').toLowerCase().trim()

const SEASON_START = new Date('2026-09-01T00:00:00').getTime()

const STYLE_PLAYED = { background: 'rgba(76, 175, 80, 0.15)', color: '#81c784', borderColor: 'rgba(76, 175, 80, 0.4)' }
const STYLE_TOP = { background: 'rgba(0, 212, 255, 0.12)', color: 'var(--accent-cyan)', borderColor: 'rgba(0, 212, 255, 0.35)' }

const dateStamp = (str) => {
  const t = str ? new Date(str).getTime() : NaN
  return isNaN(t) ? 0 : t
}

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
      (fixture.season && r.season ? String(r.season) === String(fixture.season) : true)
    ) || null
  }

  const fixtures = useMemo(() => {
    const isLiveLeagueFixture = (f) => {
      const gt = norm(f.gameType)
      if (f.cupId) return false
      if (gt && gt !== 'league') return false
      if (f.season) return String(f.season) === String(currentSeason)
      const stamp = Math.max(dateStamp(f.createdAt), dateStamp(f.fixtureDate), dateStamp(f.proposedDate), dateStamp(f.counterDate))
      return stamp === 0 ? true : stamp >= SEASON_START
    }
    return allFixtures
      .filter(f => !f._deleted && isLiveLeagueFixture(f))
      .map(f => {
        const p1 = findUser(f.player1Id || f.player1)
        const p2 = findUser(f.player2Id || f.player2)
        if (!p1 || !p2) return null
        return {
          id: f.id,
          raw: f,
          p1,
          p2,
          season: currentSeason,
          division: f.division && f.division !== 'Unassigned' ? f.division : (p1.division && p1.division !== 'Unassigned' ? p1.division : (p2.division || 'Unassigned')),
          status: norm(f.status) || 'pending',
          createdAt: f.createdAt
        }
      })
      .filter(Boolean)
  }, [allFixtures, allPlayers, currentSeason, allResults])

  const enriched = useMemo(() => {
    return fixtures.map(f => {
      const result = resultForFixture(f)
      const resultStatus = result ? norm(result.status) : ''
      const played = ['approved', 'completed'].includes(f.status) || resultStatus === 'approved'
      const awaiting = f.status === 'result_submitted' || (result && !['approved', 'rejected'].includes(resultStatus))
      return { f, result, awaiting, played: played || awaiting }
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
      .sort((a, b) => String(a.f.p1.username).localeCompare(String(b.f.p1.username)))
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
      const msg = `Your League match vs ` + `{opp}` + ` is due. Arrange a time to play!`
      await notifyUser(fixture.p1.id, 'Fixture Reminder', msg.replace('{opp}', fixture.p2.username), 'fixture_reminder', { fixtureId: fixture.id })
      await notifyUser(fixture.p2.id, 'Fixture Reminder', msg.replace('{opp}', fixture.p1.username), 'fixture_reminder', { fixtureId: fixture.id })
      await logAudit('FIXTURE_REMIND', `Reminded ${fixture.p1.username} & ${fixture.p2.username} re: League fixture (${fixture.id})`)
      showToast('Reminder sent to both players', 'success')
    } catch (e) { showToast('Remind failed: ' + e.message, 'error') }
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

  const statusBadge = (played) => (
    <span className="btn btn-sm" style={{ ...(played ? STYLE_PLAYED : STYLE_TOP), border: '1px solid', cursor: 'default', padding: '4px 10px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
      {played ? 'Played' : 'To Play'}
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
        toPlay.length === 0 ? (
          <div className="glass" style={{ padding: '24px', borderRadius: '12px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No games left to play. All fixtures for this season are complete!
          </div>
        ) : (
          groupByDivision(toPlay).map(g => (
            <div className="glass" key={g.division} style={{ padding: '16px', borderRadius: '12px' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent-cyan)', marginBottom: '12px' }}>
                {g.division} · {g.rows.length} to play
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
                {g.rows.map(({ f }) => (
                  <div key={f.id} className="glass" style={{ padding: '14px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: 14 }}>{f.p1.username}</strong>
                      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>vs</span>
                      <strong style={{ fontSize: 14 }}>{f.p2.username}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>{statusBadge(false)}</div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
                      {actionBtn(() => handleRemind(f), 'Remind', 'btn-secondary', busyId === `r_${f.id}`)}
                      {actionBtn(() => { setForfeitFor(f); setWinner('') }, 'Forfeit', 'btn-danger', busyId === `f_${f.id}`)}
                      {onOpenSubmitResult && actionBtn(() => onOpenSubmitResult(f), 'Result', 'btn-secondary', busyId === `o_${f.id}`)}
                      {actionBtn(() => handleRemove(f), 'Delete', 'btn-secondary', busyId === `x_${f.id}`)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )
      ) : (
        played.length === 0 ? (
          <div className="glass" style={{ padding: '24px', borderRadius: '12px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No played games for this season yet.
          </div>
        ) : (
          groupByDivision(played).map(g => (
            <div className="glass" key={g.division} style={{ padding: '16px', borderRadius: '12px' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#81c784', marginBottom: '12px' }}>
                {g.division} · {g.rows.length} played
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
                {g.rows.map(({ f, result, awaiting }) => {
                  const scoreTxt = result ? `${result.score1} - ${result.score2}` : '—'
                  return (
                    <div key={f.id} className="glass" style={{ padding: '14px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: 14 }}>{result?.player1 || f.p1.username}</strong>
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>vs</span>
                        <strong style={{ fontSize: 14 }}>{result?.player2 || f.p2.username}</strong>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                        <span style={{ fontSize: 18, fontWeight: 800 }}>{scoreTxt}</span>
                        {statusBadge(true)}
                      </div>
                      {awaiting && onReviewResults && (
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          {actionBtn(() => onReviewResults(), 'Review', 'btn-primary', busyId === `v_${f.id}`)}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )
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