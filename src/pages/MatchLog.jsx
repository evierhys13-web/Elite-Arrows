import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function MatchLog() {
  const { user, getAllUsers } = useAuth()
  const [activeTab, setActiveTab] = useState('played')
  
  const allResults = JSON.parse(localStorage.getItem('eliteArrowsResults') || '[]')
  const allUsers = getAllUsers()
  
  const leagueResults = allResults
    .filter(r => r.status === 'approved' && r.gameType === 'League' && (r.player1Id === user.id || r.player2Id === user.id))
    .map(r => {
      const isPlayer1 = r.player1Id === user.id
      const opponentUser = isPlayer1 ? allUsers.find(u => u.id === r.player2Id) : allUsers.find(u => u.id === r.player1Id)
      const win = isPlayer1 ? r.score1 > r.score2 : r.score2 > r.score1
      return {
        id: r.id,
        opponentId: isPlayer1 ? r.player2Id : r.player1Id,
        opponent: opponentUser?.username || 'Unknown',
        opponentDivision: opponentUser?.division || '',
        result: win ? 'Win' : (r.score1 === r.score2 ? 'Draw' : 'Loss'),
        score: isPlayer1 ? `${r.score1}-${r.score2}` : `${r.score2}-${r.score1}`,
        date: r.date,
        average: isPlayer1 ? user.threeDartAverage : 0
      }
    })

  const playedOpponentIds = leagueResults.map(m => m.opponentId)
  
  const allDivisionPlayers = allUsers.filter(u => u.id !== user.id && u.division === user.division)
  const opponentsToPlay = allDivisionPlayers.filter(p => !playedOpponentIds.includes(p.id))

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Match Log</h1>
      </div>

      <div className="division-tabs" style={{ marginBottom: '20px' }}>
        <button 
          className={`division-tab ${activeTab === 'played' ? 'active' : ''}`}
          onClick={() => setActiveTab('played')}
        >
          Played ({leagueResults.length})
        </button>
        <button 
          className={`division-tab ${activeTab === 'toPlay' ? 'active' : ''}`}
          onClick={() => setActiveTab('toPlay')}
        >
          To Play ({opponentsToPlay.length})
        </button>
      </div>

      {activeTab === 'played' && (
        <div className="card">
          {leagueResults.length === 0 ? (
            <div className="empty-state">
              <p>No league games played yet</p>
            </div>
          ) : (
            leagueResults.map(match => (
              <div key={match.id} className="match-log-item">
                <div className="match-log-header">
                  <span style={{ fontWeight: '600' }}>vs {match.opponent}</span>
                  <span 
                    className="match-log-result"
                    style={{ color: match.result === 'Win' ? 'var(--success)' : (match.result === 'Draw' ? 'var(--warning)' : 'var(--error)') }}
                  >
                    {match.result}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  <span>Score: {match.score}</span>
                  <span>{match.date}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'toPlay' && (
        <div className="card">
          {opponentsToPlay.length === 0 ? (
            <div className="empty-state">
              <p style={{ color: 'var(--success)' }}>All league games completed!</p>
            </div>
          ) : (
            opponentsToPlay.map(player => (
              <div key={player.id} style={{ 
                padding: '15px', 
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <span style={{ fontWeight: '600' }}>{player.username}</span>
                  <span style={{ color: 'var(--text-muted)', marginLeft: '10px' }}>({player.division})</span>
                </div>
                <span style={{ color: 'var(--accent-cyan)', fontSize: '0.85rem' }}>To Play</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}