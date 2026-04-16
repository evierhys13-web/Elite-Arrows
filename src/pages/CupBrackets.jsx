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
    return `Round ${round}`
  }

  const getMatchResult = (match) => {
    const fixture = fixtures.find(f => f.matchId === match.id && f.status === 'approved')
    if (fixture) {
      return { score1: fixture.score1, score2: fixture.score2 }
    }
    return null
  }

  return (
    <div className="page">
      <div className="page-header">
        <Link to="/cups" className="btn btn-secondary">← Back to Cups</Link>
      </div>
      
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h2 style={{ margin: 0 }}>{cup.name}</h2>
            <p style={{ color: 'var(--text-muted)', margin: '5px 0 0 0' }}>
              Entry: £{cup.entryFee} | Prize Pot: £{prizePot}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ 
              padding: '5px 15px', 
              borderRadius: '20px',
              background: cup.status === 'completed' ? 'var(--success)' : 'var(--accent-cyan)',
              color: 'white',
              fontWeight: 'bold'
            }}>
              {cup.status === 'completed' ? 'Completed' : `Round ${activeRound}`}
            </span>
          </div>
        </div>
      </div>

      {cupWinner ? (
        <div className="card" style={{ 
          textAlign: 'center', 
          padding: '30px',
          background: 'linear-gradient(135deg, #ffd700, #ff8c00)',
          borderRadius: '12px',
          marginBottom: '20px'
        }}>
          <h2 style={{ margin: 0, color: 'white' }}>🏆 Cup Winner</h2>
          <h1 style={{ margin: '10px 0', fontSize: '2.5rem', color: 'white' }}>
            {allUsers.find(u => u.id === cupWinner)?.username || 'Unknown'}
          </h1>
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', marginBottom: '20px' }}>
          <p style={{ color: 'var(--accent-cyan)', margin: 0 }}>
            Winner will be announced when all rounds are complete!
          </p>
        </div>
      )}

      <div className="card">
        <h3 className="card-title">Tournament Bracket</h3>
        <div style={{ overflowX: 'auto', padding: '10px 0' }}>
          <div style={{ 
            display: 'flex', 
            gap: '30px', 
            minWidth: 'min-content',
            alignItems: 'center'
          }}>
            {Array.from(new Set(cup.matches?.map(m => m.round) || [])).sort((a, b) => b - a).map(round => (
              <div key={round} style={{ minWidth: '180px' }}>
                <h4 style={{ 
                  color: round === activeRound ? 'var(--accent-cyan)' : 'var(--text-muted)',
                  marginBottom: '15px',
                  textAlign: 'center'
                }}>
                  {getRoundName(round)}
                  {round === activeRound && <span style={{ fontSize: '0.75rem', marginLeft: '5px' }}>(Active)</span>}
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {cup.matches?.filter(m => m.round === round).map(match => {
                    const result = getMatchResult(match)
                    return (
                      <div key={match.id} style={{ 
                        background: 'var(--bg-secondary)', 
                        padding: '12px', 
                        borderRadius: '8px',
                        border: match.winner ? '2px solid var(--success)' : '2px solid transparent',
                        opacity: round !== activeRound && !match.winner ? 0.5 : 1
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                          <span style={{ 
                            fontSize: '0.9rem',
                            fontWeight: match.winner === match.player1 ? 'bold' : 'normal',
                            color: match.winner === match.player1 ? 'var(--success)' : 'inherit'
                          }}>
                            {allUsers.find(u => u.id === match.player1)?.username || 'TBD'}
                          </span>
                          {result && (
                            <span style={{ 
                              fontSize: '0.85rem', 
                              color: match.winner === match.player1 ? 'var(--success)' : 'var(--error)'
                            }}>
                              {result.score1}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ 
                            fontSize: '0.9rem',
                            fontWeight: match.winner === match.player2 ? 'bold' : 'normal',
                            color: match.winner === match.player2 ? 'var(--success)' : 'inherit'
                          }}>
                            {allUsers.find(u => u.id === match.player2)?.username || 'TBD'}
                          </span>
                          {result && (
                            <span style={{ 
                              fontSize: '0.85rem',
                              color: match.winner === match.player2 ? 'var(--success)' : 'var(--error)'
                            }}>
                              {result.score2}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '20px' }}>
        <h3 className="card-title">Upcoming Cup Fixtures</h3>
        {fixtures.filter(f => f.status !== 'approved').length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No pending fixtures. All matches have results!</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {fixtures.filter(f => f.status !== 'approved').map(fixture => (
              <div key={fixture.id} style={{ 
                padding: '15px', 
                background: 'var(--bg-secondary)', 
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <span style={{ fontWeight: 'bold' }}>{getRoundName(fixture.round)}</span>
                  <p style={{ margin: '5px 0 0 0' }}>
                    {allUsers.find(u => u.id === fixture.player1)?.username || 'TBD'} vs {allUsers.find(u => u.id === fixture.player2)?.username || 'TBD'}
                  </p>
                </div>
                <span style={{ 
                  padding: '5px 10px', 
                  borderRadius: '5px',
                  background: fixture.status === 'pending' ? 'var(--warning)' : 'var(--accent-cyan)',
                  color: 'white',
                  fontSize: '0.85rem'
                }}>
                  {fixture.status === 'pending' ? 'Pending' : 'Accepted'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
