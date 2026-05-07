import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { db, doc, setDoc, deleteDoc, getDoc } from '../firebase'

function CupManagement() {
  const { getAllUsers, getCups, getFixtures, getResults, triggerDataRefresh, dataRefreshTrigger } = useAuth()
  const [refreshKey, setRefreshKey] = useState(0)
  const [cups, setCups] = useState([])
  const [allCupFixtures, setAllCupFixtures] = useState([])
  const [allCupResults, setAllCupResults] = useState([])
  const [showResultModal, setShowResultModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
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
        // Also clear if this player was propagated forward
        if (m.round > match.round) {
           const matchPlayer1 = String(match.player1)
           const matchPlayer2 = String(match.player2)
           if (String(m.player1) === matchPlayer1 || String(m.player1) === matchPlayer2) m.player1 = null
           if (String(m.player2) === matchPlayer1 || String(m.player2) === matchPlayer2) m.player2 = null
        }
        return m
      })

      await setDoc(cupRef, { ...cupData, matches: updatedMatches }, { merge: true })
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

    if (!cup || !match || !match.player1 || !match.player2) {
      alert('Error: Bracket data is incomplete. Please refresh and try again.')
      return
    }

    const s1 = parseInt(score1)
    const s2 = parseInt(score2)
    
    if (isNaN(s1) || isNaN(s2)) return alert('Please enter scores for both players.')
    if (s1 === s2) return alert('Draws are not permitted in Cup matches.')
    
    setIsSubmitting(true)
    const winnerId = s1 > s2 ? match.player1 : match.player2
    const resultId = `admin_cup_${Date.now()}`

    try {
      // 1. Save Result Record
      await setDoc(doc(db, 'results', resultId), {
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
      })

      // 2. Update Cup Data (Bracket Advancement)
      const cupRef = doc(db, 'cups', String(cup.id))
      const cupSnap = await getDoc(cupRef)
      if (cupSnap.exists()) {
        const cupData = cupSnap.data()
        let updatedMatches = cupData.matches.map(m =>
          String(m.id) === String(match.id) ? { ...m, winner: winnerId, score1: s1, score2: s2, resultId } : { ...m }
        )

        // Propagation Logic
        if (match.nextMatchId) {
          const nextMatchIdx = updatedMatches.findIndex(m => String(m.id) === String(match.nextMatchId))
          if (nextMatchIdx !== -1) {
            // Determine if winner goes to player1 or player2 of next match
            // This depends on the match number in the current round
            const currentRoundMatches = updatedMatches
              .filter(m => Number(m.round) === Number(match.round))
              .sort((a, b) => (Number(a.matchNum) || 0) - (Number(b.matchNum) || 0))

            const matchPos = currentRoundMatches.findIndex(m => String(m.id) === String(match.id))
            if (matchPos !== -1) {
              if (matchPos % 2 === 0) updatedMatches[nextMatchIdx].player1 = winnerId
              else updatedMatches[nextMatchIdx].player2 = winnerId
            }
          }
        }

        await setDoc(cupRef, { ...cupData, matches: updatedMatches }, { merge: true })
      }

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
      {cups.map(cup => {
        const totalRounds = Math.max(...(cup.matches?.map(m => m.round) || [1]))
        // Sort matches by round then matchNum
        const sortedMatches = [...(cup.matches || [])].sort((a, b) => {
          if (a.round !== b.round) return a.round - b.round
          return (a.matchNum || 0) - (b.matchNum || 0)
        })
        
        return (
          <div key={cup.id} className="card glass animate-fade-in" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <h2 className="text-gradient" style={{ fontSize: '1.5rem', marginBottom: '4px' }}>{cup.name}</h2>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '4px' }}>{cup.status?.toUpperCase()}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {cup.id}</span>
                </div>
              </div>
              <button className="btn btn-danger btn-sm" onClick={async () => { if(window.confirm('Delete this cup?')) { await deleteDoc(doc(db, 'cups', String(cup.id))); triggerDataRefresh('cups'); }}}>Delete Cup</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {sortedMatches.map(match => {
                const isWinnerSet = !!match.winner
                const p1 = getPlayerName(match.player1)
                const p2 = getPlayerName(match.player2)

                return (
                  <div key={match.id} className="glass" style={{
                    padding: '16px',
                    borderRadius: '12px',
                    background: isWinnerSet ? 'rgba(34, 197, 94, 0.08)' : 'rgba(255,255,255,0.02)',
                    border: isWinnerSet ? '1px solid rgba(34, 197, 94, 0.2)' : '1px solid rgba(255,255,255,0.05)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                       <span style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--accent-cyan)', textTransform: 'uppercase' }}>{getRoundName(match.round, totalRounds)}</span>
                       {isWinnerSet && <span style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--success)' }}>COMPLETED</span>}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: isWinnerSet && match.winner === match.player1 ? 800 : 500, color: isWinnerSet && match.winner === match.player1 ? 'var(--success)' : 'inherit' }}>
                           {p1} {isWinnerSet && <span>({match.score1})</span>}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: '4px 0' }}>vs</div>
                        <div style={{ fontWeight: isWinnerSet && match.winner === match.player2 ? 800 : 500, color: isWinnerSet && match.winner === match.player2 ? 'var(--success)' : 'inherit' }}>
                           {p2} {isWinnerSet && <span>({match.score2})</span>}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        {!isWinnerSet ? (
                          <button className="btn btn-primary btn-sm" onClick={() => enterResult(cup, match)} disabled={!match.player1 || !match.player2}>Enter Score</button>
                        ) : (
                          <button className="btn btn-secondary btn-sm" style={{ opacity: 0.6 }} onClick={() => resetResult(cup, match)}>Reset</button>
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
          <div className="modal-content glass">
            <h3 style={{ marginBottom: '24px', textAlign: 'center' }}>Enter Cup Result</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
               <div className="form-group">
                  <label style={{ fontSize: '0.75rem' }}>{getPlayerName(resultForm.match?.player1)}</label>
                  <input type="number" placeholder="Legs" value={resultForm.score1} onChange={e => setResultForm({...resultForm, score1: e.target.value})} className="glass" />
               </div>
               <div className="form-group">
                  <label style={{ fontSize: '0.75rem' }}>{getPlayerName(resultForm.match?.player2)}</label>
                  <input type="number" placeholder="Legs" value={resultForm.score2} onChange={e => setResultForm({...resultForm, score2: e.target.value})} className="glass" />
               </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '30px' }}>
               <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px' }}>
                  <label style={{ fontSize: '0.65rem', display: 'block', marginBottom: '5px' }}>P1 180s</label>
                  <input type="number" value={resultForm.p1_180s} onChange={e => setResultForm({...resultForm, p1_180s: e.target.value})} className="glass" style={{ padding: '6px' }} />
                  <label style={{ fontSize: '0.65rem', display: 'block', margin: '10px 0 5px' }}>P1 Checkout</label>
                  <input type="number" value={resultForm.p1_checkout} onChange={e => setResultForm({...resultForm, p1_checkout: e.target.value})} className="glass" style={{ padding: '6px' }} />
               </div>
               <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px' }}>
                  <label style={{ fontSize: '0.65rem', display: 'block', marginBottom: '5px' }}>P2 180s</label>
                  <input type="number" value={resultForm.p2_180s} onChange={e => setResultForm({...resultForm, p2_180s: e.target.value})} className="glass" style={{ padding: '6px' }} />
                  <label style={{ fontSize: '0.65rem', display: 'block', margin: '10px 0 5px' }}>P2 Checkout</label>
                  <input type="number" value={resultForm.p2_checkout} onChange={e => setResultForm({...resultForm, p2_checkout: e.target.value})} className="glass" style={{ padding: '6px' }} />
               </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
               <button className="btn btn-secondary btn-block" onClick={() => setShowResultModal(false)}>Cancel</button>
               <button className="btn btn-primary btn-block" onClick={submitResult} disabled={isSubmitting}>{isSubmitting ? 'Syncing...' : 'Save & Advance'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CupManagement
