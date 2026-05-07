import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { db, doc, setDoc, deleteDoc } from '../firebase'

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
    p2_doubles: '0',
    proofImage: ''
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
  }, [refreshKey, dataRefreshTrigger])

  useEffect(() => {
    setRefreshKey(prev => prev + 1)
  }, [dataRefreshTrigger])

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

  const hasScore = (score) => score !== undefined && score !== null && score !== ''

  const getScoreForPlayer = (source, playerId, fallbackScore) => {
    const sourcePlayer1Id = source.player1Id || source.player1
    const sourcePlayer2Id = source.player2Id || source.player2
    if (String(playerId) === String(sourcePlayer1Id)) return source.score1
    if (String(playerId) === String(sourcePlayer2Id)) return source.score2
    return fallbackScore
  }

  const getScoresFromSource = (source, match) => {
    if (!source || !hasScore(source.score1) || !hasScore(source.score2)) return null
    return {
      score1: getScoreForPlayer(source, match.player1, source.score1),
      score2: getScoreForPlayer(source, match.player2, source.score2)
    }
  }

  const getMatchScores = (cup, match) => {
    const fixture = allCupFixtures.find(f => (
      String(f.cupId || '') === String(cup.id) &&
      String(f.matchId || '') === String(match.id)
    ))
    const approvedResult = allCupResults.find(result => (
      (
        (
          String(result.cupId || '') === String(cup.id) &&
          String(result.matchId || '') === String(match.id)
        ) ||
        (fixture?.id && String(result.fixtureId || '') === String(fixture.id))
      ) &&
      String(result.status).toLowerCase() === 'approved'
    ))

    return (
      getScoresFromSource(approvedResult, match) ||
      getScoresFromSource(match, match) ||
      (['approved', 'completed'].includes(String(fixture?.status).toLowerCase()) ? getScoresFromSource(fixture, match) : null)
    )
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
      p2_doubles: '0',
      proofImage: ''
    })
    setShowResultModal(true)
  }

  const submitResult = async () => {
    if (isSubmitting) return
    const { cup, match, score1, score2, p1_180s, p2_180s, p1_checkout, p2_checkout, p1_doubles, p2_doubles, proofImage } = resultForm

    if (!cup || !match || !match.player1 || !match.player2) {
      alert('Error: Bracket data is incomplete. Please refresh and try again.')
      return
    }

    const s1 = parseInt(score1)
    const s2 = parseInt(score2)
    
    if (isNaN(s1) || isNaN(s2)) return alert('Please enter scores for both players.')
    if (s1 === s2) return alert('Draws are not permitted in Cup matches.')
    
    setIsSubmitting(true)
    const p1Name = getPlayerName(match.player1)
    const p2Name = getPlayerName(match.player2)
    const winnerId = s1 > s2 ? match.player1 : match.player2
    const resultId = `admin_cup_${Date.now()}`

    try {
      // 1. Save Result Record
      await setDoc(doc(db, 'results', resultId), {
        id: resultId,
        player1: p1Name,
        player1Id: match.player1,
        player2: p2Name,
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

      // 2. Update Cup Data (Bracket)
      const freshCups = getCups()
      const currentCup = freshCups.find(c => String(c.id) === String(cup.id))
      if (currentCup) {
        let updatedMatches = currentCup.matches.map(m =>
          String(m.id) === String(match.id) ? { ...m, winner: winnerId, score1: s1, score2: s2, resultId } : { ...m }
        )

        // Propagate to next round
        if (match.nextMatchId) {
          const nextIdx = updatedMatches.findIndex(m => String(m.id) === String(match.nextMatchId))
          if (nextIdx !== -1) {
            const currentRoundMatches = updatedMatches
              .filter(m => Number(m.round) === Number(match.round))
              .sort((a, b) => (Number(a.matchNum) || 0) - (Number(b.matchNum) || 0))
            const matchPos = currentRoundMatches.findIndex(m => String(m.id) === String(match.id))
            if (matchPos !== -1) {
              if (matchPos % 2 === 0) updatedMatches[nextIdx].player1 = winnerId
              else updatedMatches[nextIdx].player2 = winnerId
            }
          }
        }

        await setDoc(doc(db, 'cups', String(cup.id)), { ...currentCup, matches: updatedMatches }, { merge: true })
      }

      setShowResultModal(false)
      alert('Result saved successfully!')
      triggerDataRefresh('all')
      setRefreshKey(prev => prev + 1)
    } catch (err) {
      alert('Cloud error: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {cups.map(cup => {
        const totalRounds = Math.max(...(cup.matches?.map(m => m.round) || [1]))
        const visibleMatches = (cup.matches || []).filter(m => m.player1 || m.player2 || m.winner)
        
        return (
          <div key={cup.id} className="card glass animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 className="text-gradient">{cup.name}</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status: {cup.status}</p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-danger btn-sm" onClick={async () => { if(confirm('Delete?')) { await deleteDoc(doc(db, 'cups', String(cup.id))); triggerDataRefresh('cups'); }}}>Delete</button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {visibleMatches.map(match => {
                const s = getMatchScores(cup, match)
                return (
                  <div key={match.id} className="glass" style={{ padding: '15px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)', fontWeight: 800, marginBottom: '5px' }}>{getRoundName(match.round, totalRounds)}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '0.9rem' }}>
                        <strong>{getPlayerName(match.player1)}</strong> vs <strong>{getPlayerName(match.player2)}</strong>
                      </div>
                      {match.winner ? (
                         <div style={{ textAlign: 'right' }}>
                            <div style={{ color: 'var(--success)', fontWeight: 800 }}>{getPlayerName(match.winner)} wins</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{s?.score1}-{s?.score2}</div>
                         </div>
                      ) : (
                        <button className="btn btn-primary btn-sm" onClick={() => enterResult(cup, match)} disabled={!match.player1 || !match.player2}>Enter Score</button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {showResultModal && (
        <div className="modal-overlay" style={{ zIndex: 11000 }}>
          <div className="card glass" style={{ maxWidth: '500px', width: '90%' }}>
            <h3 style={{ marginBottom: '20px' }}>Enter Score</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
               <div>
                  <label style={{ fontSize: '0.8rem' }}>{getPlayerName(resultForm.match?.player1)}</label>
                  <input type="number" placeholder="Legs" value={resultForm.score1} onChange={e => setResultForm({...resultForm, score1: e.target.value})} className="glass" style={{ width: '100%', marginTop: '5px' }} />
               </div>
               <div>
                  <label style={{ fontSize: '0.8rem' }}>{getPlayerName(resultForm.match?.player2)}</label>
                  <input type="number" placeholder="Legs" value={resultForm.score2} onChange={e => setResultForm({...resultForm, score2: e.target.value})} className="glass" style={{ width: '100%', marginTop: '5px' }} />
               </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
               <button className="btn btn-secondary btn-block" onClick={() => setShowResultModal(false)}>Cancel</button>
               <button className="btn btn-primary btn-block" onClick={submitResult} disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Submit Result'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CupManagement
