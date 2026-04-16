import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function CupBracket() {
  const { cupId } = useParams()
  const { user, getAllUsers } = useAuth()
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

  const getActiveRound = () => {
    if (!cup.matches) return 1
    const rounds = Array.from(new Set(cup.matches.map(m => m.round))).sort((a, b) => a - b)
    for (const round of rounds) {
      const roundMatches = cup.matches.filter(m => m.round === round)
      const allHaveWinners = roundMatches.every(m => m.winner)
      if (!allHaveWinners) return round
    }
    return rounds[rounds.length - 1] || 1
  }

  const activeRound = getActiveRound()
  const totalRounds = Math.max(...(cup.matches?.map(m => m.round) || [1]))
  const prizePot = cup.entryFee * (cup.players?.length || 0)
  const cupWinner = cup.matches?.find(m => m.round === totalRounds)?.winner

  const getRoundName = (round) => {
    if (round === totalRounds) return 'Final'
    if (round === totalRounds - 1) return 'Semi-Final'
    if (round === totalRounds - 2) return 'Quarter-Final'
    return `R${round}`
  }

  const getMatchResult = (match) => {
    const fixture = fixtures.find(f => f.matchId === match.id && f.status === 'approved')
    if (fixture) {
      return { score1: fixture.score1, score2: fixture.score2 }
    }
    return null
  }

  const getMatchesForRound = (round) => {
    return cup.matches?.filter(m => m.round === round).sort((a, b) => a.id - b.id) || []
  }

  const rounds = Array.from(new Set(cup.matches?.map(m => m.round) || [])).sort((a, b) => a - b)

  const isRoundComplete = (round) => {
    const roundMatches = cup.matches?.filter(m => m.round === round) || []
    return roundMatches.length > 0 && roundMatches.every(m => m.winner !== null)
  }

  const getDisplayRounds = () => {
    const completedRounds = rounds.filter(r => isRoundComplete(r))
    const nextIncompleteRound = rounds.find(r => !isRoundComplete(r))
    
    if (!nextIncompleteRound) {
      return rounds
    }
    
    const nextIdx = rounds.indexOf(nextIncompleteRound)
    return rounds.slice(0, nextIdx + 1)
  }

  const displayRounds = getDisplayRounds()

  return (
    <div className="page">
      <div className="page-header">
        <Link to="/cups" className="btn btn-secondary">← Back to Cups</Link>
      </div>
      
      <div className="card" style={{ marginBottom: '20px', background: 'linear-gradient(135deg, var(--bg-secondary), var(--bg-primary))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h2 style={{ margin: 0, color: 'var(--accent-cyan)' }}>{cup.name}</h2>
            <p style={{ color: 'var(--text-muted)', margin: '5px 0 0 0' }}>
              Entry: £{cup.entryFee} | Prize Pot: £{prizePot} | Players: {cup.players?.length || 0}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ 
              padding: '8px 20px', 
              borderRadius: '25px',
              background: cup.status === 'completed' ? 'var(--success)' : 'var(--accent-cyan)',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '1rem'
            }}>
              {cup.status === 'completed' ? '🏆 Completed' : `Round ${activeRound}`}
            </span>
          </div>
        </div>
      </div>

      {cupWinner ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px',
          background: 'linear-gradient(135deg, #ffd700, #ff8c00, #ff6b00)',
          borderRadius: '16px',
          marginBottom: '20px',
          boxShadow: '0 10px 40px rgba(255, 215, 0, 0.3)'
        }}>
          <h2 style={{ margin: 0, color: 'white', fontSize: '1.5rem' }}>🏆 CHAMPION 🏆</h2>
          <h1 style={{ margin: '15px 0', fontSize: '3rem', color: 'white', textShadow: '2px 2px 4px rgba(0,0,0,0.3)' }}>
            {allUsers.find(u => u.id === cupWinner)?.username || 'Unknown'}
          </h1>
        </div>
      ) : null}

      <div className="card" style={{ padding: '30px' }}>
        <h3 className="card-title" style={{ textAlign: 'center', marginBottom: '30px' }}>Tournament Bracket</h3>
        <div style={{ overflowX: 'auto', padding: '20px 0' }}>
          <div style={{ 
            display: 'flex', 
            gap: '0',
            minWidth: 'max-content',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {displayRounds.map((round, roundIndex) => {
              const matches = getMatchesForRound(round)
              const matchHeight = 120
              const matchGap = 20
              const roundGap = 60
              
              return (
                <div key={round} style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    gap: matchGap,
                    padding: '20px 0'
                  }}>
                    <div style={{ 
                      textAlign: 'center', 
                      marginBottom: '15px',
                      padding: '8px 16px',
                      background: round === activeRound ? 'var(--accent-cyan)' : 'var(--bg-secondary)',
                      color: round === activeRound ? 'white' : 'var(--text)',
                      borderRadius: '20px',
                      fontWeight: 'bold',
                      fontSize: '0.9rem'
                    }}>
                      {getRoundName(round)}
                      {round === activeRound && <span style={{ marginLeft: '5px' }}>◀</span>}
                    </div>
                    
                    {matches.map((match, matchIndex) => {
                      const result = getMatchResult(match)
                      const isMatchActive = round === activeRound && match.player1 && match.player2 && !match.winner
                      const hasPlayers = match.player1 && match.player2
                      const isLocked = !hasPlayers && round > 1
                      
                      return (
                        <div key={match.id} style={{ position: 'relative' }}>
                          <div style={{ 
                            background: isLocked ? 'var(--bg-primary)' : 'var(--bg-secondary)', 
                            padding: '12px 20px', 
                            borderRadius: '10px',
                            border: match.winner 
                              ? '3px solid var(--success)' 
                              : isMatchActive 
                                ? '3px solid var(--accent-cyan)' 
                                : isLocked
                                  ? '2px dashed var(--text-muted)'
                                  : '2px solid var(--border)',
                            minWidth: '160px',
                            opacity: isLocked ? 0.6 : 1,
                            boxShadow: match.winner 
                              ? '0 0 15px rgba(34, 197, 94, 0.3)' 
                              : isMatchActive 
                                ? '0 0 15px rgba(34, 197, 94, 0.2)' 
                                : 'none'
                          }}>
                            <div style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center',
                              padding: '8px 0',
                              borderBottom: '1px solid var(--border)'
                            }}>
                              <span style={{ 
                                fontSize: '0.9rem',
                                fontWeight: match.winner === match.player1 ? 'bold' : 'normal',
                                color: match.winner === match.player1 ? 'var(--success)' : 
                                       !match.player1 ? 'var(--text-muted)' : 'inherit'
                              }}>
                                {allUsers.find(u => u.id === match.player1)?.username || 'TBD'}
                              </span>
                              {result && (
                                <span style={{ 
                                  fontSize: '1rem', 
                                  fontWeight: 'bold',
                                  color: match.winner === match.player1 ? 'var(--success)' : 'var(--error)'
                                }}>
                                  {result.score1}
                                </span>
                              )}
                              {match.winner === match.player1 && (
                                <span style={{ color: 'var(--success)', fontSize: '0.8rem' }}>✓</span>
                              )}
                            </div>
                            <div style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center',
                              padding: '8px 0'
                            }}>
                              <span style={{ 
                                fontSize: '0.9rem',
                                fontWeight: match.winner === match.player2 ? 'bold' : 'normal',
                                color: match.winner === match.player2 ? 'var(--success)' : 
                                       !match.player2 ? 'var(--text-muted)' : 'inherit'
                              }}>
                                {allUsers.find(u => u.id === match.player2)?.username || 'TBD'}
                              </span>
                              {result && (
                                <span style={{ 
                                  fontSize: '1rem', 
                                  fontWeight: 'bold',
                                  color: match.winner === match.player2 ? 'var(--success)' : 'var(--error)'
                                }}>
                                  {result.score2}
                                </span>
                              )}
                              {match.winner === match.player2 && (
                                <span style={{ color: 'var(--success)', fontSize: '0.8rem' }}>✓</span>
                              )}
                            </div>
                          </div>
                          
                          {roundIndex < displayRounds.length - 1 && hasPlayers && (
                            <>
                              <div style={{
                                position: 'absolute',
                                right: '-30px',
                                top: '50%',
                                width: '30px',
                                height: '2px',
                                background: 'var(--border)'
                              }} />
                              {(matchIndex % 2 === 0) && (
                                <div style={{
                                  position: 'absolute',
                                  right: '-30px',
                                  top: `calc(50% + ${matchHeight/2 + matchGap/2}px)`,
                                  width: '30px',
                                  height: `${matchHeight + matchGap}px`,
                                  borderRight: '2px solid var(--border)',
                                  borderTop: '2px solid var(--border)',
                                  borderBottom: matchIndex < matches.length - 2 ? '2px solid var(--border)' : 'none',
                                  borderRadius: '0 10px 10px 0'
                                }} />
                              )}
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  
                  {roundIndex < displayRounds.length - 1 && (
                    <div style={{ 
                      width: '60px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      color: 'var(--text-muted)',
                      fontSize: '1.5rem'
                    }}>
                      ➜
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

      </div>

      <div className="card" style={{ marginTop: '20px' }}>
        <h3 className="card-title">Match Schedule</h3>
        {fixtures.filter(f => f.status !== 'approved').length === 0 ? (
          <p style={{ color: 'var(--success)', textAlign: 'center', padding: '20px' }}>
            ✓ All matches completed!
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
            {fixtures.filter(f => f.status !== 'approved').map(fixture => (
              <div key={fixture.id} style={{ 
                padding: '20px', 
                background: 'var(--bg-secondary)', 
                borderRadius: '12px',
                borderLeft: '4px solid var(--accent-cyan)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ 
                    fontWeight: 'bold',
                    color: 'var(--accent-cyan)'
                  }}>
                    {getRoundName(fixture.round)}
                  </span>
                  <span style={{ 
                    padding: '4px 10px', 
                    borderRadius: '15px',
                    background: fixture.status === 'pending' ? 'var(--warning)' : 'var(--accent-cyan)',
                    color: 'white',
                    fontSize: '0.8rem'
                  }}>
                    {fixture.status === 'pending' ? 'Pending' : 'Accepted'}
                  </span>
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                  {allUsers.find(u => u.id === fixture.player1)?.username || 'TBD'} 
                  <span style={{ color: 'var(--text-muted)', margin: '0 10px' }}>vs</span>
                  {allUsers.find(u => u.id === fixture.player2)?.username || 'TBD'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
