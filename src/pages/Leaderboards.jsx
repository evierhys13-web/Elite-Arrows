import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContextInternal'
import { db, collection, query, getDocs, orderBy, limit } from '../firebase'
import { derivePlayerStatsFromResults } from '../utils/playerStats'
import Breadcrumbs from '../components/Breadcrumbs'
import { useToast } from '../context/ToastContext'

export default function Leaderboards() {
  const { user, getAllUsers, getFixtures, getResults, dataRefreshTrigger, adminData, forceFetchResults, triggerDataRefresh } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [selectedDivision, setSelectedDivision] = useState('all')
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') === 'practice' ? 'practice' : 'league')
  const [timeFilter, setTimeFilter] = useState('all')
  const [refreshKey, setRefreshKey] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [practiceLeaderboard, setPracticeLeaderboard] = useState([])
  const [hallOfFame, setHallOfFame] = useState([])
  const [allLeagueResults, setAllLeagueResults] = useState(null)

  useEffect(() => {
    const fetchPracticeData = async () => {
      try {
        const q = query(collection(db, 'practiceLeaderboard'), orderBy('score', 'desc'), limit(50))
        const snap = await getDocs(q)
        setPracticeLeaderboard(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      } catch (e) {
        console.error('Error fetching practice leaderboard:', e)
      }
    }
    if (activeTab === 'practice') fetchPracticeData()
  }, [activeTab, refreshKey])

  useEffect(() => {
    const fetchHallOfFame = async () => {
      try {
        const snap = await getDocs(collection(db, 'hallOfFame'))
        setHallOfFame(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      } catch (e) { console.error('Error fetching hall of fame:', e) }
    }
    fetchHallOfFame()
  }, [refreshKey])

  // Full history (all seasons) - the context listener caps results at the newest 500,
  // so all-time stats need their own unbounded fetch. No server-side status filter:
  // legacy season docs may not have a status field at all.
  useEffect(() => {
    let cancelled = false
    const fetchAllResults = async (attempt = 0) => {
      try {
        const snap = await getDocs(collection(db, 'results'))
        if (cancelled) return
        const usable = snap.docs.map(d => ({ ...d.data(), id: d.data().id || d.id, firestoreId: d.id }))
          .filter(r => {
            const status = String(r.status || '').toLowerCase()
            if (status === 'approved') return true
            // Legacy imports may lack status entirely - treat scored docs as approved
            return !status && r.score1 !== undefined && r.score2 !== undefined
          })
        setAllLeagueResults(usable)
      } catch (e) {
        console.error('Error fetching all-time results:', e)
        if (attempt < 2 && !cancelled) setTimeout(() => fetchAllResults(attempt + 1), 3000 * (attempt + 1))
      }
    }
    fetchAllResults()
    return () => { cancelled = true }
  }, [refreshKey])

  useEffect(() => {
    setRefreshKey(prev => prev + 1)
  }, [dataRefreshTrigger])

  const allUsers = getAllUsers()
  const fixtures = getFixtures()
  const results = getResults()
  const playerStats = useMemo(() => derivePlayerStatsFromResults(allUsers, results, {
    fixtures,
    adminData,
    leagueOnly: true,
    timePeriod: timeFilter
  }), [allUsers, results, fixtures, adminData, timeFilter, refreshKey])

  const leaderboard = useMemo(() => {
    let list = Object.values(playerStats)
      .filter(p => p.played > 0)
      .sort((a, b) => b.points - a.points || b.wins - a.wins || b.legDiff - a.legDiff)

    if (selectedDivision !== 'all') {
      list = list.filter(p => p.division === selectedDivision)
    }
    return list
  }, [playerStats, selectedDivision])

  const divisions = ['all', 'Elite', 'Emerald', 'Diamond', 'Platinum']

  // All-time totals across every season (Seasons 1-4 league games, ignores time filter and soft reset)
  const allTimeStats = useMemo(() => derivePlayerStatsFromResults(allUsers, allLeagueResults || results, {
    fixtures,
    adminData,
    leagueOnly: true,
    timePeriod: 'all',
    includeReset: false,
    dedupe: false
  }), [allUsers, results, allLeagueResults, fixtures, adminData, refreshKey])

  const allTime180s = useMemo(() =>
    Object.values(allTimeStats).reduce((max, player) => (!max || player['180s'] > max['180s']) ? player : max, null)
  , [allTimeStats])

  const allTime180sBoard = useMemo(() =>
    Object.values(allTimeStats)
      .filter(p => p.played > 0 && p['180s'] > 0)
      .sort((a, b) => b['180s'] - a['180s'] || b.played - a.played)
  , [allTimeStats])

  const top170s = useMemo(() =>
    leaderboard.length > 0 ? leaderboard.reduce((max, player) => (!max || player['170s'] > max['170s']) ? player : max, null) : null
  , [leaderboard])

  const topCheckout = useMemo(() =>
    leaderboard.length > 0 ? leaderboard.reduce((max, player) => (!max || player.highestCheckout > max.highestCheckout) ? player : max, null) : null
  , [leaderboard])

  const honoursList = useMemo(() => {
    // Priority: Curated Hall of Fame
    const curated = hallOfFame.map(h => {
      const u = allUsers.find(user => user.id === h.userId)
      return { ...h, profilePicture: u?.profilePicture }
    })

    if (curated.length > 0) {
      return curated.sort((a, b) => new Date(b.awardedAt || 0) - new Date(a.awardedAt || 0))
    }

    const list = []
    if (!Array.isArray(allUsers)) return list
    allUsers.forEach(u => {
      if (u.trophies && Array.isArray(u.trophies)) {
        u.trophies.forEach(t => {
          list.push({
            ...t,
            username: u.username,
            userId: u.id,
            profilePicture: u.profilePicture
          })
        })
      }
    })
    return list.sort((a, b) => new Date(b.awardedAt || 0) - new Date(a.awardedAt || 0))
  }, [allUsers, hallOfFame])

  return (
    <div className="page animate-fade-in">
      <Breadcrumbs items={[{ label: 'Home', path: '/home' }, { label: 'Leaderboards' }]} />

      <div className="page-header" style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title text-gradient" style={{ fontSize: '2.5rem' }}>League Honours & Rankings</h1>
          <p style={{ color: 'var(--text-muted)' }}>Celebrating our champions and top performers</p>
        </div>
        <button
          className="btn btn-secondary glass"
          disabled={isSyncing}
          onClick={async () => {
            setIsSyncing(true)
            showToast?.('Syncing latest leaderboard data...', 'info')
            try {
              if (forceFetchResults) {
                await forceFetchResults()
                showToast?.('Rankings synchronized!', 'success')
              } else {
                triggerDataRefresh('all')
                setRefreshKey(prev => prev + 1)
                showToast('Data refreshed!', 'success')
              }
            } catch (err) {
              showToast?.('Sync failed. Please reload.', 'error')
            } finally {
              setIsSyncing(false)
            }
          }}
          style={{ padding: '8px 16px', borderRadius: '99px', fontSize: '0.8rem', minWidth: '80px' }}
        >
          {isSyncing ? '⌛...' : '🔄 Sync'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        {/* Top Stats Cards */}
        <div className="card glass" style={{ padding: '24px', textAlign: 'center', borderBottom: '4px solid #fbbf24' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🎯</div>
          <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>All-Time 180s King</h4>
          <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'white' }}>{allTime180s?.username || 'TBD'}</div>
          <div style={{ fontSize: '0.9rem', color: '#fbbf24', fontWeight: 700 }}>{allTime180s?.['180s'] || 0} Maxes</div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px' }}>All seasons combined</div>
        </div>

        <div className="card glass" style={{ padding: '24px', textAlign: 'center', borderBottom: '4px solid var(--accent-cyan)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🐟</div>
          <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Highest Checkout</h4>
          <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'white' }}>{topCheckout?.username || 'TBD'}</div>
          <div style={{ fontSize: '0.9rem', color: 'var(--accent-cyan)', fontWeight: 700 }}>{topCheckout?.highestCheckout || 0} Finish</div>
        </div>

        <div className="card glass" style={{ padding: '24px', textAlign: 'center', borderBottom: '4px solid #10b981' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🏆</div>
          <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Big Fish 170+</h4>
          <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'white' }}>{top170s?.username || 'None'}</div>
          <div style={{ fontSize: '0.9rem', color: '#10b981', fontWeight: 700 }}>{top170s?.['170s'] || 0} Recorded</div>
        </div>
      </div>

      <div className="division-tabs" style={{ marginBottom: '24px' }}>
        <button className={`division-tab ${activeTab === 'league' ? 'active' : ''}`} onClick={() => setActiveTab('league')}>
          🏆 League Rankings
        </button>
        <button className={`division-tab ${activeTab === 'alltime' ? 'active' : ''}`} onClick={() => setActiveTab('alltime')}>
          💯 All-Time 180s
        </button>
        <button className={`division-tab ${activeTab === 'practice' ? 'active' : ''}`} onClick={() => setActiveTab('practice')}>
          🎯 Practice Drills
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '32px', alignItems: 'start' }} className="leaderboard-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="card glass" style={{ padding: '24px' }}>
            {activeTab === 'league' ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                   <h3 className="card-title" style={{ margin: 0 }}>📊 Performance Tables</h3>
                   <div style={{ display: 'flex', gap: '8px' }}>
                      {['week', 'month', 'quarter', 'all'].map(f => (
                        <button
                          key={f}
                          className={`btn btn-sm ${timeFilter === f ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => setTimeFilter(f)}
                          style={{ fontSize: '0.7rem', padding: '6px 12px' }}
                        >
                          {f === 'quarter' ? '3M' : f.toUpperCase()}
                        </button>
                      ))}
                   </div>
                </div>

                <div className="division-tabs" style={{ marginBottom: '20px', overflowX: 'auto', paddingBottom: '4px' }}>
                  {divisions.map(div => (
                    <button
                      key={div}
                      className={`division-tab ${selectedDivision === div ? 'active' : ''}`}
                      onClick={() => setSelectedDivision(div)}
                      style={{ fontSize: '0.75rem', padding: '8px 14px' }}
                    >
                      {div === 'all' ? 'All' : div}
                    </button>
                  ))}
                </div>

                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  {leaderboard.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                       <p style={{ color: 'var(--text-muted)', marginBottom: '15px' }}>No matches played in this period.</p>
                       {timeFilter !== 'all' && (
                         <button className="btn btn-secondary btn-sm" onClick={() => setTimeFilter('all')}>Show All Time</button>
                       )}
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                          <th style={{ padding: '12px 8px' }}>Rank</th>
                          <th style={{ padding: '12px 8px' }}>Player</th>
                          <th style={{ padding: '12px 8px', textAlign: 'center' }}>Pts</th>
                          <th style={{ padding: '12px 8px', textAlign: 'center' }}>W-L</th>
                          <th style={{ padding: '12px 8px', textAlign: 'center' }}>GP</th>
                          <th style={{ padding: '12px 8px', textAlign: 'center' }} title="3-Dart Average">Avg</th>
                          <th style={{ padding: '12px 8px', textAlign: 'center' }} title="Highest Checkout">HC</th>
                          <th style={{ padding: '12px 8px', textAlign: 'center' }} title="Number of 180s">180s</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboard.map((player, index) => (
                          <tr key={player.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '0.9rem' }}>
                            <td style={{ padding: '12px 8px', fontWeight: 900, color: index === 0 ? '#fbbf24' : index === 1 ? '#94a3b8' : index === 2 ? '#d97706' : 'inherit' }}>
                              #{index + 1}
                            </td>
                            <td style={{ padding: '12px 8px' }}>
                              <div
                                style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
                                onClick={() => navigate(`/profile/${player.id}`)}
                              >
                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent-primary)', overflow: 'hidden' }}>
                                  {player.profilePicture ? <img src={player.profilePicture} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontWeight: 800, fontSize: '0.8rem' }}>{player.username.charAt(0)}</span>}
                                </div>
                                <div>
                                   <div style={{ fontWeight: 700 }}>{player.username}</div>
                                   <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{player.division}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 900, color: 'var(--accent-cyan)' }}>{player.points}</td>
                            <td style={{ padding: '12px 8px', textAlign: 'center', fontSize: '0.8rem' }}>
                              <span style={{ color: 'var(--success)' }}>{player.wins}</span>-<span style={{ color: 'var(--error)' }}>{player.losses}</span>
                            </td>
                            <td style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-muted)' }}>{player.played}</td>
                            <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 700, color: player.average > 0 ? '#10b981' : 'var(--text-muted)' }}>
                              {player.average > 0 ? player.average.toFixed(1) : '-'}
                            </td>
                            <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 700, color: player.highestCheckout > 0 ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>
                              {player.highestCheckout > 0 ? player.highestCheckout : '-'}
                            </td>
                            <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 700, color: player['180s'] > 0 ? '#fbbf24' : 'var(--text-muted)' }}>
                              {player['180s'] || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            ) : activeTab === 'alltime' ? (
              <>
                <div style={{ marginBottom: '20px' }}>
                  <h3 className="card-title" style={{ margin: 0 }}>💯 All-Time 180s Leaderboard</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '6px', marginBottom: 0 }}>Total 180s across all league games, all seasons combined</p>
                </div>

                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  {allTime180sBoard.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                      <p style={{ color: 'var(--text-muted)' }}>No 180s recorded yet.</p>
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                          <th style={{ padding: '12px 8px' }}>Rank</th>
                          <th style={{ padding: '12px 8px' }}>Player</th>
                          <th style={{ padding: '12px 8px', textAlign: 'center' }}>180s</th>
                          <th style={{ padding: '12px 8px', textAlign: 'center' }}>GP</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allTime180sBoard.map((player, index) => (
                          <tr key={player.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '0.9rem' }}>
                            <td style={{ padding: '12px 8px', fontWeight: 900, color: index === 0 ? '#fbbf24' : index === 1 ? '#94a3b8' : index === 2 ? '#d97706' : 'inherit' }}>
                              #{index + 1}
                            </td>
                            <td style={{ padding: '12px 8px' }}>
                              <div
                                style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
                                onClick={() => navigate(`/profile/${player.id}`)}
                              >
                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent-primary)', overflow: 'hidden' }}>
                                  {player.profilePicture ? <img src={player.profilePicture} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontWeight: 800, fontSize: '0.8rem' }}>{player.username.charAt(0)}</span>}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 700 }}>{player.username}</div>
                                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{player.division}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 900, color: '#fbbf24' }}>{player['180s']}</td>
                            <td style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-muted)' }}>{player.played}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <h3 className="card-title" style={{ margin: 0 }}>🎯 Practice Drills Leaderboard</h3>
                </div>

                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  {practiceLeaderboard.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                       <p style={{ color: 'var(--text-muted)' }}>No practice sessions recorded yet.</p>
                       <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={() => navigate('/practice')}>Go to Practice Hub</button>
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                          <th style={{ padding: '12px 8px' }}>Rank</th>
                          <th style={{ padding: '12px 8px' }}>Player</th>
                          <th style={{ padding: '12px 8px' }}>Drill</th>
                          <th style={{ padding: '12px 8px', textAlign: 'center' }}>Score/Acc</th>
                        </tr>
                      </thead>
                      <tbody>
                        {practiceLeaderboard.map((entry, index) => (
                          <tr key={entry.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '0.9rem' }}>
                            <td style={{ padding: '12px 8px', fontWeight: 900 }}>#{index + 1}</td>
                            <td style={{ padding: '12px 8px', fontWeight: 700 }}>{entry.username}</td>
                            <td style={{ padding: '12px 8px' }}>
                              <span style={{
                                padding: '4px 8px',
                                background: 'rgba(255,255,255,0.05)',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                color: entry.modeId === 'atc' ? 'var(--accent-cyan)' : entry.modeId === '170' ? '#ef4444' : '#fbbf24'
                              }}>
                                {entry.modeId === 'atc' ? 'Around Clock' : entry.modeId === '170' ? '170 Drill' : 'Scoring'}
                              </span>
                            </td>
                            <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 900, color: 'var(--accent-primary)' }}>
                              {entry.modeId === 'atc' ? `${entry.accuracy?.toFixed(1)}%` : entry.modeId === '170' ? `${entry.dartsThrown} darts` : entry.score}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Honours List / Hall of Fame */}
          <div className="card glass" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 className="card-title" style={{ margin: 0 }}>🎖️ Hall of Fame</h3>
              <button className="btn btn-secondary btn-sm" style={{ fontSize: '0.7rem', padding: '5px 12px' }} onClick={() => navigate('/hall-of-fame')}>Full Page ➔</button>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>Historical league and cup winners</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {honoursList.length > 0 ? honoursList.map((honour, i) => (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '16px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: '12px',
                  border: '1px solid var(--border)'
                }}>
                  <div style={{ fontSize: '2rem' }}>{honour.icon || '🏆'}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'white' }}>{honour.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>{honour.username}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>{honour.season}</div>
                  </div>
                </div>
              )) : (
                <div style={{ textAlign: 'center', padding: '30px', border: '1px dashed var(--border)', borderRadius: '12px' }}>
                   <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No honours recorded yet. Season champions will be listed here.</p>
                </div>
              )}
            </div>
          </div>

          <div className="card glass" style={{ padding: '24px', background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.1), rgba(129, 140, 248, 0.1))' }}>
            <h3 className="card-title" style={{ fontSize: '1.1rem' }}>💡 Earn Your Spot</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              Win your division league or any official cup tournament to have your name permanently etched in the Elite Arrows Hall of Fame.
            </p>
            <button className="btn btn-primary btn-sm btn-block" style={{ marginTop: '16px' }} onClick={() => navigate('/cups')}>View Active Cups</button>
          </div>
        </div>
      </div>

      <style>{`
        .leaderboard-grid > div { min-width: 0; }
        .leaderboard-grid .card { min-width: 0; max-width: 100%; }
        @media (max-width: 900px) {
          .leaderboard-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
