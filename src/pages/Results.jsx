import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Results() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('approved')
  
  const ADMIN_EMAILS = ['rhyshowe2023@outlook.com', 'dhineberry@yahoo.com']
  const isEmailAdmin = ADMIN_EMAILS.includes(user?.email?.toLowerCase())
  const isDbAdmin = user?.isAdmin === true
  const isTournamentAdmin = user?.isTournamentAdmin === true
  const isAdmin = isEmailAdmin || isDbAdmin || isTournamentAdmin
  const isSubscribed = user?.isSubscribed === true
  
  const allResults = JSON.parse(localStorage.getItem('eliteArrowsResults') || '[]')
  const approvedResults = allResults.filter(r => r.status === 'approved')
  const pendingResults = allResults.filter(r => r.status === 'pending')
  
  const handleApprove = (resultId) => {
    const results = JSON.parse(localStorage.getItem('eliteArrowsResults') || '[]')
    const index = results.findIndex(r => r.id === resultId)
    if (index !== -1) {
      results[index].status = 'approved'
      localStorage.setItem('eliteArrowsResults', JSON.stringify(results))
      alert('Result approved!')
    }
  }
  
  const handleReject = (resultId) => {
    if (!confirm('Are you sure you want to reject this result?')) return
    const results = JSON.parse(localStorage.getItem('eliteArrowsResults') || '[]')
    const index = results.findIndex(r => r.id === resultId)
    if (index !== -1) {
      results[index].status = 'rejected'
      localStorage.setItem('eliteArrowsResults', JSON.stringify(results))
      alert('Result rejected.')
    }
  }

  if (!isSubscribed && !isAdmin) {
    return (
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Results</h1>
        </div>
        <div className="card">
          <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
            Subscribe to view results.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Results</h1>
      </div>

      {isAdmin && (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <button 
            className={`btn ${activeTab === 'approved' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('approved')}
          >
            Approved ({approvedResults.length})
          </button>
          <button 
            className={`btn ${activeTab === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('pending')}
          >
            Pending Approval ({pendingResults.length})
          </button>
        </div>
      )}

      {activeTab === 'pending' && isAdmin && (
        <div className="card">
          {pendingResults.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No pending results</p>
          ) : (
            pendingResults.map(result => (
              <div key={result.id} className="result-item" style={{ border: '1px solid var(--accent-cyan)', marginBottom: '15px' }}>
                <div>
                  <div className="result-players">
                    <span>{result.player1}</span>
                    <span className="result-score">{result.score1} - {result.score2}</span>
                    <span>{result.player2}</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {result.division} • {result.gameType} • {result.date}
                  </div>
                  {result.player1Stats && (
                    <div style={{ fontSize: '0.8rem', marginTop: '8px', color: 'var(--accent-cyan)' }}>
                      {result.player1}: {result.player1Stats['180s'] || 0} x180s | HC: {result.player1Stats.highestCheckout || 0} | Double: {result.player1Stats.doubleSuccess || 0}%
                      <br />
                      {result.player2}: {result.player2Stats['180s'] || 0} x180s | HC: {result.player2Stats.highestCheckout || 0} | Double: {result.player2Stats.doubleSuccess || 0}%
                    </div>
                  )}
                  {result.proofImage && (
                    <div style={{ marginTop: '10px' }}>
                      <p style={{ fontSize: '0.85rem', marginBottom: '5px' }}>Proof:</p>
                      <img 
                        src={result.proofImage} 
                        alt="Proof" 
                        style={{ maxWidth: '200px', maxHeight: '150px', borderRadius: '8px' }}
                      />
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                    <button className="btn btn-success" onClick={() => handleApprove(result.id)}>
                      Approve
                    </button>
                    <button className="btn btn-danger" onClick={() => handleReject(result.id)}>
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'approved' && (
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
                    {result.division} • {result.gameType} • {result.date}
                  </div>
                  {result.player1Stats && (
                    <div style={{ fontSize: '0.8rem', marginTop: '8px', color: 'var(--accent-cyan)' }}>
                      {result.player1}: {result.player1Stats['180s'] || 0} x180s | HC: {result.player1Stats.highestCheckout || 0} | Double: {result.player1Stats.doubleSuccess || 0}%
                      <br />
                      {result.player2}: {result.player2Stats['180s'] || 0} x180s | HC: {result.player2Stats.highestCheckout || 0} | Double: {result.player2Stats.doubleSuccess || 0}%
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
