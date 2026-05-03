import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getResultPlayerId, isLeagueResult } from '../utils/leagueResults'

export default function MatchLog() {
  const { user, getAllUsers, getFixtures, getResults } = useAuth()
  const [activeTab, setActiveTab] = useState('played')
  
  const allResults = getResults()
  const allUsers = getAllUsers()
  const fixtures = getFixtures()
  const fixturesById = Object.fromEntries(fixtures.map(fixture => [String(fixture.id), fixture]))
  
  const leagueResults = allResults
    .filter(r => {
      const player1Id = getResultPlayerId(r, 1, allUsers)
      const player2Id = getResultPlayerId(r, 2, allUsers)
      return (
        String(r.status || '').toLowerCase() === 'approved' &&
        isLeagueResult(r, fixturesById) &&
        (String(player1Id) === String(user.id) || String(player2Id) === String(user.id))
      )
    })
    .map(r => {
      const player1Id = getResultPlayerId(r, 1, allUsers)
      const player2Id = getResultPlayerId(r, 2, allUsers)
      const isPlayer1 = String(player1Id) === String(user.id)
      const opponentId = isPlayer1 ? player2Id : player1Id
      const opponentUser = allUsers.find(u => String(u.id) === String(opponentId))
      const win = isPlayer1 ? r.score1 > r.score2 : r.score2 > r.score1
      return {
        id: r.id,
        opponentId,
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
