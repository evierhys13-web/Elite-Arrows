import { useState, useMemo, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

const DIVISION_EMOJIS = {
  'Elite': '👑',
  'Diamond': '💎',
  'Platinum': '💠',
  'Gold': '🥇',
  'Silver': '🥈',
  'Bronze': '🥉',
  'Development': '🌱',
  'Overall': '🏆'
}

export default function Table() {
  const [activeDivision, setActiveDivision] = useState('Overall')
  const { user, getAllUsers, getResults, dataRefreshTrigger } = useAuth()
  const [refreshKey, setRefreshKey] = useState(0)

  const divisions = ['Overall', 'Elite', 'Diamond', 'Platinum', 'Gold', 'Silver', 'Bronze', 'Development', 'Unassigned']

  useEffect(() => {
    setRefreshKey(prev => prev + 1)
  }, [dataRefreshTrigger])

  const allUsers = getAllUsers()
  const results = getResults()
  const approvedResults = results.filter(r => r.status === 'approved')

  const playerStats = useMemo(() => {
    const stats = {}
    
    allUsers.forEach(u => {
      stats[u.id] = {
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        legsWon: 0,
        legsLost: 0,
        points: 0
      }
    })

    approvedResults.forEach(r => {
      if (stats[r.player1Id]) {
        stats[r.player1Id].played++
        stats[r.player1Id].legsWon += r.score1
        stats[r.player1Id].legsLost += r.score2
        
        if (r.score1 > r.score2) {
          stats[r.player1Id].wins++
          stats[r.player1Id].points += 3 + r.score1
        } else if (r.score1 === r.score2) {
          stats[r.player1Id].draws++
          stats[r.player1Id].points += 1 + r.score1
        } else {
          stats[r.player1Id].losses++
          stats[r.player1Id].points += r.score1
        }
      }
      
      if (stats[r.player2Id]) {
        stats[r.player2Id].played++
        stats[r.player2Id].legsWon += r.score2
        stats[r.player2Id].legsLost += r.score1
        
        if (r.score2 > r.score1) {
          stats[r.player2Id].wins++
          stats[r.player2Id].points += 3 + r.score2
        } else if (r.score2 === r.score1) {
          stats[r.player2Id].draws++
          stats[r.player2Id].points += 1 + r.score2
        } else {
          stats[r.player2Id].losses++
          stats[r.player2Id].points += r.score2
        }
      }
    })

    return stats
  }, [allUsers, approvedResults, refreshKey])

  const playersInDivision = activeDivision === 'Overall' 
    ? allUsers
        .map(p => ({
          ...p,
          displayDivision: p.division || 'Unassigned',
          stats: playerStats[p.id] || { played: 0, wins: 0, draws: 0, losses: 0, legsWon: 0, legsLost: 0, points: 0 }
        }))
        .sort((a, b) => {
          const aPoints = a.stats.points || 0
          const bPoints = b.stats.points || 0
          if (aPoints > 0 || bPoints > 0) {
            if (bPoints !== aPoints) return bPoints - aPoints
            const aLegDiff = a.stats.legsWon - a.stats.legsLost
            const bLegDiff = b.stats.legsWon - b.stats.legsLost
            return bLegDiff - aLegDiff
          }
          const aAvg = a.threeDartAverage || 0
          const bAvg = b.threeDartAverage || 0
          return bAvg - aAvg
        })
    : allUsers
        .filter(u => u.division === activeDivision)
        .map(p => ({
          ...p,
          displayDivision: p.division || 'Unassigned',
          stats: playerStats[p.id] || { played: 0, wins: 0, draws: 0, losses: 0, legsWon: 0, legsLost: 0, points: 0 }
        }))
        .sort((a, b) => {
          const aPoints = a.stats.points || 0
          const bPoints = b.stats.points || 0
          if (aPoints > 0 || bPoints > 0) {
            if (bPoints !== aPoints) return bPoints - aPoints
            const aLegDiff = a.stats.legsWon - a.stats.legsLost
            const bLegDiff = b.stats.legsWon - b.stats.legsLost
            return bLegDiff - aLegDiff
          }
          const aAvg = a.threeDartAverage || 0
          const bAvg = b.threeDartAverage || 0
          return bAvg - aAvg
        })

  const headerEmoji = DIVISION_EMOJIS[activeDivision] || DIVISION_EMOJIS['Overall']

  return (
    <div className="page" key={refreshKey}>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 className="page-title">League Table</h1>
        </div>
      </div>

      <div className="division-tabs">
        {divisions.map(div => (
          <button
            key={div}
            className={`division-tab ${activeDivision === div ? 'active' : ''}`}
            onClick={() => setActiveDivision(div)}
          >
            <span style={{ marginRight: '4px' }}>{DIVISION_EMOJIS[div] || DIVISION_EMOJIS['Overall']}</span>
            {div}
          </button>
        ))}
      </div>

      <div className="card">
        {playersInDivision.length === 0 ? (
          <div className="empty-state">
            <p>No players in this division yet</p>
          </div>
        ) : (
          <>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Player</th>
                    {activeDivision === 'Overall' && <th>Div</th>}
                    <th>P</th>
                    <th>W</th>
                    <th>D</th>
                    <th>L</th>
                    <th>+/-</th>
                    <th>LW</th>
                    <th>Pts</th>
                    <th>Avg</th>
                  </tr>
                </thead>
                <tbody>
                  {playersInDivision.map((player, index) => {
                    const legDiff = player.stats.legsWon - player.stats.legsLost
                    const isPromotion = index < 2
                    const isRelegation = index >= playersInDivision.length - 2
                    const isPromotionCandidate = activeDivision !== 'Overall' && activeDivision !== 'Unassigned' && isPromotion
                    const isRelegationCandidate = activeDivision !== 'Overall' && activeDivision !== 'Unassigned' && isRelegation && playersInDivision.length > 4
                    
                    return (
                      <tr key={player.id} style={{ 
                        background: player.id === user.id ? 'var(--bg-hover)' : 'transparent',
                        borderLeft: isPromotionCandidate ? '3px solid #22c55e' : isRelegationCandidate ? '3px solid #ef4444' : 'none'
                      }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {index + 1}
                            {isPromotionCandidate && (
                              <span style={{ color: '#22c55e', fontWeight: 'bold' }}>↑</span>
                            )}
                            {isRelegationCandidate && (
                              <span style={{ color: '#ef4444', fontWeight: 'bold' }}>↓</span>
                            )}
                          </div>
                        </td>
                        <td>
                          {player.dartCounterUsername || player.username}
                          {player.id === user.id && (
                            <span className="admin-badge" style={{ marginLeft: '4px' }}>You</span>
                          )}
                          {player.isAdmin && (
                            <span className="admin-badge" style={{ marginLeft: '4px', background: 'var(--accent-cyan)' }}>A</span>
                          )}
                        </td>
                        {activeDivision === 'Overall' && (
                          <td>
                            <span>{DIVISION_EMOJIS[player.displayDivision]}</span>
                          </td>
                        )}
                        <td>{player.stats.played}</td>
                        <td>{player.stats.wins}</td>
                        <td>{player.stats.draws}</td>
                        <td>{player.stats.losses}</td>
                        <td style={{ color: legDiff >= 0 ? 'var(--success)' : 'var(--error)' }}>
                          {legDiff > 0 ? '+' : ''}{legDiff}
                        </td>
                        <td>{player.stats.legsWon}</td>
                        <td style={{ fontWeight: '600' }}>{player.stats.points}</td>
                        <td>{player.threeDartAverage?.toFixed(2) || 0}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: '16px', marginTop: '12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <span style={{ color: '#22c55e', fontWeight: 'bold' }}>↑</span>
              <span>Promotion Zone</span>
              <span style={{ color: '#ef4444', fontWeight: 'bold' }}>↓</span>
              <span>Relegation Zone</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}