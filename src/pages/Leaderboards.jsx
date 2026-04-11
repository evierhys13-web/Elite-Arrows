import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Leaderboards() {
  const { user, getAllUsers } = useAuth()
  const [selectedDivision, setSelectedDivision] = useState('all')
  const [timeFilter, setTimeFilter] = useState('week')

  const allUsers = getAllUsers()
  const results = JSON.parse(localStorage.getItem('eliteArrowsResults') || '[]')
  const approvedResults = results.filter(r => r.status === 'approved')

  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const filteredResults = approvedResults.filter(r => {
    const resultDate = new Date(r.date)
    if (timeFilter === 'week') return resultDate >= weekAgo
    if (timeFilter === 'month') return resultDate >= monthAgo
    return true
  })

  const playerStats = {}

  allUsers.forEach(player => {
    playerStats[player.id] = {
      id: player.id,
      username: player.username,
      nickname: player.nickname,
      division: player.division || 'Gold',
      profilePicture: player.profilePicture,
      played: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      points: 0,
      legsWon: 0,
      legsLost: 0,
      '180s': 0,
      highestCheckout: 0,
      average: 0
    }
  })

  filteredResults.forEach(r => {
    if (playerStats[r.player1Id]) {
      const stats = playerStats[r.player1Id]
      stats.played++
      stats.legsWon += r.score1
      stats.legsLost += r.score2
      stats['180s'] += r.player1Stats?.['180s'] || 0
      if (r.player1Stats?.highestCheckout > stats.highestCheckout) {
        stats.highestCheckout = r.player1Stats.highestCheckout
      }
      if (r.score1 > r.score2) {
        stats.wins++
        stats.points += 3
      } else if (r.score1 < r.score2) {
        stats.losses++
      } else {
        stats.draws++
        stats.points += 1
      }
    }
    if (playerStats[r.player2Id]) {
      const stats = playerStats[r.player2Id]
      stats.played++
      stats.legsWon += r.score2
      stats.legsLost += r.score1
      stats['180s'] += r.player2Stats?.['180s'] || 0
      if (r.player2Stats?.highestCheckout > stats.highestCheckout) {
        stats.highestCheckout = r.player2Stats.highestCheckout
      }
      if (r.score2 > r.score1) {
        stats.wins++
        stats.points += 3
      } else if (r.score2 < r.score1) {
        stats.losses++
      } else {
        stats.draws++
        stats.points += 1
      }
    }
  })

  Object.values(playerStats).forEach(stats => {
    if (stats.played > 0) {
      stats.average = ((stats.legsWon / stats.played) * 100).toFixed(1)
    }
  })

  let leaderboard = Object.values(playerStats)
    .filter(p => p.played > 0)
    .sort((a, b) => b.points - a.points || b.wins - a.wins)

  if (selectedDivision !== 'all') {
    leaderboard = leaderboard.filter(p => p.division === selectedDivision)
  }

  const divisions = ['all', 'Elite', 'Diamond', 'Gold', 'Silver', 'Bronze']

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
              gridTemplateColumns: '60px 1fr 80px 80px 80px 60px',
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
              <div>Avg</div>
            </div>

            {leaderboard.map((player, index) => (
              <div 
                key={player.id}
                style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '60px 1fr 80px 80px 80px 60px',
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
                <div style={{ fontWeight: '600' }}>{player.average}%</div>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="card" style={{ marginTop: '20px' }}>
        <h3 className="card-title">Top Stats</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
          <div style={{ padding: '15px', background: 'var(--bg-secondary)', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '5px' }}>🎯</div>
            <div style={{ fontWeight: 'bold', color: 'var(--accent-cyan)' }}>
              {leaderboard.reduce((max, p) => p['180s'] > max['180s'] ? p : max, { '180s': 0 }).username}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Most 180s ({leaderboard.reduce((max, p) => p['180s'] > max['180s'] ? p : max, { '180s': 0 })['180s']})
            </div>
          </div>
          <div style={{ padding: '15px', background: 'var(--bg-secondary)', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '5px' }}>🏆</div>
            <div style={{ fontWeight: 'bold', color: 'var(--accent-cyan)' }}>
              {leaderboard.reduce((max, p) => p.wins > max.wins ? p : max, { wins: 0 }).username}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Most Wins ({leaderboard.reduce((max, p) => p.wins > max.wins ? p : max, { wins: 0 }).wins})
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}