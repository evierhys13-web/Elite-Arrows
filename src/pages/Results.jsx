import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { db, setDoc, getDoc, getDocs, deleteDoc, doc, collection, query, where } from '../firebase'
import { getNormalizedResultSignature, getResultOverrideKeys, getResultSignature } from '../utils/resultIdentity'

export default function Results() {
  const { user, getResults, updateResults, getFixtures, updateFixtures, triggerDataRefresh, dataRefreshTrigger, adminData, updateAdminData, notifyUser, notifyAllSubscribers } = useAuth()
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
  const approvedResults = allResults.filter(r => String(r.status).toLowerCase() === 'approved')
  const pendingResults = allResults.filter(r => String(r.status).toLowerCase() === 'pending')

  const getResultDocIds = async (result) => {
    const logicalId = result.id ? String(result.id) : null
    const preferredId = result.firestoreId ? String(result.firestoreId) : logicalId
    const fallbackIds = new Set([logicalId, preferredId].filter(Boolean))
    const docIds = new Set()

    const snapshot = await getDocs(collection(db, 'results'))
    snapshot.docs.forEach(docSnap => {
      const data = docSnap.data()
      const dataIds = [data.id, data.firestoreId, docSnap.id].filter(Boolean).map(String)
      const sameLogicalId = [logicalId, preferredId].filter(Boolean).some(id => dataIds.includes(id))
      const sameFixture = result.fixtureId && String(data.fixtureId || '') === String(result.fixtureId)
      const sameCupMatch = result.cupId && result.matchId &&
        String(data.cupId || '') === String(result.cupId) &&
        String(data.matchId || '') === String(result.matchId)
      const samePlayersById =
        result.player1Id &&
        result.player2Id &&
        String(data.player1Id) === String(result.player1Id) &&
        String(data.player2Id) === String(result.player2Id)
      const samePlayersByIdReversed =
        result.player1Id &&
        result.player2Id &&
        String(data.player1Id) === String(result.player2Id) &&
        String(data.player2Id) === String(result.player1Id)
      const samePlayersByName =
        result.player1 &&
        result.player2 &&
        String(data.player1 || '').trim().toLowerCase() === String(result.player1).trim().toLowerCase() &&
        String(data.player2 || '').trim().toLowerCase() === String(result.player2).trim().toLowerCase()
      const samePlayersByNameReversed =
        result.player1 &&
        result.player2 &&
        String(data.player1 || '').trim().toLowerCase() === String(result.player2).trim().toLowerCase() &&
        String(data.player2 || '').trim().toLowerCase() === String(result.player1).trim().toLowerCase()
      const sameGame =
        (
          ((samePlayersById || samePlayersByName) &&
            String(data.score1) === String(result.score1) &&
            String(data.score2) === String(result.score2)) ||
          ((samePlayersByIdReversed || samePlayersByNameReversed) &&
            String(data.score1) === String(result.score2) &&
            String(data.score2) === String(result.score1))
        ) &&
        data.date === result.date &&
        data.gameType === result.gameType

      if (sameLogicalId || sameFixture || sameCupMatch || sameGame) {
        docIds.add(docSnap.id)
      }
    })

    return Array.from(docIds.size ? docIds : fallbackIds)
  }

  const persistResultStatusOverride = async (result, status) => {
    let storedOverrides = {}
    try {
      storedOverrides = JSON.parse(localStorage.getItem('eliteArrowsResultStatusOverrides') || '{}')
    } catch (error) {
      storedOverrides = {}
    }

    const nextOverrides = {
      ...(adminData.resultStatusOverrides || {}),
      ...storedOverrides
    }
    const override = {
      status,
      resultId: result.id ? String(result.id) : String(result.firestoreId || ''),
      firestoreId: result.firestoreId || null,
      signature: getResultSignature(result),
      normalizedSignature: getNormalizedResultSignature(result),
      updatedAt: new Date().toISOString()
    }

    getResultOverrideKeys(result).forEach(key => {
      nextOverrides[key] = override
    })
    localStorage.setItem('eliteArrowsResultStatusOverrides', JSON.stringify(nextOverrides))
    await updateAdminData({ resultStatusOverrides: nextOverrides })
  }

  const syncFixtureAfterResultReview = async (result, reviewStatus) => {
    const fixtures = getFixtures()
    const fixtureIndex = fixtures.findIndex(fixture => (
      String(fixture.id) === String(result.fixtureId || '') ||
      (
        result.cupId &&
        result.matchId &&
        String(fixture.cupId || '') === String(result.cupId) &&
        String(fixture.matchId || '') === String(result.matchId)
      )
    ))
    if (fixtureIndex === -1) return

    const isApproved = reviewStatus === 'approved'
    const updatedFixture = {
      ...fixtures[fixtureIndex],
      status: isApproved ? 'approved' : 'accepted',
      updatedAt: new Date().toISOString(),
      resultId: isApproved ? result.id : null,
      submittedResultId: isApproved ? result.id : null,
      score1: isApproved ? Number(result.score1) : null,
      score2: isApproved ? Number(result.score2) : null
    }

    const updatedFixtures = [...fixtures]
    updatedFixtures[fixtureIndex] = updatedFixture
    updateFixtures(updatedFixtures)
    await setDoc(doc(db, 'fixtures', String(updatedFixture.id)), updatedFixture, { merge: true })
    triggerDataRefresh('fixtures')
  }
  
  const handleApprove = async (resultId) => {
    if (!confirm('Approve this result?')) return
    
    const resultIdStr = String(resultId)
    const results = [...getResults()]
    const index = results.findIndex(r => String(r.id) === resultIdStr)
    if (index === -1) {
      alert('Result not found')
      return
    }
    const result = results[index]
    const reviewedAt = new Date().toISOString()
    const updatedResult = {
      ...result,
      status: 'approved',
      approvedAt: reviewedAt,
      updatedAt: reviewedAt
    }
    const resultDocIds = await getResultDocIds(updatedResult)
    results[index] = updatedResult
    updateResults(results)
    
    await Promise.all(resultDocIds.map(resultDocId =>
      setDoc(doc(db, 'results', resultDocId), { ...updatedResult, firestoreId: resultDocId }, { merge: true })
    ))
    await syncFixtureAfterResultReview(updatedResult, 'approved')
    await persistResultStatusOverride(updatedResult, 'approved')
    
    triggerDataRefresh('results')
    setSuccessMessage('You have successfully approved a result')
    setTimeout(() => {
      setSuccessMessage('')
    }, 1800)
  }
  
  const handleReject = async (resultId) => {
    if (!confirm('Reject this result?')) return
    
    const resultIdStr = String(resultId)
    const results = [...getResults()]
    const index = results.findIndex(r => String(r.id) === resultIdStr)
    if (index === -1) {
      alert('Result not found')
      return
    }
    const result = results[index]
    const updatedResult = { ...result, status: 'rejected', updatedAt: new Date().toISOString() }
    const resultDocIds = await getResultDocIds(updatedResult)
    results[index] = updatedResult
    updateResults(results)
    
    await Promise.all(resultDocIds.map(resultDocId =>
      setDoc(doc(db, 'results', resultDocId), { ...updatedResult, firestoreId: resultDocId }, { merge: true })
    ))
    await syncFixtureAfterResultReview(updatedResult, 'rejected')
    await persistResultStatusOverride(updatedResult, 'rejected')
    
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
