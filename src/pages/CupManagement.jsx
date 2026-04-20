import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { db, doc, setDoc, deleteDoc } from '../firebase'

function CupManagement() {
  const { getAllUsers, getCups, getFixtures, triggerDataRefresh, dataRefreshTrigger } = useAuth()
  const [refreshKey, setRefreshKey] = useState(0)
  const [cups, setCups] = useState([])
  const [allCupFixtures, setAllCupFixtures] = useState([])
  const allUsers = getAllUsers()

  useEffect(() => {
    setCups(getCups())
    setAllCupFixtures(getFixtures())
  }, [refreshKey, dataRefreshTrigger])

  useEffect(() => {
    setRefreshKey(prev => prev + 1)
  }, [dataRefreshTrigger])

  const getPlayerName = (id) => {
    if (!id) return 'TBD'
    return allUsers.find(u => u.id === id)?.username || 'Unknown'
  }

  const getRoundName = (round, totalRounds) => {
    if (round === totalRounds) return 'Final'
    if (round === totalRounds - 1) return 'Semi-Final'
    if (round === totalRounds - 2) return 'Quarter-Final'
    return `Round ${round}`
  }

  const enterResult = async (cup, match) => {
    const p1Name = getPlayerName(match.player1)
    const p2Name = getPlayerName(match.player2)
    
    const roundFormats = cup.roundFormats || {}
    const roundFormat = roundFormats[match.round] || {}
    const startScore = roundFormat.startScore || 501
    const bestOf = roundFormat.bestOf || 3
    const firstTo = Math.ceil(bestOf / 2)
    
    const score1 = prompt(`Enter legs won for ${p1Name} (${getRoundName(match.round, Math.max(...(cup.matches?.map(m => m.round) || [1])))}, ${startScore}, First to ${firstTo}):`)
    if (score1 === null) return
    
    const score2 = prompt(`Enter legs won for ${p2Name} (${getRoundName(match.round, Math.max(...(cup.matches?.map(m => m.round) || [1])))}, ${startScore}, First to ${firstTo}):`)
    if (score2 === null) return
    
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

    const winnerName = winnerId === match.player1 ? p1Name : p2Name
    alert(`${winnerName} wins ${legs1}-${legs2}!`)
    triggerDataRefresh('cups')
    setRefreshKey(prev => prev + 1)
  }

  const deleteCup = async (cup) => {
    if (!confirm(`Are you sure you want to delete "${cup.name}"?`)) return
    
    const cupsData = getCups()
    const updatedCups = cupsData.filter(c => c.id !== cup.id)
    localStorage.setItem('eliteArrowsCups', JSON.stringify(updatedCups))
    
    const fixtures = getFixtures()
    const updatedFixtures = fixtures.filter(f => f.cupId !== cup.id)
    localStorage.setItem('eliteArrowsFixtures', JSON.stringify(updatedFixtures))
    
    try {
      await deleteDoc(doc(db, 'cups', cup.id.toString()))
      for (const fixture of fixtures.filter(f => f.cupId === cup.id)) {
        await deleteDoc(doc(db, 'fixtures', fixture.id.toString()))
      }
    } catch (e) {
      console.log('Error deleting from Firebase:', e)
    }
    
    alert('Cup deleted!')
    triggerDataRefresh('cups')
    triggerDataRefresh('fixtures')
    setRefreshKey(prev => prev + 1)
  }

  const deleteFixture = async (fixture) => {
    if (!confirm('Are you sure you want to delete this fixture?')) return
    
    const fixtures = getFixtures()
    const updatedFixtures = fixtures.filter(f => f.id !== fixture.id)
    localStorage.setItem('eliteArrowsFixtures', JSON.stringify(updatedFixtures))
    
    try {
      await deleteDoc(doc(db, 'fixtures', fixture.id.toString()))
    } catch (e) {
      console.log('Error deleting from Firebase:', e)
    }
    
    alert('Fixture deleted!')
    triggerDataRefresh('fixtures')
    setRefreshKey(prev => prev + 1)
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {cups.map(cup => {
        const totalRounds = Math.max(...(cup.matches?.map(m => m.round) || [1]))
        const activeMatches = cup.matches?.filter(m => m.player1 && m.player2 && !m.winner) || []
        const completedMatches = cup.matches?.filter(m => m.winner) || []
        const cupFixtures = allCupFixtures.filter(f => f.cupId === cup.id)
        
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
              {cup.matches?.filter(m => m.round === 1).map(match => {
                const p1Name = getPlayerName(match.player1)
                const p2Name = getPlayerName(match.player2)
                const winnerName = match.winner ? getPlayerName(match.winner) : null
                const roundName = getRoundName(match.round, totalRounds)
                
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
                          Score: {match.score1}-{match.score2}
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

            {cup.status !== 'completed' && completedMatches.length > 0 && (
              <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid var(--border)' }}>
                <h4 style={{ marginBottom: '10px' }}>Next Round Matches</h4>
                {cup.matches?.filter(m => m.round > 1 && m.player1 && m.player2 && !m.winner).map(match => {
                  const p1Name = getPlayerName(match.player1)
                  const p2Name = getPlayerName(match.player2)
                  const roundName = getRoundName(match.round, totalRounds)
                  
                  return (
                    <div key={match.id} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      padding: '12px',
                      background: 'var(--bg-primary)',
                      borderRadius: '8px',
                      marginBottom: '8px'
                    }}>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)' }}>{roundName}</span>
                        <div style={{ fontSize: '0.95rem', marginTop: '3px' }}>
                          <strong>{p1Name}</strong>
                          <span style={{ color: 'var(--text-muted)', margin: '0 10px' }}>vs</span>
                          <strong>{p2Name}</strong>
                        </div>
                      </div>
                      <button 
                        className="btn btn-primary btn-sm"
                        onClick={() => enterResult(cup, match)}
                      >
                        Enter Result
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

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
    </div>
  )
}

export default CupManagement
