import { useMemo, useState } from 'react'
import { db, doc, setDoc, deleteDoc } from '../firebase'
import { isLeagueResult, getResultPlayerId } from '../utils/leagueResults'

const norm = (s) => String(s || '').toLowerCase().trim()

const STYLE_PLAYED = { background: 'rgba(76, 175, 80, 0.15)', color: '#81c784', borderColor: 'rgba(76, 175, 80, 0.4)' }
const STYLE_TOP = { background: 'rgba(0, 212, 255, 0.12)', color: 'var(--accent-cyan)', borderColor: 'rgba(0, 212, 255, 0.35)' }

export default function FixtureTracker({
  user,
  allPlayers,
  allFixtures,
  allResults,
  seasons,
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
  const [showBreakdown, setShowBreakdown] = useState(false)
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
      (u.nickname && norm(u.nickname) === norm(s)) ||
      (u.name && norm(u.name) === norm(s))
    ) || null
  }

  const seasonNorm = (s) => String(s || '').replace(/\s+/g, '').toLowerCase()

  const activeSeasonDoc = useMemo(() => {
    if (!currentSeason) return null
    return (seasons || []).find(s => !s.isArchived && seasonNorm(s.name) === seasonNorm(currentSeason)) || (seasons || []).find(s => seasonNorm(s.name) === seasonNorm(currentSeason)) || null
  }, [seasons, currentSeason])

  const usersWithDivisions = useMemo(() => {
    const staged = activeSeasonDoc?.stagedDivisions || {}
    return allPlayers.map(u => ({
      ...u,
      division: staged[String(u.id)] || staged[u.id] || u.division || 'Unassigned'
    }))
  }, [allPlayers, activeSeasonDoc])

  const divisions = useMemo(() => {
    const set = new Set()
    usersWithDivisions.forEach(u => {
      if (u.division && u.division !== 'Unassigned' && u.division !== 'Admin') set.add(u.division)
    })
    return Array.from(set).sort()
  }, [usersWithDivisions])

  const fixturesById = useMemo(() => Object.fromEntries(allFixtures.map(f => [String(f.id), f])), [allFixtures])

  const seasonResults = useMemo(() => {
    return allResults.filter(r => {
      if (norm(r.status) !== 'approved') return false
      if (!isLeagueResult(r, fixturesById)) return false
      if (!currentSeason) return true
      const resSeason = seasonNorm(r.season)
      const actSeason = seasonNorm(currentSeason)
      if (['season1', '2026', 'legacy'].includes(actSeason)) {
        return ['season1', '2026', 'legacy', '', 'undefined', 'null'].includes(resSeason)
      }
      return resSeason === actSeason
    })
  }, [allResults, fixturesById, currentSeason])

  const playedByPlayer = useMemo(() => {
    const map = {}
    seasonResults.forEach(r => {
      const p1 = getResultPlayerId(r, 1, usersWithDivisions)
      const p2 = getResultPlayerId(r, 2, usersWithDivisions)
      if (!p1 || !p2) return
      if (!map[p1]) map[p1] = new Set()
      if (!map[p2]) map[p2] = new Set()
      map[p1].add(p2)
      map[p2].add(p1)
    })
    return map
  }, [seasonResults, usersWithDivisions])

  const rosterByDivision = useMemo(() => {
    const map = {}
    usersWithDivisions.forEach(u => {
      if (u.division === 'Unassigned' || u.division === 'Admin') return
      if (!map[u.division]) map[u.division] = []
      map[u.division].push(u)
    })
    Object.keys(map).forEach(d => map[d].sort((a, b) => String(a.username || '').localeCompare(String(b.username || ''))))
    return map
  }, [usersWithDivisions])

  const fixtureByPairKey = useMemo(() => {
    const map = {}
    allFixtures.forEach(f => {
      if (f._deleted) return
      if (f.cupId) return
      const gt = norm(f.gameType)
      if (gt && gt !== 'league') return
      if (f.season && seasonNorm(f.season) !== seasonNorm(currentSeason)) return
      if (['approved', 'completed', 'rejected', 'result_submitted'].includes(norm(f.status))) return
      const p1 = findUser(f.player1Id || f.player1)
      const p2 = findUser(f.player2Id || f.player2)
      if (!p1 || !p2) return
      const key = [String(p1.id), String(p2.id)].sort().join('_')
      map[key] = f
    })
    return map
  }, [allFixtures, currentSeason, allPlayers])

  const pairKey = (a, b) => [String(a.id), String(b.id)].sort().join('_')

  const toPlayRows = useMemo(() => {
    const rows = []
    Object.entries(rosterByDivision).forEach(([div, roster]) => {
      if (divisionFilter !== 'all' && div !== divisionFilter) return
      for (let i = 0; i < roster.length; i++) {
        for (let j = i + 1; j < roster.length; j++) {
          const a = roster[i]
          const b = roster[j]
          const key = pairKey(a, b)
          if (playedByPlayer[String(a.id)] && playedByPlayer[String(a.id)].has(String(b.id))) continue
          rows.push({ key, p1: a, p2: b, division: div, fixture: fixtureByPairKey[key] || null })
        }
      }
    })
    return rows.sort((x, y) => String(x.p1.username).localeCompare(String(y.p1.username)) || String(x.p2.username).localeCompare(String(y.p2.username)))
  }, [rosterByDivision, playedByPlayer, fixtureByPairKey, divisionFilter])

  const playedRows = useMemo(() => {
    const rows = []
    seasonResults.forEach(r => {
      const p1Id = getResultPlayerId(r, 1, usersWithDivisions)
      const p2Id = getResultPlayerId(r, 2, usersWithDivisions)
      if (!p1Id || !p2Id) return
      const p1 = usersWithDivisions.find(u => String(u.id) === String(p1Id))
      const p2 = usersWithDivisions.find(u => String(u.id) === String(p2Id))
      if (!p1 || !p2) return
      const division = p1.division && p1.division !== 'Unassigned' ? p1.division : (p2.division || 'Unassigned')
      if (division === 'Unassigned' || division === 'Admin') return
      if (divisionFilter !== 'all' && division !== divisionFilter) return
      rows.push({ key: r.id || pairKey(p1, p2), p1, p2, division, result: r })
    })
    return rows.sort((x, y) => String(y.result?.date || y.result?.submittedAt || '').localeCompare(String(x.result?.date || x.result?.submittedAt || '')))
  }, [seasonResults, usersWithDivisions, divisionFilter])

  const groupByDivision = (list) => {
    const groups = []
    list.forEach(e => {
      let g = groups.find(x => x.division === e.division)
      if (!g) { g = { division: e.division, rows: [] }; groups.push(g) }
      g.rows.push(e)
    })
    return groups
  }

  const breakdown = useMemo(() => {
    return divisions
      .filter(d => divisionFilter === 'all' || d === divisionFilter)
      .map(div => {
        const roster = rosterByDivision[div] || []
        return {
          div,
          rows: roster.map(u => {
            const played = playedByPlayer[String(u.id)] ? playedByPlayer[String(u.id)].size : 0
            const remaining = Math.max(0, roster.length - 1 - played)
            return { user: u, played, remaining }
          })
        }
      })
  }, [divisions, rosterByDivision, playedByPlayer, divisionFilter])

  const handleRemind = async (entry, opponentId) => {
    if (busyId) return
    setBusyId(`r_${entry.key}`)
    try {
      const msg = `Your League match vs ` + `{opp}` + ` is due. Arrange a time to play!`
      await notifyUser(entry.p1.id, 'Fixture Reminder', msg.replace('{opp}', entry.p2.username), 'fixture_reminder', { fixtureId: entry.fixture?.id || '' })
      await notifyUser(entry.p2.id, 'Fixture Reminder', msg.replace('{opp}', entry.p1.username), 'fixture_reminder', { fixtureId: entry.fixture?.id || '' })
      await logAudit('FIXTURE_REMIND', `Reminded ${entry.p1.username} & ${entry.p2.username} re: League fixture`)
      showToast('Reminder sent to both players', 'success')
    } catch (e) { showToast('Remind failed: ' + e.message, 'error') }
    setBusyId('')
  }

  const handleApplyForfeit = async () => {
    if (!forfeitFor) return
    if (!winner) return showToast('Select the forfeit winner', 'error')
    if (busyId) return
    setBusyId(`f_${forfeitFor.key}`)
    const entry = forfeitFor
    const winIsP1 = String(winner) === String(entry.p1.id)
    const winnerP = winIsP1 ? entry.p1 : entry.p2
    const loserP = winIsP1 ? entry.p2 : entry.p1
    const resultId = `admin_${Date.now()}`
    try {
      const newMatch = {
        id: resultId,
        player1: entry.p1.username,
        player1Id: entry.p1.id,
        player2: entry.p2.username,
        player2Id: entry.p2.id,
        score1: winIsP1 ? 1 : 0,
        score2: winIsP1 ? 0 : 1,
        gameType: 'League',
        status: 'approved',
        season: currentSeason,
        division: entry.p1.division || '',
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
      if (entry.fixture) {
        const updatedFixture = { ...entry.fixture, status: 'approved', resultId, score1: newMatch.score1, score2: newMatch.score2, updatedAt: new Date().toISOString() }
        await setDoc(doc(db, 'fixtures', String(entry.fixture.id)), updatedFixture, { merge: true })
        const list = [...allFixtures]
        const idx = list.findIndex(x => String(x.id) === String(entry.fixture.id))
        if (idx !== -1) list[idx] = updatedFixture
        updateFixtures(list)
      }
      await logAudit('FIXTURE_FORFEIT', `Forfeit: ${winnerP.username} def ${loserP.username} (League)`)
      triggerDataRefresh('all')
      showToast(`${winnerP.username} wins by forfeit - 3 points awarded`, 'success')
      setForfeitFor(null); setWinner('')
    } catch (e) { showToast('Forfeit failed: ' + e.message, 'error') }
    setBusyId('')
  }

  const handleRemove = async (entry) => {
    if (!entry.fixture) return
    if (!window.confirm(`Delete the scheduled fixture between ${entry.p1.username} and ${entry.p2.username}?`)) return
    if (busyId) return
    setBusyId(`x_${entry.key}`)
    try {
      await deleteDoc(doc(db, 'fixtures', String(entry.fixture.id)))
      updateFixtures(allFixtures.filter(x => String(x.id) !== String(entry.fixture.id)))
      await logAudit('FIXTURE_DELETE', `Deleted League fixture: ${entry.p1.username} vs ${entry.p2.username}`)
      showToast('Fixture deleted', 'success')
    } catch (e) { showToast('Delete failed: ' + e.message, 'error') }
    setBusyId('')
  }

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

  const toggleCard = (active, count, label, onClick) => (
    <button
      onClick={onClick}
      className="glass"
      style={{
        padding: '16px',
        borderRadius: '12px',
        textAlign: 'center',
        cursor: 'pointer',
        border: active ? '2px solid var(--accent-cyan)' : '2px solid transparent',
        opacity: active ? 1 : 0.55,
        transition: 'opacity 0.15s ease'
      }}
    >
      <div style={{ fontSize: 30, fontWeight: 800 }}>{count}</div>
      <div style={{ fontWeight: 700, marginTop: '2px' }}>{label}</div>
    </button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent-cyan)' }}>
          {currentSeason ? `Live Season: ${currentSeason}` : 'Live Season'} · League
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button className={`btn btn-sm ${divisionFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setDivisionFilter('all')}>All</button>
          {divisions.map(d => (
            <button key={d} className={`btn btn-sm ${divisionFilter === d ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setDivisionFilter(d)}>{d}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', maxWidth: '480px' }}>
        {toggleCard(view === 'toplay', toPlayRows.length, 'To Play', () => setView('toplay'))}
        {toggleCard(view === 'played', playedRows.length, 'Played', () => setView('played'))}
      </div>

      {view === 'toplay' ? (
        toPlayRows.length === 0 ? (
          <div className="glass" style={{ padding: '20px', borderRadius: '12px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
            No games left to play. All league games are complete!
          </div>
        ) : (
          groupByDivision(toPlayRows).map(g => (
            <div key={g.division}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent-cyan)', marginBottom: '8px' }}>{g.division} · {g.rows.length} to play</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '8px' }}>
                {g.rows.map(entry => (
                  <div key={entry.key} className="glass" style={{ padding: '12px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: 13 }}>{entry.p1.username}</strong>
                      <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>vs</span>
                      <strong style={{ fontSize: 13 }}>{entry.p2.username}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>{statusBadge(false)}</div>
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', justifyContent: 'center' }}>
                      {actionBtn(() => handleRemind(entry), 'Remind', 'btn-secondary', busyId === `r_${entry.key}`)}
                      {actionBtn(() => { setForfeitFor(entry); setWinner('') }, 'Forfeit', 'btn-danger', busyId === `f_${entry.key}`)}
                      {onOpenSubmitResult && actionBtn(() => onOpenSubmitResult(entry), 'Result', 'btn-secondary', busyId === `o_${entry.key}`)}
                      {entry.fixture && actionBtn(() => handleRemove(entry), 'Delete', 'btn-secondary', busyId === `x_${entry.key}`)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )
      ) : (
        playedRows.length === 0 ? (
          <div className="glass" style={{ padding: '20px', borderRadius: '12px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
            No league games played yet this season.
          </div>
        ) : (
          groupByDivision(playedRows).map(g => (
            <div key={g.division}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#81c784', marginBottom: '8px' }}>{g.division} · {g.rows.length} played</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '8px' }}>
                {g.rows.map(entry => {
                  const r = entry.result
                  const scoreTxt = `${r.score1} - ${r.score2}`
                  const winnerIsP1 = Number(r.score1) > Number(r.score2)
                  const winnerName = winnerIsP1 ? entry.p1.username : entry.p2.username
                  return (
                    <div key={entry.key} className="glass" style={{ padding: '12px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: 13 }}>{entry.p1.username}</strong>
                        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>vs</span>
                        <strong style={{ fontSize: 13 }}>{entry.p2.username}</strong>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                        <span style={{ fontSize: 16, fontWeight: 800 }}>{scoreTxt}</span>
                        {statusBadge(true)}
                      </div>
                      <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                        {r.forfeit ? <>⚖ {winnerName} wins by forfeit</> : <>🏆 {winnerName} wins</>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => setShowBreakdown(v => !v)} style={{ whiteSpace: 'nowrap' }}>
          {showBreakdown ? 'Hide' : 'Show'} per-player breakdown
        </button>
        {onReviewResults && <button className="btn btn-secondary btn-sm" onClick={() => onReviewResults()} style={{ whiteSpace: 'nowrap' }}>Review pending results</button>}
      </div>

      {showBreakdown && breakdown.map(({ div, rows }) => (
        <div key={div} className="glass" style={{ padding: '14px', borderRadius: '12px' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', marginBottom: '8px' }}>{div} · Games per Player</div>
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr><th>Player</th><th>Played</th><th>Remaining</th></tr>
              </thead>
              <tbody>
                {rows.map(({ user: u, played, remaining }) => (
                  <tr key={u.id}>
                    <td style={{ padding: '6px' }}>{u.username}</td>
                    <td style={{ padding: '6px' }}>{played}</td>
                    <td style={{ padding: '6px', color: remaining > 0 ? '#ffb14e' : '#81c784' }}>{remaining}</td>
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