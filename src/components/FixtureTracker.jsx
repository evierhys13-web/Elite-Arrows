import { useMemo, useState } from 'react'
import { db, doc, setDoc, deleteDoc } from '../firebase'
import { isLeagueResult, getResultPlayerId } from '../utils/leagueResults'
import { getApprovedResultsForStats } from '../utils/playerStats'

const norm = (s) => String(s || '').toLowerCase().trim()

const SEASON_START = new Date('2026-09-01T00:00:00').getTime()

const STYLE_PLAYED = { background: 'rgba(76, 175, 80, 0.15)', color: '#81c784', borderColor: 'rgba(76, 175, 80, 0.4)' }
const STYLE_TOP = { background: 'rgba(0, 212, 255, 0.12)', color: 'var(--accent-cyan)', borderColor: 'rgba(0, 212, 255, 0.35)' }
const STYLE_WARN = { background: 'rgba(255, 193, 7, 0.15)', color: '#ffd54f', borderColor: 'rgba(255, 193, 7, 0.45)' }

const dateStamp = (str) => {
  const t = str ? new Date(str).getTime() : NaN
  return isNaN(t) ? 0 : t
}

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
  onRecordGame
}) {
  const [divisionFilter, setDivisionFilter] = useState('all')
  const [view, setView] = useState('toplay')
  const [showBreakdown, setShowBreakdown] = useState(false)
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

  const allDivFiltered = useMemo(() => {
    const divMap = {}
    usersWithDivisions.forEach(u => { divMap[String(u.id)] = u.division })
    return allResults.filter(r => {
      const p1Id = getResultPlayerId(r, 1, usersWithDivisions)
      const p2Id = getResultPlayerId(r, 2, usersWithDivisions)
      if (!p1Id || !p2Id) return false
      const d1 = divMap[p1Id]
      const d2 = divMap[p2Id]
      if (!d1 || !d2 || d1 === 'Unassigned' || d2 === 'Unassigned' || d1 === 'Admin' || d2 === 'Admin') return false
      return d1 === d2
    })
  }, [allResults, usersWithDivisions])

  const approvedResults = useMemo(() => getApprovedResultsForStats(allDivFiltered, {
    fixtures: allFixtures,
    adminData,
    leagueOnly: true,
    currentSeason,
    includePlayoffs: false
  }), [allDivFiltered, allFixtures, adminData, currentSeason])

  const isLivePending = (r) => {
    if (norm(r.status) === 'rejected') return false
    if (!isLeagueResult(r, fixturesById)) return false
    const rs = seasonNorm(r.season)
    const as = seasonNorm(currentSeason)
    if (rs === as) return true
    if (['season1', '2026', 'legacy'].includes(as)) {
      return ['season1', '2026', 'legacy', '', 'undefined', 'null'].includes(rs)
    }
    if (!r.season) {
      const t = dateStamp(r.date || r.submittedAt || r.createdAt)
      return t === 0 ? true : t >= SEASON_START
    }
    return false
  }

  const pendingResults = useMemo(() => {
    return allDivFiltered.filter(r =>
      ['pending', 'result_submitted'].includes(norm(r.status)) && isLivePending(r)
    )
  }, [allDivFiltered])

  const pairOf = (r) => {
    const p1 = getResultPlayerId(r, 1, usersWithDivisions)
    const p2 = getResultPlayerId(r, 2, usersWithDivisions)
    if (!p1 || !p2) return null
    return [p1, p2].sort().join('_')
  }

  const approvedPairKeys = useMemo(() => {
    const s = new Set()
    approvedResults.forEach(r => { const k = pairOf(r); if (k) s.add(k) })
    return s
  }, [approvedResults, usersWithDivisions])

  const pendingPairKeys = useMemo(() => {
    const s = new Set()
    pendingResults.forEach(r => { const k = pairOf(r); if (k) s.add(k) })
    return s
  }, [pendingResults, usersWithDivisions])

  const playedByPlayer = useMemo(() => {
    const map = {}
    approvedResults.forEach(r => {
      const p1 = getResultPlayerId(r, 1, usersWithDivisions)
      const p2 = getResultPlayerId(r, 2, usersWithDivisions)
      if (!p1 || !p2) return
      if (!map[p1]) map[p1] = new Set()
      if (!map[p2]) map[p2] = new Set()
      map[p1].add(p2)
      map[p2].add(p1)
    })
    return map
  }, [approvedResults, usersWithDivisions])

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

  const toPlayRows = useMemo(() => {
    const rows = []
    Object.entries(rosterByDivision).forEach(([div, roster]) => {
      if (divisionFilter !== 'all' && div !== divisionFilter) return
      for (let i = 0; i < roster.length; i++) {
        for (let j = i + 1; j < roster.length; j++) {
          const a = roster[i]
          const b = roster[j]
          const key = [String(a.id), String(b.id)].sort().join('_')
          if (approvedPairKeys.has(key) || pendingPairKeys.has(key)) continue
          rows.push({ key, p1: a, p2: b, division: div, fixture: fixtureByPairKey[key] || null })
        }
      }
    })
    return rows.sort((x, y) => String(x.p1.username).localeCompare(String(y.p1.username)) || String(x.p2.username).localeCompare(String(y.p2.username)))
  }, [rosterByDivision, approvedPairKeys, pendingPairKeys, fixtureByPairKey, divisionFilter])

  const toRows = (list, awaiting) => {
    const rows = []
    list.forEach(r => {
      const p1Id = getResultPlayerId(r, 1, usersWithDivisions)
      const p2Id = getResultPlayerId(r, 2, usersWithDivisions)
      if (!p1Id || !p2Id) return
      const p1 = usersWithDivisions.find(u => String(u.id) === String(p1Id))
      const p2 = usersWithDivisions.find(u => String(u.id) === String(p2Id))
      if (!p1 || !p2) return
      const division = p1.division && p1.division !== 'Unassigned' ? p1.division : (p2.division || 'Unassigned')
      if (division === 'Unassigned' || division === 'Admin') return
      if (divisionFilter !== 'all' && division !== divisionFilter) return
      rows.push({ key: r.id || pairOf(r) || `${p1Id}_${p2Id}`, p1, p2, division, result: r, awaiting })
    })
    return rows
  }

  const playedRows = useMemo(() => {
    const rows = toRows(approvedResults, false)
    pendingResults.forEach(r => {
      const k = pairOf(r)
      if (k && approvedPairKeys.has(k)) return
      rows.push(...toRows([r], true))
    })
    return rows.sort((x, y) => String(y.result?.date || y.result?.submittedAt || '').localeCompare(String(x.result?.date || x.result?.submittedAt || '')))
  }, [approvedResults, pendingResults, approvedPairKeys, usersWithDivisions, divisionFilter])

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

  const handleRemind = async (entry) => {
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

  const statusBadge = (state) => {
    const style = state === 'played' ? STYLE_PLAYED : state === 'awaiting' ? STYLE_WARN : STYLE_TOP
    const label = state === 'played' ? 'Played' : state === 'awaiting' ? 'Awaiting' : 'To Play'
    return (
      <span className="btn btn-sm" style={{ ...style, border: '1px solid', cursor: 'default', padding: '4px 10px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
        {label}
      </span>
    )
  }

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
                    <div style={{ display: 'flex', justifyContent: 'center' }}>{statusBadge('toplay')}</div>
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', justifyContent: 'center' }}>
                      {actionBtn(() => handleRemind(entry), 'Remind', 'btn-secondary', busyId === `r_${entry.key}`)}
                      {onRecordGame && actionBtn(() => onRecordGame(entry, false), 'Result', 'btn-secondary', busyId === `o_${entry.key}`)}
                      {onRecordGame && actionBtn(() => onRecordGame(entry, true), 'Forfeit', 'btn-danger', busyId === `f_${entry.key}`)}
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
                        {statusBadge(entry.awaiting ? 'awaiting' : 'played')}
                      </div>
                      <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                        {entry.awaiting ? '⏳ Result awaiting approval' : (r.forfeit ? <>⚖ {winnerName} wins by forfeit</> : <>🏆 {winnerName} wins</>)}
                      </div>
                      {entry.awaiting && onReviewResults && (
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          {actionBtn(() => onReviewResults(), 'Review', 'btn-primary', busyId === `v_${entry.key}`)}
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
    </div>
  )
}