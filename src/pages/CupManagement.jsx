import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { db, doc, setDoc, deleteDoc, getDoc } from '../firebase'

function CupManagement() {
  const { getAllUsers, getCups, getFixtures, getResults, advanceCupBracket, triggerDataRefresh, dataRefreshTrigger } = useAuth()
  const [refreshKey, setRefreshKey] = useState(0)
  const [cups, setCups] = useState([])
  const [allCupFixtures, setAllCupFixtures] = useState([])
  const [allCupResults, setAllCupResults] = useState([])
  const [showResultModal, setShowResultModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const syncInProgressRef = useRef(false)
  const [resultForm, setResultForm] = useState({
    cup: null,
    match: null,
    score1: '',
    score2: '',
    p1_180s: '0',
    p2_180s: '0',
    p1_checkout: '0',
    p2_checkout: '0',
    p1_doubles: '0',
    p2_doubles: '0'
  })
  const allUsers = getAllUsers()

  const handleSyncExistingWinners = async (silent = false) => {
    if (syncInProgressRef.current) return
    if (!silent && !window.confirm('This will scan all approved Cup results and ensure winners are advanced in their brackets and fixtures are created for ready matches. Continue?')) return
    syncInProgressRef.current = true

    setIsSubmitting(true)
    setSyncResult(null)
    let totalAdvanced = 0
    let errors = 0
    try {
      const allCups = getCups()
      const allResults = getResults().filter(r => String(r.status).toLowerCase() === 'approved')

      for (const cup of allCups) {
        try {
          await runTransaction(db, async (transaction) => {
            const cupRef = doc(db, 'cups', String(cup.id))
            const cupSnap = await transaction.get(cupRef)
            if (!cupSnap.exists()) return

            let cupData = cupSnap.data()
            let matches = [...(cupData.matches || [])]
            let changed = true
            let cupChanges = 0

            const cupResults = allResults.filter(r => String(r.cupId) === String(cup.id))

            // Keep propagating changes (results and byes) until no more advancements are possible
            while (changed) {
              changed = false

              // 1. Check for missing result advancements
              for (const res of cupResults) {
                const mIdx = matches.findIndex(m => String(m.id) === String(res.matchId))
                if (mIdx !== -1 && !matches[mIdx].winner) {
                  const winnerId = res.score1 > res.score2 ? res.player1Id : res.player2Id
                  if (winnerId) {
                    const m = matches[mIdx]
                    const isP1 = String(res.player1Id) === String(m.player1)
                    matches[mIdx] = {
                      ...m,
                      winner: winnerId,
                      score1: isP1 ? res.score1 : res.score2,
                      score2: isP1 ? res.score2 : res.score1,
                      resultId: res.id
                    }

                    // propagate winner to next match
                    if (m.nextMatchId) {
                      const nextMIdx = matches.findIndex(nm => String(nm.id) === String(m.nextMatchId))
                      if (nextMIdx !== -1) {
                         const siblings = matches
                          .filter(sm => Number(sm.round) === Number(m.round) && String(sm.nextMatchId) === String(m.nextMatchId))
                          .sort((a,b) => (Number(a.matchNum)||0) - (Number(b.matchNum)||0))

                         const pos = siblings.findIndex(sm => String(sm.id) === String(m.id))
                         if (pos !== -1) {
                            const target = pos === 0 ? 'player1' : 'player2'
                            if (matches[nextMIdx][target] !== winnerId) {
                               matches[nextMIdx] = { ...matches[nextMIdx], [target]: winnerId }
                               changed = true
                            }
                         }
                      }
                    }
                    changed = true
                    cupChanges++
                  }
                }
              }

              // 2. Check for and advance Byes (matches with only one player)
              for (let i = 0; i < matches.length; i++) {
                const m = matches[i]
                if (m.winner) continue
                const isBye = (m.player1 && !m.player2) || (!m.player1 && m.player2)
                if (isBye) {
                  const winnerId = m.player1 || m.player2
                  matches[i] = { ...m, winner: winnerId, score1: 1, score2: 0 }

                  // propagate bye winner to next match
                  if (m.nextMatchId) {
                    const nextMIdx = matches.findIndex(nm => String(nm.id) === String(m.nextMatchId))
                    if (nextMIdx !== -1) {
                       const siblings = matches
                        .filter(sm => Number(sm.round) === Number(m.round) && String(sm.nextMatchId) === String(m.nextMatchId))
                        .sort((a,b) => (Number(a.matchNum)||0) - (Number(b.matchNum)||0))

                       const pos = siblings.findIndex(sm => String(sm.id) === String(m.id))
                       if (pos !== -1) {
                          const target = pos === 0 ? 'player1' : 'player2'
                          if (matches[nextMIdx][target] !== winnerId) {
                             matches[nextMIdx] = { ...matches[nextMIdx], [target]: winnerId }
                             changed = true
                          }
                       }
                    }
                  }
                  changed = true
                  cupChanges++
                }
              }
            }

            if (cupChanges > 0) {
              const allComplete = matches.every(m => (m.player1 && m.player2) ? m.winner : true)
              let currentRound = cupData.currentRound || 1
              // Update currentRound if necessary
              while (matches.filter(m => Number(m.round) === currentRound).every(m => m.winner)) {
                const maxRound = Math.max(...matches.map(m => m.round))
                if (currentRound < maxRound) currentRound++
                else break
              }

              transaction.update(cupRef, { matches, status: allComplete ? 'completed' : 'active', currentRound })
              totalAdvanced += cupChanges

              // 3. Create fixtures for any matches that are now "ready" (have 2 players but no winner)
              for (const m of matches) {
                if (m.player1 && m.player2 && !m.winner) {
                   const fId = `cup_${cup.id}_match_${m.id}`
                   const fRef = doc(db, 'fixtures', fId)
                   const fSnap = await transaction.get(fRef)
                   if (!fSnap.exists()) {
                      const fmt = cupData.roundFormats?.[m.round] || { startScore: 501, bestOf: 3 }
                      transaction.set(fRef, {
                        id: fId,
                        cupId: parseInt(cup.id),
                        cupName: cupData.name,
                        startScore: fmt.startScore,
                        bestOf: fmt.bestOf,
                        firstTo: Math.ceil(fmt.bestOf / 2),
                        player1: m.player1,
                        player1Id: m.player1,
                        player2: m.player2,
                        player2Id: m.player2,
                        matchId: m.id,
                        round: m.round,
                        status: 'pending',
                        createdAt: new Date().toISOString()
                      })
                   }
                }
              }
            }
          })
        } catch (e) {
          console.error(`Sync error for cup ${cup.id}:`, e)
          errors++
        }
      }

      if (!silent) {
        alert(`Sync complete!\nProcessed advancements: ${totalAdvanced}\nErrors: ${errors}`)
      }
      setSyncResult({ advanced: totalAdvanced, skipped: 0, errors })
      triggerDataRefresh('all')
      setRefreshKey(prev => prev + 1)
    } catch (err) {
      if (!silent) alert('Sync failed: ' + err.message)
    } finally {
      setIsSubmitting(false)
      syncInProgressRef.current = false
    }
  }

  useEffect(() => {
    try {
      const cupsData = getCups()
      setCups(Array.isArray(cupsData) ? cupsData : [])
      setAllCupFixtures(getFixtures())
      setAllCupResults(getResults())
    } catch (err) {
      console.error('Error loading data in CupManagement:', err)
    }
  }, [refreshKey, dataRefreshTrigger, getCups, getFixtures, getResults])

  // Auto-sync once on mount (silently) to fix any un-advanced results
  useEffect(() => {
    const autoSynced = sessionStorage.getItem('cupManagementAutoSynced')
    if (!autoSynced) {
      sessionStorage.setItem('cupManagementAutoSynced', 'true')
      handleSyncExistingWinners(true)
    }
  }, [])

  const getPlayerName = (id) => {
    if (!id) return 'TBD'
    const user = allUsers.find(u => String(u.id) === String(id))
    return user?.username || 'Unknown'
  }

  const getRoundName = (round, totalRounds) => {
    if (Number(round) === Number(totalRounds)) return 'Final'
    if (Number(round) === Number(totalRounds) - 1) return 'Semi-Final'
    if (Number(round) === Number(totalRounds) - 2) return 'Quarter-Final'
    return `Round ${round}`
  }

  const enterResult = (cup, match) => {
    setResultForm({
      cup,
      match,
      score1: '',
      score2: '',
      p1_180s: '0',
      p2_180s: '0',
      p1_checkout: '0',
      p2_checkout: '0',
      p1_doubles: '0',
      p2_doubles: '0'
    })
    setShowResultModal(true)
  }

  const resetResult = async (cup, match) => {
    if (!window.confirm('Reset this match result? This will remove the winner and clear the score.')) return

    try {
      const cupRef = doc(db, 'cups', String(cup.id))
      const cupSnap = await getDoc(cupRef)
      if (!cupSnap.exists()) return alert('Cup not found in database.')

      const cupData = cupSnap.data()
      const updatedMatches = cupData.matches.map(m => {
        if (String(m.id) === String(match.id)) {
          return { ...m, winner: null, score1: null, score2: null, resultId: null }
        }
        if (m.round > match.round) {
           const matchPlayer1 = String(match.player1)
           const matchPlayer2 = String(match.player2)
           if (String(m.player1) === matchPlayer1 || String(m.player1) === matchPlayer2) m.player1 = null
           if (String(m.player2) === matchPlayer1 || String(m.player2) === matchPlayer2) m.player2 = null
        }
        return m
      })

      const updatedCup = { ...cupData, matches: updatedMatches }
      await setDoc(cupRef, updatedCup, { merge: true })

      // Sync localStorage
      const localCups = JSON.parse(localStorage.getItem('eliteArrowsCups') || '[]')
      const localIdx = localCups.findIndex(c => String(c.id) === String(cup.id))
      if (localIdx !== -1) {
        localCups[localIdx] = updatedCup
        localStorage.setItem('eliteArrowsCups', JSON.stringify(localCups))
      }
      setCups(prev => {
        const next = [...prev]
        const idx = next.findIndex(c => String(c.id) === String(cup.id))
        if (idx !== -1) next[idx] = updatedCup
        return next
      })

      alert('Result reset successfully.')
      triggerDataRefresh('all')
      setRefreshKey(prev => prev + 1)
    } catch (err) {
      alert('Reset error: ' + err.message)
    }
  }

  const submitResult = async () => {
    if (isSubmitting) return
    const { cup, match, score1, score2, p1_180s, p2_180s, p1_checkout, p2_checkout, p1_doubles, p2_doubles } = resultForm

    if (!cup || !match || (!match.player1 && !match.player2)) {
      alert('Error: Bracket data is incomplete. Please refresh and try again.')
      return
    }

    const s1 = parseInt(score1) || 0
    const s2 = parseInt(score2) || 0
    
    if (match.player1 && match.player2) {
      if (isNaN(parseInt(score1)) || isNaN(parseInt(score2))) return alert('Please enter scores for both players.')
      if (s1 === s2) return alert('Draws are not permitted in Cup matches.')
    }
    
    setIsSubmitting(true)
    const winnerId = (match.player1 && match.player2)
      ? (s1 > s2 ? match.player1 : match.player2)
      : (match.player1 || match.player2)

    const resultId = `admin_cup_${Date.now()}`

    try {
      // 1. Save Result Record
      const approvedResult = {
        id: resultId,
        player1: getPlayerName(match.player1),
        player1Id: match.player1,
        player2: getPlayerName(match.player2),
        player2Id: match.player2,
        score1: s1,
        score2: s2,
        gameType: 'Cup',
        cupId: cup.id,
        matchId: match.id,
        cupName: cup.name,
        status: 'approved',
        date: new Date().toISOString().split('T')[0],
        submittedAt: new Date().toISOString(),
        submittedBy: 'admin',
        player1Stats: { '180s': parseInt(p1_180s) || 0, highestCheckout: parseInt(p1_checkout) || 0, doubleSuccess: parseFloat(p1_doubles) || 0 },
        player2Stats: { '180s': parseInt(p2_180s) || 0, highestCheckout: parseInt(p2_checkout) || 0, doubleSuccess: parseFloat(p2_doubles) || 0 }
      }
      
      await setDoc(doc(db, 'results', resultId), approvedResult)

      // 2. Use shared advancement logic
      await advanceCupBracket(approvedResult)

      setShowResultModal(false)
      alert('Result saved and winner advanced!')
      triggerDataRefresh('all')
      setRefreshKey(prev => prev + 1)
    } catch (err) {
      alert('Database error: ' + err.message)
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '100px' }}>
      <div className="card glass" style={{ padding: '20px', border: '1px solid var(--accent-cyan)' }}>
        <h3 className="card-title">Cup Progression Tools</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '15px' }}>
          If a player has won but isn't advanced in the bracket, use this tool to sync all approved results.
        </p>
        <button className="btn btn-primary" onClick={() => handleSyncExistingWinners(false)} disabled={isSubmitting}>
          {isSubmitting ? 'Syncing...' : 'Sync Brackets with Results'}
        </button>
        {syncResult && (
          <div style={{ marginTop: '12px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Last sync: {syncResult.advanced} advanced, {syncResult.skipped} skipped, {syncResult.errors} errors
          </div>
        )}
      </div>

      {cups.map(cup => {
        const totalRounds = Math.max(...(cup.matches?.map(m => m.round) || [1]))
        // Sort matches by round then matchNum
        const sortedMatches = [...(cup.matches || [])].sort((a, b) => {
          if (a.round !== b.round) return a.round - b.round
          return (a.matchNum || 0) - (b.matchNum || 0)
        })
        
        return (
          <div key={cup.id} className="card glass animate-fade-in" style={{ padding: '28px', border: '1px solid rgba(129, 140, 248, 0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
              <div>
                <h2 className="text-gradient" style={{ fontSize: '1.75rem', marginBottom: '8px', fontWeight: 900 }}>{cup.name}</h2>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <span style={{
                    fontSize: '0.7rem',
                    background: cup.status === 'active' ? 'var(--success-bg)' : 'rgba(255,255,255,0.1)',
                    color: cup.status === 'active' ? 'var(--success)' : 'var(--text-muted)',
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>{cup.status || 'Planned'}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', opacity: 0.6 }}>ID: {cup.id}</span>
                </div>
              </div>
              <button className="btn btn-secondary btn-sm" style={{ color: 'var(--error)', borderColor: 'rgba(239, 68, 68, 0.2)' }} onClick={async () => { if(window.confirm('Delete this cup?')) { await deleteDoc(doc(db, 'cups', String(cup.id))); triggerDataRefresh('cups'); }}}>Delete Cup</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
              {sortedMatches.map(match => {
                const isWinnerSet = !!match.winner
                const p1 = getPlayerName(match.player1)
                const p2 = getPlayerName(match.player2)

                return (
                  <div key={match.id} style={{
                    padding: '20px',
                    borderRadius: '16px',
                    background: isWinnerSet ? 'rgba(16, 185, 129, 0.05)' : 'rgba(255,255,255,0.03)',
                    border: isWinnerSet ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(255,255,255,0.08)',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', alignItems: 'center' }}>
                       <span style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{getRoundName(match.round, totalRounds)}</span>
                       {isWinnerSet && <span style={{ fontSize: '0.6rem', fontWeight: 900, color: 'var(--success)', background: 'var(--success-bg)', padding: '2px 8px', borderRadius: '4px' }}>COMPLETED</span>}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 12px',
                          background: isWinnerSet && match.winner === match.player1 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0,0,0,0.2)',
                          borderRadius: '8px',
                          border: isWinnerSet && match.winner === match.player1 ? '1px solid var(--success)' : '1px solid transparent'
                        }}>
                           <span style={{ fontWeight: isWinnerSet && match.winner === match.player1 ? 800 : 500, fontSize: '0.9rem' }}>{p1}</span>
                           {isWinnerSet && <span style={{ fontWeight: 900, color: 'var(--success)' }}>{match.score1}</span>}
                        </div>

                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 12px',
                          background: isWinnerSet && match.winner === match.player2 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0,0,0,0.2)',
                          borderRadius: '8px',
                          border: isWinnerSet && match.winner === match.player2 ? '1px solid var(--success)' : '1px solid transparent'
                        }}>
                           <span style={{ fontWeight: isWinnerSet && match.winner === match.player2 ? 800 : 500, fontSize: '0.9rem' }}>{p2}</span>
                           {isWinnerSet && <span style={{ fontWeight: 900, color: 'var(--success)' }}>{match.score2}</span>}
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {!isWinnerSet ? (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => enterResult(cup, match)}
                            disabled={!match.player1 && !match.player2}
                            style={{ padding: '8px 12px', fontSize: '0.75rem' }}
                          >
                            Enter
                          </button>
                        ) : (
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ opacity: 0.6, padding: '8px 12px', fontSize: '0.75rem' }}
                            onClick={() => resetResult(cup, match)}
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {showResultModal && (
        <div className="modal-overlay">
          <div className="modal-content glass" style={{ maxWidth: '460px' }}>
            <h3 style={{ marginBottom: '24px', textAlign: 'center', fontSize: '1.5rem', fontWeight: 900 }} className="text-gradient">Enter Cup Result</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
               <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.75rem' }}>{getPlayerName(resultForm.match?.player1)} (Legs)</label>
                  <input type="number" placeholder="0" value={resultForm.score1} onChange={e => setResultForm({...resultForm, score1: e.target.value})} />
               </div>
               <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.75rem' }}>{getPlayerName(resultForm.match?.player2)} (Legs)</label>
                  <input type="number" placeholder="0" value={resultForm.score2} onChange={e => setResultForm({...resultForm, score2: e.target.value})} />
               </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border)', marginBottom: '32px' }}>
              <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px', color: 'var(--accent-cyan)', textAlign: 'center' }}>Match Statistics</h4>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.65rem' }}>P1 180s</label>
                      <input type="number" value={resultForm.p1_180s} onChange={e => setResultForm({...resultForm, p1_180s: e.target.value})} style={{ padding: '8px 12px', fontSize: '0.9rem' }} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.65rem' }}>P1 Checkout</label>
                      <input type="number" value={resultForm.p1_checkout} onChange={e => setResultForm({...resultForm, p1_checkout: e.target.value})} style={{ padding: '8px 12px', fontSize: '0.9rem' }} />
                    </div>
                 </div>
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.65rem' }}>P2 180s</label>
                      <input type="number" value={resultForm.p2_180s} onChange={e => setResultForm({...resultForm, p2_180s: e.target.value})} style={{ padding: '8px 12px', fontSize: '0.9rem' }} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.65rem' }}>P2 Checkout</label>
                      <input type="number" value={resultForm.p2_checkout} onChange={e => setResultForm({...resultForm, p2_checkout: e.target.value})} style={{ padding: '8px 12px', fontSize: '0.9rem' }} />
                    </div>
                 </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
               <button className="btn btn-secondary btn-block" onClick={() => setShowResultModal(false)}>Cancel</button>
               <button className="btn btn-primary btn-block" onClick={submitResult} disabled={isSubmitting}>
                 {isSubmitting ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="spinner" style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></span>
                      Syncing...
                    </span>
                 ) : 'Save & Advance'}
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CupManagement
