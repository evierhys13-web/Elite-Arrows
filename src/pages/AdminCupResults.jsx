import { useAuth } from '../context/AuthContext'

function AdminCupResults() {
  const { getAllUsers } = useAuth()
  const allUsers = getAllUsers()
  const cups = JSON.parse(localStorage.getItem('eliteArrowsCups') || '[]')

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
        } else {
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

    const p1Name = allUsers.find(u => u.id === match.player1)?.username || 'Unknown'
    const p2Name = allUsers.find(u => u.id === match.player2)?.username || 'Unknown'
    const winnerName = winnerNum === 1 ? p1Name : p2Name

    alert(`${winnerName} wins!`)
    window.location.reload()
  }

  if (cups.length === 0) {
    return <p style={{ color: 'var(--text-muted)' }}>No cups created yet</p>
  }

  const activeCups = cups.filter(cup => cup.status !== 'completed')

  if (activeCups.length === 0) {
    return <p style={{ color: 'var(--text-muted)' }}>No active cups</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
      {activeCups.map(cup => (
        <div key={cup.id} style={{ 
          padding: '15px', 
          background: 'var(--bg-secondary)', 
          borderRadius: '8px' 
        }}>
          <h4 style={{ marginBottom: '10px', color: 'var(--accent-cyan)' }}>{cup.name}</h4>
          {cup.matches?.filter(m => m.player1 && m.player2).map(match => {
            const p1Name = allUsers.find(u => u.id === match.player1)?.username || 'Unknown'
            const p2Name = allUsers.find(u => u.id === match.player2)?.username || 'Unknown'
            const isComplete = match.winner !== null
            
            return (
              <div key={match.id} style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '10px',
                background: isComplete ? 'rgba(34, 197, 94, 0.1)' : 'var(--bg-primary)',
                borderRadius: '6px',
                marginBottom: '8px'
              }}>
                <span style={{ fontWeight: 'bold' }}>
                  {p1Name} vs {p2Name}
                </span>
                {isComplete ? (
                  <span style={{ color: 'var(--success)' }}>
                    Winner: {match.winner === match.player1 ? p1Name : p2Name}
                  </span>
                ) : (
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button 
                      className="btn btn-success btn-sm"
                      onClick={() => enterResult(cup, match, 1)}
                    >
                      {p1Name} wins
                    </button>
                    <button 
                      className="btn btn-success btn-sm"
                      onClick={() => enterResult(cup, match, 2)}
                    >
                      {p2Name} wins
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

export default AdminCupResults
