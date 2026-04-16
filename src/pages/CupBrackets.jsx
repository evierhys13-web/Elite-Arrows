import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function CupBracket() {
  const { cupId } = useParams()
  const { getAllUsers } = useAuth()
  const [cup, setCup] = useState(null)
  const [fixtures, setFixtures] = useState([])
  const allUsers = getAllUsers()

  useEffect(() => {
    const cups = JSON.parse(localStorage.getItem('eliteArrowsCups') || '[]')
    const foundCup = cups.find(c => c.id === parseInt(cupId))
    if (foundCup) {
      setCup(foundCup)
    }
    
    const allFixtures = JSON.parse(localStorage.getItem('eliteArrowsFixtures') || '[]')
    setFixtures(allFixtures.filter(f => f.cupId === parseInt(cupId)))
    
    const interval = setInterval(() => {
      const updatedCups = JSON.parse(localStorage.getItem('eliteArrowsCups') || '[]')
      const updatedCup = updatedCups.find(c => c.id === parseInt(cupId))
      if (updatedCup) {
        setCup(updatedCup)
      }
      const updatedFixtures = JSON.parse(localStorage.getItem('eliteArrowsFixtures') || '[]')
      setFixtures(updatedFixtures.filter(f => f.cupId === parseInt(cupId)))
    }, 3000)
    
    return () => clearInterval(interval)
  }, [cupId])

  if (!cup) {
    return (
      <div className="page">
        <div className="page-header">
          <Link to="/cups" className="btn btn-secondary">← Back to Cups</Link>
        </div>
        <div className="card">
          <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Cup not found</p>
        </div>
      </div>
    )
  }

  const totalRounds = Math.max(...(cup.matches?.map(m => m.round) || [1]))
  const prizePot = cup.entryFee * (cup.players?.length || 0)
  const cupWinner = cup.matches?.find(m => m.round === totalRounds)?.winner

  const getRoundName = (round) => {
    if (round === totalRounds) return 'FINAL'
    if (round === totalRounds - 1) return 'SEMI-FINALS'
    if (round === totalRounds - 2) return 'QUARTER-FINALS'
    return `ROUND ${round}`
  }

  const getMatchResult = (match) => {
    const fixture = fixtures.find(f => f.matchId === match.id && f.status === 'approved')
    return fixture ? { score1: fixture.score1, score2: fixture.score2 } : null
  }

  const rounds = []
  for (let i = 1; i <= totalRounds; i++) {
    rounds.push(i)
  }

  const getPlayerName = (id) => {
    if (!id) return null
    return allUsers.find(u => u.id === id)?.username || 'Unknown'
  }

  const roundsData = rounds.map(round => {
    const matches = cup.matches?.filter(m => m.round === round).sort((a, b) => a.id - b.id) || []
    return { round, matches }
  })

  return (
    <div className="page" style={{ padding: '20px' }}>
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <Link to="/cups" className="btn btn-secondary">← Back to Cups</Link>
      </div>
      
      <div style={{ 
        textAlign: 'center', 
        marginBottom: '30px',
        padding: '20px',
        background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
        borderRadius: '16px',
        border: '2px solid var(--accent-cyan)'
      }}>
        <h1 style={{ color: 'var(--accent-cyan)', margin: '0 0 10px 0', fontSize: '2rem' }}>{cup.name}</h1>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '30px', color: 'white', fontSize: '1rem' }}>
          <span>Entry: £{cup.entryFee}</span>
          <span>Prize Pot: £{prizePot}</span>
          <span>{cup.players?.length || 0} Players</span>
        </div>
      </div>

      {cupWinner && (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px',
          background: 'linear-gradient(135deg, #f5af19, #f12711)',
          borderRadius: '16px',
          marginBottom: '30px',
          boxShadow: '0 10px 40px rgba(245, 175, 25, 0.4)'
        }}>
          <h2 style={{ color: 'white', margin: 0, fontSize: '1.5rem' }}>🏆 TOURNAMENT WINNER 🏆</h2>
          <h1 style={{ color: 'white', margin: '15px 0 0 0', fontSize: '3rem', textShadow: '2px 2px 4px rgba(0,0,0,0.3)' }}>
            {getPlayerName(cupWinner)}
          </h1>
        </div>
      )}

      <div style={{ 
        background: '#0f0f23',
        borderRadius: '16px',
        padding: '30px',
        overflowX: 'auto'
      }}>
        <h3 style={{ 
          color: 'white', 
          textAlign: 'center', 
          marginBottom: '30px',
          fontSize: '1.3rem',
          letterSpacing: '2px'
        }}>
          BRACKET
        </h3>
        
        <div style={{ 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0'
        }}>
          {roundsData.map((roundData, roundIndex) => {
            const isComplete = roundData.matches.every(m => m.winner)
            const isActive = !isComplete && roundData.matches.some(m => m.player1 && m.player2)
            
            return (
              <div key={roundData.round} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ 
                  minWidth: '180px',
                  padding: '0 10px'
                }}>
                  <div style={{ 
                    textAlign: 'center',
                    marginBottom: '20px',
                    padding: '10px',
                    background: isComplete ? '#22c55e' : isActive ? 'var(--accent-cyan)' : '#333',
                    color: 'white',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    fontSize: '0.85rem',
                    letterSpacing: '1px'
                  }}>
                    {getRoundName(roundData.round)}
                  </div>
                  
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    gap: roundData.round === 1 ? '15px' : `${Math.pow(2, roundData.round - 1) * 15}px`
                  }}>
                    {roundData.matches.map((match, matchIndex) => {
                      const result = getMatchResult(match)
                      const hasPlayers = match.player1 && match.player2
                      const p1Name = getPlayerName(match.player1)
                      const p2Name = getPlayerName(match.player2)
                      const p1Won = match.winner === match.player1
                      const p2Won = match.winner === match.player2
                      
                      const containerHeight = roundData.round === 1 ? 90 : Math.pow(2, roundData.round - 1) * 90
                      const halfHeight = containerHeight / 2
                      const matchOffset = halfHeight / 2 + matchIndex * containerHeight
                      
                      return (
                        <div key={match.id} style={{ 
                          height: '90px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between'
                        }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '10px 12px',
                            background: p1Won ? 'rgba(34, 197, 94, 0.2)' : hasPlayers ? '#1e1e3f' : '#1a1a2e',
                            borderRadius: '8px',
                            border: p1Won ? '2px solid #22c55e' : '2px solid #333',
                            minHeight: '35px'
                          }}>
                            <span style={{ 
                              flex: 1, 
                              color: p1Won ? '#22c55e' : p1Name ? 'white' : '#666',
                              fontWeight: p1Won ? 'bold' : 'normal',
                              fontSize: '0.85rem'
                            }}>
                              {p1Name || 'TBD'}
                            </span>
                            {result && (
                              <span style={{ 
                                color: p1Won ? '#22c55e' : '#ef4444',
                                fontWeight: 'bold',
                                fontSize: '0.9rem',
                                marginLeft: '8px'
                              }}>
                                {result.score1}
                              </span>
                            )}
                            {p1Won && <span style={{ color: '#22c55e', marginLeft: '5px' }}>★</span>}
                          </div>
                          
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '10px 12px',
                            background: p2Won ? 'rgba(34, 197, 94, 0.2)' : hasPlayers ? '#1e1e3f' : '#1a1a2e',
                            borderRadius: '8px',
                            border: p2Won ? '2px solid #22c55e' : '2px solid #333',
                            minHeight: '35px'
                          }}>
                            <span style={{ 
                              flex: 1, 
                              color: p2Won ? '#22c55e' : p2Name ? 'white' : '#666',
                              fontWeight: p2Won ? 'bold' : 'normal',
                              fontSize: '0.85rem'
                            }}>
                              {p2Name || 'TBD'}
                            </span>
                            {result && (
                              <span style={{ 
                                color: p2Won ? '#22c55e' : '#ef4444',
                                fontWeight: 'bold',
                                fontSize: '0.9rem',
                                marginLeft: '8px'
                              }}>
                                {result.score2}
                              </span>
                            )}
                            {p2Won && <span style={{ color: '#22c55e', marginLeft: '5px' }}>★</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
                
                {roundIndex < roundsData.length - 1 && (
                  <div style={{ 
                    width: '40px', 
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <div style={{ 
                      width: '40px', 
                      height: '2px', 
                      background: 'linear-gradient(90deg, #333, var(--accent-cyan))' 
                    }} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="card" style={{ marginTop: '20px' }}>
        <h3 className="card-title">Upcoming Matches</h3>
        {fixtures.filter(f => f.status !== 'approved').length === 0 ? (
          <p style={{ color: 'var(--success)', textAlign: 'center' }}>✓ All matches completed!</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px' }}>
            {fixtures.filter(f => f.status !== 'approved').map(fixture => (
              <div key={fixture.id} style={{ 
                padding: '15px', 
                background: '#1e1e3f', 
                borderRadius: '10px',
                border: '1px solid var(--accent-cyan)'
              }}>
                <div style={{ 
                  fontSize: '0.8rem', 
                  color: 'var(--accent-cyan)',
                  marginBottom: '8px',
                  fontWeight: 'bold'
                }}>
                  {getRoundName(fixture.round)}
                </div>
                <div style={{ fontSize: '1rem', color: 'white' }}>
                  {getPlayerName(fixture.player1) || 'TBD'} 
                  <span style={{ color: '#666', margin: '0 10px' }}>vs</span>
                  {getPlayerName(fixture.player2) || 'TBD'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
