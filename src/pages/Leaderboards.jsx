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

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Weekly Leaderboards</h1>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button 
          className={`btn ${timeFilter === 'week' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTimeFilter('week')}
        >
          This Week
        </button>
        <button 
          className={`btn ${timeFilter === 'month' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTimeFilter('month')}
        >
          This Month
        </button>
        <button 
          className={`btn ${timeFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTimeFilter('all')}
        >
          All Time
        </button>
      </div>

      <div className="division-tabs" style={{ marginBottom: '20px' }}>
        {divisions.map(div => (
          <button
            key={div}
            className={`division-tab ${selectedDivision === div ? 'active' : ''}`}
            onClick={() => setSelectedDivision(div)}
          >
            {div === 'all' ? 'All Divisions' : div}
          </button>
        ))}
      </div>

      <div className="card">
        {leaderboard.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>
            No matches played in this period yet
          </p>
        ) : (
          <>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '60px 1fr 80px 80px 80px',
              gap: '10px',
              padding: '12px 15px',
              borderBottom: '1px solid var(--border)',
              fontWeight: 'bold',
              color: 'var(--accent-cyan)',
              fontSize: '0.85rem'
            }}>
              <div>#</div>
              <div>Player</div>
              <div>Pts</div>
              <div>W-L</div>
              <div>Played</div>
            </div>

            {leaderboard.map((player, index) => (
              <div 
                key={player.id}
                style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '60px 1fr 80px 80px 80px',
                  gap: '10px',
                  padding: '15px',
                  borderBottom: '1px solid var(--border)',
                  alignItems: 'center',
                  background: index < 3 ? `rgba(0, 212, 255, ${0.1 - index * 0.02})` : 'transparent'
                }}
              >
                <div style={{ 
                  fontSize: '1.2rem', 
                  fontWeight: 'bold',
                  color: index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : index === 2 ? '#CD7F32' : 'var(--text-muted)'
                }}>
                  {index + 1}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'var(--accent-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    overflow: 'hidden'
                  }}>
                    {player.profilePicture ? (
                      <img src={player.profilePicture} alt={player.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      player.username.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <div style={{ fontWeight: '600' }}>{player.username}</div>
                    {player.nickname && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>"{player.nickname}"</div>
                    )}
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{player.division}</div>
                  </div>
                </div>
                <div style={{ 
                  fontWeight: 'bold', 
                  fontSize: '1.1rem',
                  color: 'var(--accent-cyan)'
                }}>
                  {player.points}
                </div>
                <div style={{ color: 'var(--text-muted)' }}>
                  <span style={{ color: 'var(--success)' }}>{player.wins}</span>
                  -
                  <span style={{ color: 'var(--error)' }}>{player.losses}</span>
                  {player.draws > 0 && <span style={{ color: 'var(--warning)' }}> ({player.draws}d)</span>}
                </div>
                <div style={{ color: 'var(--text-muted)' }}>{player.played}</div>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="card" style={{ marginTop: '20px' }}>
        <h3 className="card-title">Top Stats</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
          <div style={{ padding: '15px', background: 'var(--bg-secondary)', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '5px' }}>🎯</div>
              <div style={{ fontWeight: 'bold', color: 'var(--accent-cyan)' }}>
              {top180s?.username || 'No results yet'}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Most 180s ({top180s?.['180s'] || 0})
            </div>
          </div>
          <div style={{ padding: '15px', background: 'var(--bg-secondary)', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '5px' }}>🐟</div>
            <div style={{ fontWeight: 'bold', color: 'var(--accent-cyan)' }}>
              {top170s?.username || 'No results yet'}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Big Fishes 170+ ({top170s?.['170s'] || 0})
            </div>
          </div>
          <div style={{ padding: '15px', background: 'var(--bg-secondary)', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '5px' }}>🏆</div>
            <div style={{ fontWeight: 'bold', color: 'var(--accent-cyan)' }}>
              {topCheckout?.username || 'No results yet'}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Highest Checkout ({topCheckout?.highestCheckout || 0})
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
