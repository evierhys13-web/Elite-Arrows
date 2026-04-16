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
    if (round === totalRounds) return 'Final'
    if (round === totalRounds - 1) return 'Semi-Final'
    if (round === totalRounds - 2) return 'Quarter-Final'
    return `Round ${round}`
  }

  const getMatchResult = (match) => {
    const fixture = fixtures.find(f => f.matchId === match.id && f.status === 'approved')
    return fixture ? { score1: fixture.score1, score2: fixture.score2 } : null
  }

  const rounds = []
  for (let i = 1; i <= totalRounds; i++) {
    rounds.push(i)
  }

  return (
    <div className="page">
      <div className="page-header">
        <Link to="/cups" className="btn btn-secondary">← Back to Cups</Link>
      </div>
      
      <div className="card" style={{ marginBottom: '20px' }}>
        <h2>{cup.name}</h2>
        <p style={{ color: 'var(--text-muted)' }}>
          Entry: £{cup.entryFee} | Prize Pot: £{prizePot} | Players: {cup.players?.length || 0}
        </p>
        <span style={{ 
          padding: '5px 15px', 
          borderRadius: '15px',
          background: cup.status === 'completed' ? 'var(--success)' : 'var(--accent-cyan)',
          color: 'white',
          fontWeight: 'bold'
        }}>
          {cup.status === 'completed' ? '🏆 Completed' : 'In Progress'}
        </span>
      </div>

      {cupWinner && (
        <div className="card" style={{ 
          textAlign: 'center', 
          padding: '30px',
          background: 'linear-gradient(135deg, #ffd700, #ff8c00)',
          marginBottom: '20px'
        }}>
          <h2 style={{ color: 'white' }}>🏆 CHAMPION</h2>
          <h1 style={{ color: 'white', margin: '10px 0' }}>
            {allUsers.find(u => u.id === cupWinner)?.username || 'Unknown'}
          </h1>
        </div>
      )}

      <div className="card">
        <h3 className="card-title">Tournament Bracket</h3>
        <div style={{ display: 'flex', gap: '20px', overflowX: 'auto', padding: '20px 0' }}>
          {rounds.map(round => {
            const matches = cup.matches?.filter(m => m.round === round).sort((a, b) => a.id - b.id) || []
            return (
              <div key={round} style={{ minWidth: '200px' }}>
                <h4 style={{ 
                  textAlign: 'center', 
                  color: 'var(--accent-cyan)',
                  marginBottom: '15px',
                  padding: '8px',
                  background: 'var(--bg-secondary)',
                  borderRadius: '8px'
                }}>
                  {getRoundName(round)}
                </h4>
                {matches.map(match => {
                  const result = getMatchResult(match)
                  const hasPlayers = match.player1 && match.player2
                  const isComplete = match.winner !== null
                  
                  return (
                    <div key={match.id} style={{ 
                      background: 'var(--bg-secondary)', 
                      padding: '15px', 
                      borderRadius: '10px',
                      marginBottom: '10px',
                      border: isComplete ? '2px solid var(--success)' : '2px solid var(--border)',
                      opacity: !hasPlayers && round > 1 ? 0.5 : 1
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ 
                          fontWeight: match.winner === match.player1 ? 'bold' : 'normal',
                          color: match.winner === match.player1 ? 'var(--success)' : 'inherit'
                        }}>
                          {allUsers.find(u => u.id === match.player1)?.username || 'TBD'}
                        </span>
                        {result && (
                          <span style={{ fontWeight: 'bold' }}>{result.score1}</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ 
                          fontWeight: match.winner === match.player2 ? 'bold' : 'normal',
                          color: match.winner === match.player2 ? 'var(--success)' : 'inherit'
                        }}>
                          {allUsers.find(u => u.id === match.player2)?.username || 'TBD'}
                        </span>
                        {result && (
                          <span style={{ fontWeight: 'bold' }}>{result.score2}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      <div className="card" style={{ marginTop: '20px' }}>
        <h3 className="card-title">Match Schedule</h3>
        {fixtures.filter(f => f.status !== 'approved').length === 0 ? (
          <p style={{ color: 'var(--success)' }}>✓ All matches completed!</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {fixtures.filter(f => f.status !== 'approved').map(fixture => (
              <div key={fixture.id} style={{ 
                padding: '15px', 
                background: 'var(--bg-secondary)', 
                borderRadius: '8px'
              }}>
                <strong>{getRoundName(fixture.round)}</strong>
                <p style={{ margin: '5px 0 0 0' }}>
                  {allUsers.find(u => u.id === fixture.player1)?.username || 'TBD'} vs {allUsers.find(u => u.id === fixture.player2)?.username || 'TBD'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
