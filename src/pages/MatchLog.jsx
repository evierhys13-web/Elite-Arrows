import { useAuth } from '../context/AuthContext'

export default function MatchLog() {
  const { user } = useAuth()

  const allResults = JSON.parse(localStorage.getItem('eliteArrowsResults') || '[]')
  const userMatches = allResults
    .filter(r => r.status === 'approved' && (r.player1Id === user.id || r.player2Id === user.id))
    .map(r => {
      const isPlayer1 = r.player1Id === user.id
      const win = isPlayer1 ? r.score1 > r.score2 : r.score2 > r.score1
      return {
        id: r.id,
        opponent: isPlayer1 ? r.player2 : r.player1,
        result: win ? 'Win' : (r.score1 === r.score2 ? 'Draw' : 'Loss'),
        score: isPlayer1 ? `${r.score1}-${r.score2}` : `${r.score2}-${r.score1}`,
        date: r.date,
        average: isPlayer1 ? user.threeDartAverage : 0
      }
    })

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Match Log</h1>
      </div>

      <div className="card">
        {userMatches.length === 0 ? (
          <div className="empty-state">
            <p>No matches played yet</p>
          </div>
        ) : (
          userMatches.map(match => (
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
                <span>Average: {match.average}</span>
                <span>{match.date}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}