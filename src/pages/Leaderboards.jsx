import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { derivePlayerStatsFromResults } from '../utils/playerStats'

export default function Leaderboards() {
  const { user, getAllUsers, getFixtures, getResults, dataRefreshTrigger, adminData } = useAuth()
  const [selectedDivision, setSelectedDivision] = useState('all')
  const [timeFilter, setTimeFilter] = useState('week')
  const [refreshKey, setRefreshKey] = useState(0)

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

  let leaderboard = Object.values(playerStats)
    .filter(p => p.played > 0)
    .sort((a, b) => b.points - a.points || b.wins - a.wins || b.legDiff - a.legDiff)

  if (selectedDivision !== 'all') {
    leaderboard = leaderboard.filter(p => p.division === selectedDivision)
  }

  const divisions = ['all', 'Elite', 'Diamond', 'Platinum', 'Gold', 'Silver', 'Bronze', 'Development']
  const top180s = leaderboard.reduce((max, player) => !max || player['180s'] > max['180s'] ? player : max, null)
  const top170s = leaderboard.reduce((max, player) => !max || player['170s'] > max['170s'] ? player : max, null)
  const topCheckout = leaderboard.reduce((max, player) => !max || player.highestCheckout > max.highestCheckout ? player : max, null)

  const honoursList = useMemo(() => {
    const list = []
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
  }, [allUsers])

  return (
    <div className="page animate-fade-in">
      <div className="page-header" style={{ marginBottom: '32px' }}>
        <h1 className="page-title text-gradient" style={{ fontSize: '2.5rem' }}>League Honours & Rankings</h1>
        <p style={{ color: 'var(--text-muted)' }}>Celebrating our champions and top performers</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        {/* Top Stats Cards */}
        <div className="card glass" style={{ padding: '24px', textAlign: 'center', borderBottom: '4px solid #fbbf24' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🎯</div>
          <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Season 180s King</h4>
          <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'white' }}>{top180s?.username || 'TBD'}</div>
          <div style={{ fontSize: '0.9rem', color: '#fbbf24', fontWeight: 700 }}>{top180s?.['180s'] || 0} Maxes</div>
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

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '32px', alignItems: 'start' }} className="leaderboard-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="card glass" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
               <h3 className="card-title" style={{ margin: 0 }}>📊 Performance Tables</h3>
               <div style={{ display: 'flex', gap: '8px' }}>
                  {['week', 'month', 'all'].map(f => (
                    <button
                      key={f}
                      className={`btn btn-sm ${timeFilter === f ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setTimeFilter(f)}
                      style={{ fontSize: '0.7rem', padding: '6px 12px' }}
                    >
                      {f.toUpperCase()}
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

            <div style={{ overflowX: 'auto' }}>
              {leaderboard.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>No matches played in this period.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      <th style={{ padding: '12px 8px' }}>Rank</th>
                      <th style={{ padding: '12px 8px' }}>Player</th>
                      <th style={{ padding: '12px 8px', textAlign: 'center' }}>Pts</th>
                      <th style={{ padding: '12px 8px', textAlign: 'center' }}>W-L</th>
                      <th style={{ padding: '12px 8px', textAlign: 'center' }}>GP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((player, index) => (
                      <tr key={player.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '0.9rem' }}>
                        <td style={{ padding: '12px 8px', fontWeight: 900, color: index === 0 ? '#fbbf24' : index === 1 ? '#94a3b8' : index === 2 ? '#d97706' : 'inherit' }}>
                          #{index + 1}
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Honours List / Hall of Fame */}
          <div className="card glass" style={{ padding: '24px' }}>
            <h3 className="card-title">🎖️ Hall of Fame</h3>
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
        @media (max-width: 900px) {
          .leaderboard-grid { grid-template-columns: 1fr !material; }
        }
      `}</style>
    </div>
  )
}
