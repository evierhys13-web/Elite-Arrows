import { useAuth } from '../context/AuthContext'

export default function Results() {
  const allResults = JSON.parse(localStorage.getItem('eliteArrowsResults') || '[]')
  const approvedResults = allResults.filter(r => r.status === 'approved')

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Results</h1>
      </div>

      <div className="card">
        {approvedResults.length === 0 ? (
          <div className="empty-state">
            <p>No approved results yet</p>
          </div>
        ) : (
          approvedResults.map(result => (
            <div key={result.id} className="result-item">
              <div>
                <div className="result-players">
                  <span>{result.player1}</span>
                  <span className="result-score">{result.score1} - {result.score2}</span>
                  <span>{result.player2}</span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {result.division} • {result.date}
                </div>
                {result.player1Stats && (
                  <div style={{ fontSize: '0.8rem', marginTop: '8px', color: 'var(--accent-cyan)' }}>
                    {result.player1}: {result.player1Stats['180s'] || 0} x180s | HC: {result.player1Stats.highestCheckout || 0} | Double: {result.player1Stats.doubleSuccess || 0}%
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}