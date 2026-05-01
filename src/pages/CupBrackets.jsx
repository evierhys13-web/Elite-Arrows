import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function CupBracket() {
  const { cupId } = useParams()
  const { getAllUsers, getCups, getFixtures, getResults, dataRefreshTrigger } = useAuth()
  const [cup, setCup] = useState(null)
  const [fixtures, setFixtures] = useState([])
  const [results, setResults] = useState([])
  const [refreshKey, setRefreshKey] = useState(0)
  const allUsers = getAllUsers()

  useEffect(() => {
    const cups = getCups()
    const foundCup = cups.find(c => c.id === parseInt(cupId))
    if (foundCup) {
      setCup(foundCup)
    }
    
    const allFixtures = getFixtures()
    setFixtures(allFixtures.filter(f => f.cupId === parseInt(cupId)))
    setResults(getResults())
  }, [cupId, refreshKey, dataRefreshTrigger])

  useEffect(() => {
    setRefreshKey(prev => prev + 1)
  }, [dataRefreshTrigger])

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

  const getScoreForPlayer = (source, playerId, fallbackScore) => {
    const sourcePlayer1Id = source.player1Id || source.player1
    const sourcePlayer2Id = source.player2Id || source.player2
    if (String(playerId) === String(sourcePlayer1Id)) return source.score1
    if (String(playerId) === String(sourcePlayer2Id)) return source.score2
    return fallbackScore
  }

  const getMatchResult = (match) => {
    const approvedResult = results.find(result => (
      String(result.cupId || '') === String(cup.id) &&
      String(result.matchId || '') === String(match.id) &&
      String(result.status).toLowerCase() === 'approved'
    ))

    if (approvedResult) {
      return {
        score1: getScoreForPlayer(approvedResult, match.player1, approvedResult.score1),
        score2: getScoreForPlayer(approvedResult, match.player2, approvedResult.score2)
      }
    }

    if (match.score1 !== undefined && match.score1 !== null && match.score2 !== undefined && match.score2 !== null) {
      return { score1: match.score1, score2: match.score2 }
    }

    const fixture = fixtures.find(f => String(f.matchId) === String(match.id) && f.status === 'approved')
    return fixture
      ? {
        score1: getScoreForPlayer(fixture, match.player1, fixture.score1),
        score2: getScoreForPlayer(fixture, match.player2, fixture.score2)
      }
      : null
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

  const upcomingFixtures = fixtures.filter(fixture => {
    const match = cup.matches?.find(m => String(m.id) === String(fixture.matchId))
    const hasResult = ['approved', 'result_submitted', 'completed'].includes(fixture.status)
    return !hasResult && !match?.winner
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

      <div className="cup-bracket-scroll" style={{ 
        background: '#0f0f23',
        borderRadius: '16px',
        padding: '30px',
        overflowX: 'auto',
        width: '100%'
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
        
        <div className="cup-bracket-stage" style={{ 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: '0',
          width: 'max-content',
          minWidth: '100%',
          margin: '0 auto'
        }}>
          {roundsData.map((roundData, roundIndex) => {
            const isComplete = roundData.matches.every(m => m.winner)
            const isActive = !isComplete && roundData.matches.some(m => m.player1 && m.player2)
            
            return (
              <div key={roundData.round} className="cup-bracket-round" style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ 
                  minWidth: '160px',
                  padding: '0 8px'
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
                    gap: roundData.round === 1 ? '10px' : `${Math.pow(2, roundData.round - 1) * 10}px`
                  }}>
                    {roundData.matches.map((match, matchIndex) => {
                      const result = getMatchResult(match)
                      const hasPlayers = match.player1 && match.player2
                      const p1Name = getPlayerName(match.player1)
                      const p2Name = getPlayerName(match.player2)
                      const p1Won = match.winner === match.player1
                      const p2Won = match.winner === match.player2
                      
                      const containerHeight = roundData.round === 1 ? 75 : Math.pow(2, roundData.round - 1) * 75
                      const halfHeight = containerHeight / 2
                      const matchOffset = halfHeight / 2 + matchIndex * containerHeight
                      
                      return (
                        <div key={match.id} style={{ 
                          height: '75px',
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
                  <div className="cup-bracket-connector" style={{ 
                    width: '30px', 
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <div style={{ 
                      width: '30px', 
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
        {upcomingFixtures.length === 0 ? (
          <p style={{ color: 'var(--success)', textAlign: 'center' }}>✓ All matches completed!</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
            {upcomingFixtures.map(fixture => (
              <div key={fixture.id} style={{ 
                padding: '15px', 
                background: '#1e1e3f', 
                borderRadius: '10px',
                border: '1px solid var(--accent-cyan)'
              }}>
                <div style={{ 
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px'
                }}>
                  <span style={{ 
                    fontSize: '0.8rem', 
                    color: 'var(--accent-cyan)',
                    fontWeight: 'bold'
                  }}>
                    {getRoundName(fixture.round)}
                  </span>
                  <span style={{ 
                    fontSize: '0.7rem', 
                    color: 'var(--text-muted)',
                    background: 'rgba(255,255,255,0.1)',
                    padding: '2px 8px',
                    borderRadius: '4px'
                  }}>
                    {fixture.startScore || 501} / Bo{fixture.bestOf || 3}
                  </span>
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
