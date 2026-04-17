import { useAuth } from '../context/AuthContext'

function CupManagement() {
  const { getAllUsers } = useAuth()
  const allUsers = getAllUsers()
  const cups = JSON.parse(localStorage.getItem('eliteArrowsCups') || '[]')

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

  const enterResult = (cup, match, winnerNum) => {
    const cupsData = JSON.parse(localStorage.getItem('eliteArrowsCups') || '[]')
    const cupIndex = cupsData.findIndex(c => c.id === cup.id)
    if (cupIndex === -1) return

    const cupData = cupsData[cupIndex]
    const winnerId = winnerNum === 1 ? match.player1 : match.player2

    const updatedMatches = cupData.matches.map(m => 
      m.id === match.id ? { ...m, winner: winnerId } : m
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

    cupsData[cupIndex] = { ...cupData, matches: updatedMatches, status: allComplete ? 'completed' : 'active' }
    localStorage.setItem('eliteArrowsCups', JSON.stringify(cupsData))

    const p1Name = getPlayerName(match.player1)
    const p2Name = getPlayerName(match.player2)
    const winnerName = winnerNum === 1 ? p1Name : p2Name

    alert(`${winnerName} wins!`)
    window.location.reload()
  }

  const deleteCup = (cup) => {
    if (!confirm(`Are you sure you want to delete "${cup.name}"?`)) return
    
    const cupsData = JSON.parse(localStorage.getItem('eliteArrowsCups') || '[]')
    const updatedCups = cupsData.filter(c => c.id !== cup.id)
    localStorage.setItem('eliteArrowsCups', JSON.stringify(updatedCups))
    
    const fixtures = JSON.parse(localStorage.getItem('eliteArrowsFixtures') || '[]')
    const updatedFixtures = fixtures.filter(f => f.cupId !== cup.id)
    localStorage.setItem('eliteArrowsFixtures', JSON.stringify(updatedFixtures))
    
    alert('Cup deleted!')
    window.location.reload()
  }

  const completeCup = (cup) => {
    const cupsData = JSON.parse(localStorage.getItem('eliteArrowsCups') || '[]')
    const cupIndex = cupsData.findIndex(c => c.id === cup.id)
    if (cupIndex !== -1) {
      cupsData[cupIndex].status = 'completed'
      localStorage.setItem('eliteArrowsCups', JSON.stringify(cupsData))
      alert('Cup marked as completed!')
      window.location.reload()
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
                  Delete
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
                      <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>
                        Winner: {winnerName}
                      </span>
                    ) : (
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button 
                          className="btn btn-primary btn-sm"
                          onClick={() => enterResult(cup, match, 1)}
                          disabled={!match.player1 || !match.player2}
                        >
                          {p1Name} wins
                        </button>
                        <button 
                          className="btn btn-primary btn-sm"
                          onClick={() => enterResult(cup, match, 2)}
                          disabled={!match.player1 || !match.player2}
                        >
                          {p2Name} wins
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {cup.status !== 'completed' && completedMatches.length > 0 && (
              <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid var(--border)' }}>
                <h4 style={{ marginBottom: '10px' }}>Advance to Next Rounds</h4>
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
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button 
                          className="btn btn-primary btn-sm"
                          onClick={() => enterResult(cup, match, 1)}
                        >
                          {p1Name} wins
                        </button>
                        <button 
                          className="btn btn-primary btn-sm"
                          onClick={() => enterResult(cup, match, 2)}
                        >
                          {p2Name} wins
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default CupManagement
