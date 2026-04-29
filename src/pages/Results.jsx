import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { db, setDoc, deleteDoc, doc } from '../firebase'

export default function Results() {
  const { user, getResults, triggerDataRefresh, dataRefreshTrigger, notifyUser, notifyAllSubscribers } = useAuth()
  const [activeTab, setActiveTab] = useState('approved')
  const [refreshKey, setRefreshKey] = useState(0)
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    setRefreshKey(prev => prev + 1)
  }, [dataRefreshTrigger])
  
  const ADMIN_EMAILS = ['rhyshowe2023@outlook.com', 'dhineberry@yahoo.com']
  const isEmailAdmin = ADMIN_EMAILS.includes(user?.email?.toLowerCase())
  const isDbAdmin = user?.isAdmin === true
  const isTournamentAdmin = user?.isTournamentAdmin === true
  const isAdmin = isEmailAdmin || isDbAdmin || isTournamentAdmin
  const isSubscribed = user?.isSubscribed === true
  
  const allResults = getResults()
  const approvedResults = allResults.filter(r => r.status === 'approved')
  const pendingResults = allResults.filter(r => r.status === 'pending')
  
  const handleApprove = async (resultId) => {
    if (!confirm('Approve this result?')) return
    
    const resultIdStr = String(resultId)
    const results = JSON.parse(localStorage.getItem('eliteArrowsResults') || '[]')
    const index = results.findIndex(r => String(r.id) === resultIdStr)
    if (index === -1) {
      alert('Result not found')
      return
    }
    const result = results[index]
    const resultDocId = String(result.firestoreId || result.id)
    results[index].status = 'approved'
    localStorage.setItem('eliteArrowsResults', JSON.stringify(results))
    
    await setDoc(doc(db, 'results', resultDocId), { status: 'approved' }, { merge: true })
    if (resultDocId !== resultIdStr) {
      await deleteDoc(doc(db, 'results', resultIdStr)).catch(() => {})
    }
    
    triggerDataRefresh('results')
    setSuccessMessage('You have successfully approved a result')
    setTimeout(() => {
      setSuccessMessage('')
    }, 1800)
  }
  
  const handleReject = async (resultId) => {
    if (!confirm('Reject this result?')) return
    
    const resultIdStr = String(resultId)
    const results = JSON.parse(localStorage.getItem('eliteArrowsResults') || '[]')
    const index = results.findIndex(r => String(r.id) === resultIdStr)
    if (index === -1) {
      alert('Result not found')
      return
    }
    const result = results[index]
    const resultDocId = String(result.firestoreId || result.id)
    results[index].status = 'rejected'
    localStorage.setItem('eliteArrowsResults', JSON.stringify(results))
    
    await setDoc(doc(db, 'results', resultDocId), { status: 'rejected' }, { merge: true })
    if (resultDocId !== resultIdStr) {
      await deleteDoc(doc(db, 'results', resultIdStr)).catch(() => {})
    }
    
    triggerDataRefresh('results')
    setSuccessMessage('You have successfully rejected a result')
    setTimeout(() => {
      setSuccessMessage('')
    }, 1800)
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
      {successMessage && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10000,
          background: 'rgba(0,0,0,0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            width: 'min(420px, 100%)',
            background: 'var(--bg-secondary)',
            border: '2px solid var(--success)',
            borderRadius: '12px',
            padding: '28px',
            textAlign: 'center',
            boxShadow: '0 12px 40px rgba(0,0,0,0.45)'
          }}>
            <div style={{ fontSize: '2rem', color: 'var(--success)', fontWeight: 800, marginBottom: '10px' }}>Success</div>
            <p style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.05rem', fontWeight: 600 }}>
              {successMessage}
            </p>
          </div>
        </div>
      )}
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
            pendingResults.map(result => {
                const userWon = (result.player1Id === user.id && result.score1 > result.score2) || (result.player2Id === user.id && result.score2 > result.score1)
                const userLost = (result.player1Id === user.id && result.score1 < result.score2) || (result.player2Id === user.id && result.score2 < result.score1)
                return (
                  <div 
                    key={result.id} 
                    className="result-item" 
                    style={{ 
                      marginBottom: '15px',
                      border: userWon ? '2px solid #22c55e' : userLost ? '2px solid #ef4444' : '1px solid var(--accent-cyan)',
                      boxShadow: userWon ? '0 0 10px rgba(34, 197, 94, 0.4)' : userLost ? '0 0 10px rgba(239, 68, 68, 0.4)' : 'none'
                    }}
                  >
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
                )
              })
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
