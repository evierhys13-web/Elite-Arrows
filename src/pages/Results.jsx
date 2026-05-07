import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { db, setDoc, getDocs, doc, collection } from '../firebase'
import { derivePlayerStatsFromResults, getPersistedPlayerStats } from '../utils/playerStats'

export default function Results() {
  const { user, getAllUsers, getResults, updateResults, getFixtures, updateFixtures, updateOtherUser, triggerDataRefresh, dataRefreshTrigger, adminData, notifyUser } = useAuth()
  const [activeTab, setActiveTab] = useState('approved')
  const [refreshKey, setRefreshKey] = useState(0)
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    setRefreshKey(prev => prev + 1)
  }, [dataRefreshTrigger])
  
  const ADMIN_EMAILS = ['rhyshowe2023@outlook.com', 'dhineberry@yahoo.com']
  const isAdmin = user?.isAdmin || user?.isTournamentAdmin || ADMIN_EMAILS.includes(user?.email?.toLowerCase())
  const isSubscribed = user?.isSubscribed === true || isAdmin
  
  const allResults = getResults() || []
  const approvedResults = allResults.filter(r => String(r.status).toLowerCase() === 'approved').sort((a, b) => new Date(b.date) - new Date(a.date))
  const pendingResults = allResults.filter(r => String(r.status).toLowerCase() === 'pending').sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))

  const handleApprove = async (resultId) => {
    if (!confirm('Approve this match result?')) return
    try {
      const res = allResults.find(r => String(r.id) === String(resultId))
      if (!res) return
      const updated = { ...res, status: 'approved', approvedAt: new Date().toISOString() }
      await setDoc(doc(db, 'results', String(resultId)), updated, { merge: true })
      triggerDataRefresh('results')
      setSuccessMessage('Result Approved')
      setTimeout(() => setSuccessMessage(''), 1800)
    } catch (e) { alert(e.message) }
  }

  const handleReject = async (resultId) => {
    if (!confirm('Reject this match result?')) return
    try {
      const res = allResults.find(r => String(r.id) === String(resultId))
      if (!res) return
      const updated = { ...res, status: 'rejected', updatedAt: new Date().toISOString() }
      await setDoc(doc(db, 'results', String(resultId)), updated, { merge: true })
      triggerDataRefresh('results')
      setSuccessMessage('Result Rejected')
      setTimeout(() => setSuccessMessage(''), 1800)
    } catch (e) { alert(e.message) }
  }

  const renderResultCard = (result, isPending = false) => {
    const isWinner1 = result.score1 > result.score2
    const isWinner2 = result.score2 > result.score1
    const isMe = result.player1Id === user?.id || result.player2Id === user?.id

    return (
      <div key={result.id} className="card glass animate-fade-in" style={{
        padding: '20px',
        marginBottom: '16px',
        border: isMe ? '1.5px solid var(--accent-primary)' : '1px solid var(--border)',
        background: isMe ? 'rgba(124, 92, 252, 0.05)' : 'var(--bg-card)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {result.gameType} • {result.division || 'Unassigned'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {new Date(result.date).toLocaleDateString()}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '20px', marginBottom: '15px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: isWinner1 ? 'white' : 'var(--text-muted)' }}>{result.player1}</div>
            {isWinner1 && <div style={{ fontSize: '0.65rem', color: 'var(--success)', fontWeight: 900 }}>WINNER</div>}
          </div>
          <div style={{
            background: 'var(--bg-primary)',
            padding: '8px 16px',
            borderRadius: '12px',
            fontSize: '1.5rem',
            fontWeight: 900,
            display: 'flex',
            gap: '12px',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)'
          }}>
            <span style={{ color: isWinner1 ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>{result.score1}</span>
            <span style={{ color: 'var(--border)' }}>-</span>
            <span style={{ color: isWinner2 ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>{result.score2}</span>
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: isWinner2 ? 'white' : 'var(--text-muted)' }}>{result.player2}</div>
            {isWinner2 && <div style={{ fontSize: '0.65rem', color: 'var(--success)', fontWeight: 900 }}>WINNER</div>}
          </div>
        </div>

        {(result.player1Stats || result.player2Stats) && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '10px',
            paddingTop: '15px',
            borderTop: '1px solid var(--border)',
            fontSize: '0.8rem'
          }}>
            <div style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
              {result.player1Stats?.['180s'] > 0 && <span style={{ color: '#fbbf24', marginRight: '8px' }}>★ {result.player1Stats['180s']}x180</span>}
              HC: <span style={{ color: 'white' }}>{result.player1Stats?.highestCheckout || 0}</span>
            </div>
            <div style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
              HC: <span style={{ color: 'white' }}>{result.player2Stats?.highestCheckout || 0}</span>
              {result.player2Stats?.['180s'] > 0 && <span style={{ color: '#fbbf24', marginLeft: '8px' }}>{result.player2Stats['180s']}x180 ★</span>}
            </div>
          </div>
        )}

        {isPending && isAdmin && (
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button className="btn btn-primary btn-sm btn-block" onClick={() => handleApprove(result.id)}>Approve</button>
            <button className="btn btn-danger btn-sm btn-block" onClick={() => handleReject(result.id)}>Reject</button>
          </div>
        )}
      </div>
    )
  }

  if (!isSubscribed) {
    return (
      <div className="page animate-fade-in">
        <div className="page-header"><h1 className="page-title">League Results</h1></div>
        <div className="card glass" style={{ textAlign: 'center', padding: '60px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '20px' }}>🔒</div>
          <h2 style={{ marginBottom: '10px' }}>Access Restricted</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Please subscribe to the Elite Arrows Pass to view full match history and stats.</p>
          <button className="btn btn-primary" onClick={() => navigate('/subscription')}>View Passes</button>
        </div>
      </div>
    )
  }

  return (
    <div className="page animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
      {successMessage && (
        <div className="modal-overlay" style={{ zIndex: 11000 }}>
          <div className="card glass" style={{ border: '2px solid var(--success)', padding: '40px', textAlign: 'center' }}>
            <h2 style={{ color: 'var(--success)', marginBottom: '10px' }}>Success</h2>
            <p>{successMessage}</p>
          </div>
        </div>
      )}

      <div className="page-header" style={{ marginBottom: '30px' }}>
        <h1 className="page-title text-gradient" style={{ fontSize: '2.5rem' }}>League Results</h1>
        <p style={{ color: 'var(--text-muted)' }}>Official scores and player statistics</p>
      </div>

      {isAdmin && (
        <div className="division-tabs" style={{ marginBottom: '24px' }}>
          <button className={`division-tab ${activeTab === 'approved' ? 'active' : ''}`} onClick={() => setActiveTab('approved')}>Approved</button>
          <button className={`division-tab ${activeTab === 'pending' ? 'active' : ''}`} onClick={() => setActiveTab('pending')}>
            Pending {pendingResults.length > 0 && <span style={{ marginLeft: '6px', background: 'white', color: 'black', padding: '1px 6px', borderRadius: '10px', fontSize: '0.7rem' }}>{pendingResults.length}</span>}
          </button>
        </div>
      )}

      <div className="results-container">
        {activeTab === 'pending' ? (
          pendingResults.length === 0 ? <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>No results awaiting review.</p> :
          pendingResults.map(r => renderResultCard(r, true))
        ) : (
          approvedResults.length === 0 ? <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>No match history found.</p> :
          approvedResults.map(r => renderResultCard(r, false))
        )}
      </div>
    </div>
  )
}
