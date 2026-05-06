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
  const [resultForm, setResultForm] = useState({ cup: null, match: null, score1: '', score2: '' })
  const allUsers = getAllUsers()

  useEffect(() => {
    setCups(getCups())
    setAllCupFixtures(getFixtures())
    setAllCupResults(getResults())
  }, [refreshKey, dataRefreshTrigger])

  useEffect(() => {
    setRefreshKey(prev => prev + 1)
  }, [dataRefreshTrigger])

  const getPlayerName = (id) => {
    if (!id) return 'TBD'
    return allUsers.find(u => String(u.id) === String(id))?.username || 'Unknown'
  }

  const getRoundName = (round, totalRounds) => {
    if (round === totalRounds) return 'Final'
    if (round === totalRounds - 1) return 'Semi-Final'
    if (round === totalRounds - 2) return 'Quarter-Final'
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
    setResultForm({ cup, match, score1: '', score2: '' })
    setShowResultModal(true)
  }

  const submitResult = async () => {
    const { cup, match, score1, score2 } = resultForm
    const p1Name = getPlayerName(match.player1)
    const p2Name = getPlayerName(match.player2)
    
    const legs1 = parseInt(score1)
    const legs2 = parseInt(score2)
    
    if (isNaN(legs1) || isNaN(legs2)) {
      alert('Please enter valid numbers')
      return
    }
    
    if (legs1 < 0 || legs2 < 0) {
      alert('Scores cannot be negative')
      return
    }
    
    const winnerId = legs1 > legs2 ? match.player1 : match.player2

    const cupsData = getCups()
    const cupIndex = cupsData.findIndex(c => c.id === cup.id)
    if (cupIndex === -1) return

    const cupData = { ...cupsData[cupIndex] }

    const updatedMatches = cupData.matches.map(m => 
      m.id === match.id ? { ...m, winner: winnerId, score1: legs1, score2: legs2 } : m
    )

    if (match.nextMatchId) {
      const nextMatchIndex = updatedMatches.findIndex(m => m.id === match.nextMatchId)
      if (nextMatchIndex !== -1) {
        if (updatedMatches[nextMatchIndex].player1 === null) {
          updatedMatches[nextMatchIndex].player1 = winnerId
        } else if (updatedMatches[nextMatchIndex].player2 === null) {
          updatedMatches[nextMatchIndex].player2 = winnerId
        }
      }
    }

    const allComplete = updatedMatches.every(m => {
      if (!m.player1 || !m.player2) return true
      return m.winner !== null
    })

    const updatedCup = { ...cupData, matches: updatedMatches, status: allComplete ? 'completed' : 'active' }
    cupsData[cupIndex] = updatedCup
    localStorage.setItem('eliteArrowsCups', JSON.stringify(cupsData))
    
    try {
      await setDoc(doc(db, 'cups', cup.id.toString()), updatedCup, { merge: true })
    } catch (e) {
      console.log('Error saving cup to Firebase:', e)
    }

    setShowResultModal(false)
    const winnerName = winnerId === match.player1 ? p1Name : p2Name
    alert(`${winnerName} wins ${legs1}-${legs2}!`)
    triggerDataRefresh('cups')
    setRefreshKey(prev => prev + 1)
  }

  const deleteCup = async (cup) => {
    const confirmed = window.confirm(`Delete cup "${cup.name}"?`)
    if (!confirmed) return
    
    try {
      await deleteDoc(doc(db, 'cups', cup.id.toString()))
      const fixtures = getFixtures().filter(f => f.cupId === cup.id)
      for (const fixture of fixtures) {
        await deleteDoc(doc(db, 'fixtures', fixture.id.toString()))
      }
      alert('Cup deleted from Firebase!')
    } catch (e) {
      console.log('Error deleting from Firebase:', e)
      alert('Cup deleted locally')
    }
    
    const cupsData = getCups()
    const updatedCups = cupsData.filter(c => c.id !== cup.id)
    localStorage.setItem('eliteArrowsCups', JSON.stringify(updatedCups))
    
    const fixturesData = getFixtures()
    const updatedFixtures = fixturesData.filter(f => f.cupId !== cup.id)
    localStorage.setItem('eliteArrowsFixtures', JSON.stringify(updatedFixtures))
    
    setCups(updatedCups)
    setAllCupFixtures(updatedFixtures)
    
    setTimeout(() => {
      window.location.reload()
    }, 500)
    setRefreshKey(prev => prev + 1)
    
    triggerDataRefresh('cups')
    triggerDataRefresh('fixtures')
    alert('Cup deleted!')
  }

  const deleteFixture = async (fixture) => {
    const confirmed = window.confirm('Delete this fixture?')
    if (!confirmed) return
    
    try {
      await deleteDoc(doc(db, 'fixtures', fixture.id.toString()))
    } catch (e) {
      console.log('Error deleting from Firebase:', e)
    }
    
    const fixturesData = getFixtures()
    const updatedFixtures = fixturesData.filter(f => f.id !== fixture.id)
    localStorage.setItem('eliteArrowsFixtures', JSON.stringify(updatedFixtures))
    setAllCupFixtures(updatedFixtures)
    setRefreshKey(prev => prev + 1)
    
    triggerDataRefresh('fixtures')
    alert('Fixture deleted!')
  }

  const completeCup = async (cup) => {
    const cupsData = getCups()
    const cupIndex = cupsData.findIndex(c => c.id === cup.id)
    if (cupIndex !== -1) {
      const updatedCup = { ...cupsData[cupIndex], status: 'completed' }
      cupsData[cupIndex] = updatedCup
      localStorage.setItem('eliteArrowsCups', JSON.stringify(cupsData))
      
      try {
        await setDoc(doc(db, 'cups', cup.id.toString()), updatedCup, { merge: true })
      } catch (e) {
        console.log('Error saving to Firebase:', e)
      }
      
      alert('Cup marked as completed!')
      triggerDataRefresh('cups')
      setRefreshKey(prev => prev + 1)
    }
  }

  if (cups.length === 0) {
    return (
      <div className="card">
        <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No cups created yet</p>
      </div>
    )
  }

  const p1Name = resultForm.match ? getPlayerName(resultForm.match.player1) : ''
  const p2Name = resultForm.match ? getPlayerName(resultForm.match.player2) : ''
  const roundFormats = resultForm.cup?.roundFormats || {}
  const roundFormat = roundFormats[resultForm.match?.round] || {}
  const startScore = roundFormat.startScore || 501
  const bestOf = roundFormat.bestOf || 3
  const firstTo = Math.ceil(bestOf / 2)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {cups.map(cup => {
        const totalRounds = Math.max(...(cup.matches?.map(m => m.round) || [1]))
        const sortedMatches = [...(cup.matches || [])].sort((a, b) => (
          Number(a.round || 0) - Number(b.round || 0) ||
          Number(a.matchNum || a.id || 0) - Number(b.matchNum || b.id || 0)
        ))
        const visibleMatches = sortedMatches.filter(m => m.player1 || m.player2 || m.winner)
        const cupFixtures = allCupFixtures.filter(f => String(f.cupId) === String(cup.id))
        
        return (
          <div key={cup.id} style={{ 
            padding: '20px', 
            background: 'var(--bg-secondary)', 
            borderRadius: '12px',
            border: cup.status === 'completed' ? '2px solid var(--success)' : '2px solid var(--accent-cyan)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--accent-cyan)' }}>{cup.name}</h3>
                <p style={{ margin: '5px 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Entry: £{cup.entryFee} | Prize Pot: £{cup.entryFee * cup.players.length} | Players: {cup.players.length}
                </p>
                {cup.roundFormats && (
                  <p style={{ margin: '5px 0 0 0', fontSize: '0.75rem', color: 'var(--accent-cyan)' }}>
                    {Object.entries(cup.roundFormats).map(([round, format]) => 
                      `R${round}: ${format.startScore}/Bo${format.bestOf}`
                    ).join(' | ')}
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <span style={{ 
                  padding: '5px 15px', 
                  borderRadius: '20px',
                  background: cup.status === 'completed' ? 'var(--success)' : 'var(--warning)',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '0.85rem'
                }}>
                  {cup.status === 'completed' ? 'Completed' : 'Active'}
                </span>
                {cup.status !== 'completed' && (
                  <button className="btn btn-success btn-sm" onClick={() => completeCup(cup)}>
                    Complete Cup
                  </button>
                )}
                <button className="btn btn-danger btn-sm" onClick={() => deleteCup(cup)}>
                  Delete Cup
                </button>
              </div>
            </div>

            <div style={{ marginTop: '15px' }}>
              <h4 style={{ marginBottom: '10px' }}>Bracket Results</h4>
              {visibleMatches.map(match => {
                const p1Name = getPlayerName(match.player1)
                const p2Name = getPlayerName(match.player2)
                const winnerName = match.winner ? getPlayerName(match.winner) : null
                const roundName = getRoundName(match.round, totalRounds)
                const scores = getMatchScores(cup, match)
                
                return (
                  <div key={match.id} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    padding: '12px',
                    background: match.winner ? 'rgba(34, 197, 94, 0.1)' : 'var(--bg-primary)',
                    borderRadius: '8px',
                    marginBottom: '8px'
                  }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{roundName}</span>
                      <div style={{ fontSize: '0.95rem', marginTop: '3px' }}>
                        <strong>{p1Name}</strong>
                        <span style={{ color: 'var(--text-muted)', margin: '0 10px' }}>vs</span>
                        <strong>{p2Name}</strong>
                      </div>
                    </div>
                    {match.winner ? (
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>
                          Winner: {winnerName}
                        </span>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          Score: {scores ? `${scores.score1}-${scores.score2}` : 'Not recorded'}
                        </div>
                      </div>
                    ) : (
                      <button 
                        className="btn btn-primary btn-sm"
                        onClick={() => enterResult(cup, match)}
                        disabled={!match.player1 || !match.player2}
                      >
                        Enter Result
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid var(--border)' }}>
              <h4 style={{ marginBottom: '10px' }}>Cup Fixtures ({cupFixtures.length})</h4>
              {cupFixtures.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No fixtures</p>
              ) : (
                cupFixtures.map(fixture => {
                  const p1Name = getPlayerName(fixture.player1)
                  const p2Name = getPlayerName(fixture.player2)
                  const roundName = getRoundName(fixture.round, totalRounds)
                  
                  return (
                    <div key={fixture.id} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      padding: '10px',
                      background: 'var(--bg-primary)',
                      borderRadius: '6px',
                      marginBottom: '6px'
                    }}>
                      <div style={{ fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{roundName}</span>
                        <div>
                          {p1Name} vs {p2Name}
                        </div>
                        <span style={{ 
                          fontSize: '0.75rem',
                          color: fixture.status === 'accepted' ? 'var(--success)' : 
                                 fixture.status === 'pending' ? 'var(--warning)' : 'var(--text-muted)'
                        }}>
                          {fixture.status}
                        </span>
                      </div>
                      <button 
                        className="btn btn-danger btn-sm"
                        onClick={() => deleteFixture(fixture)}
                      >
                        Delete
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )
      })}

      {showResultModal && (
        <div className="modal-overlay" onClick={() => setShowResultModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Enter Result: {p1Name} vs {p2Name}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {getRoundName(resultForm.match?.round, Math.max(...(resultForm.cup?.matches?.map(m => m.round) || [1])))} | {startScore} | First to {firstTo}
            </p>
            <div style={{ display: 'flex', gap: '15px', margin: '20px 0' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text)', fontSize: '0.9rem' }}>{p1Name} legs won</label>
                <input
                  type="number"
                  value={resultForm.score1}
                  onChange={e => setResultForm({ ...resultForm, score1: e.target.value })}
                  style={{ width: '100%', padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)' }}
                  min="0"
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text)', fontSize: '0.9rem' }}>{p2Name} legs won</label>
                <input
                  type="number"
                  value={resultForm.score2}
                  onChange={e => setResultForm({ ...resultForm, score2: e.target.value })}
                  style={{ width: '100%', padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)' }}
                  min="0"
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowResultModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={submitResult}>Submit Result</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CupManagement
