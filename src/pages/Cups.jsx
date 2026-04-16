import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function CupTournaments() {
  const { user, getAllUsers } = useAuth()
  const [showCreate, setShowCreate] = useState(false)
  const [formData, setFormData] = useState({ name: '', entryFee: 5, maxPlayers: 8 })
  const [selectedPlayers, setSelectedPlayers] = useState([])
  const [matches, setMatches] = useState([])
  const [winner, setWinner] = useState(null)
  
  const ADMIN_EMAILS = ['rhyshowe2023@outlook.com', 'dhineberry@yahoo.com']
  const isEmailAdmin = ADMIN_EMAILS.includes(user?.email?.toLowerCase())
  const isDbAdmin = user?.isAdmin === true
  const isTournamentAdmin = user?.isTournamentAdmin === true
  const isAdmin = isEmailAdmin || isDbAdmin || isTournamentAdmin
  const isSubscribed = user?.isSubscribed === true

  const allUsers = getAllUsers()
  const subscribedUsers = allUsers.filter(u => u.isSubscribed)
  const cups = JSON.parse(localStorage.getItem('eliteArrowsCups') || '[]')
  const fixtures = JSON.parse(localStorage.getItem('eliteArrowsFixtures') || '[]')

  const handlePlayerSelect = (playerId) => {
    if (selectedPlayers.includes(playerId)) {
      setSelectedPlayers(selectedPlayers.filter(id => id !== playerId))
    } else if (selectedPlayers.length < formData.maxPlayers) {
      setSelectedPlayers([...selectedPlayers, playerId])
    }
  }

  const createBracket = () => {
    if (selectedPlayers.length < 2) return alert('Need at least 2 players')
    if (selectedPlayers.length > formData.maxPlayers) return alert(`Max ${formData.maxPlayers} players`)
    
    const shuffled = [...selectedPlayers].sort(() => Math.random() - 0.5)
    const newMatches = []
    const numRounds = Math.ceil(Math.log2(shuffled.length))
    
    let matchId = 1
    for (let round = 1; round <= numRounds; round++) {
      const matchesInRound = Math.ceil(shuffled.length / Math.pow(2, round))
      for (let i = 0; i < matchesInRound; i++) {
        const p1Index = i * 2
        const p2Index = i * 2 + 1
        newMatches.push({
          id: matchId++,
          round,
          matchNum: i + 1,
          player1: shuffled[p1Index] || null,
          player2: shuffled[p2Index] || null,
          winner: null,
          nextMatchId: round < numRounds ? Math.floor((matchId - 1) / 2) + 1 + (numRounds - 1) : null
        })
      }
    }
    
    setMatches(newMatches)
    setWinner(null)
  }

  const handleWinner = (matchId, winnerId) => {
    const updated = matches.map(m => {
      if (m.id === matchId) {
        return { ...m, winner: winnerId }
      }
      if (m.nextMatchId === matchId && m.player1 === null) {
        return { ...m, player1: winnerId }
      }
      if (m.nextMatchId === matchId && m.player2 === null) {
        return { ...m, player2: winnerId }
      }
      return m
    })
    setMatches(updated)
    
    const finalMatch = updated.find(m => m.round === Math.max(...updated.map(ma => ma.round)))
    if (finalMatch?.winner) {
      setWinner(finalMatch.winner)
    }
  }

  const saveCup = () => {
    if (!formData.name) return alert('Enter cup name')
    
    const cupMatches = matches.filter(m => m.player1 && m.player2)
    const newFixtures = cupMatches.map(m => ({
      id: Date.now() + m.id,
      cupId: Date.now(),
      cupName: formData.name,
      player1: m.player1,
      player2: m.player2,
      matchId: m.id,
      round: m.round,
      date: '',
      time: '',
      scheduledBy: null,
      status: 'pending',
      createdAt: new Date().toISOString()
    }))
    
    const existingFixtures = JSON.parse(localStorage.getItem('eliteArrowsFixtures') || '[]')
    localStorage.setItem('eliteArrowsFixtures', JSON.stringify([...existingFixtures, ...newFixtures]))
    
    const newCup = {
      id: Date.now(),
      ...formData,
      players: selectedPlayers,
      matches,
      createdAt: new Date().toISOString(),
      status: 'active'
    }
    localStorage.setItem('eliteArrowsCups', JSON.stringify([...cups, newCup]))
    alert('Cup tournament created! Fixtures have been generated for each match.')
    setShowCreate(false)
    setSelectedPlayers([])
    setMatches([])
  }

  if (!isSubscribed && !isAdmin) {
    return (
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Cup Tournaments</h1>
        </div>
        <div className="card">
          <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
            Subscribe to access Cup Tournaments.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Cup Tournaments</h1>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            + Create Cup
          </button>
        )}
      </div>

      {showCreate && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <h3 className="card-title">Create Cup Tournament</h3>
          <div className="form-group">
            <label>Cup Name</label>
            <input 
              type="text" 
              value={formData.name} 
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="e.g., Winter Cup 2024"
            />
          </div>
          <div className="form-group">
            <label>Entry Fee (£)</label>
            <input 
              type="number" 
              value={formData.entryFee} 
              onChange={(e) => setFormData({...formData, entryFee: parseInt(e.target.value)})}
            />
          </div>
          <div className="form-group">
            <label>Max Players</label>
            <select 
              value={formData.maxPlayers} 
              onChange={(e) => setFormData({...formData, maxPlayers: parseInt(e.target.value)})}
            >
              <option value={4}>4</option>
              <option value={8}>8</option>
              <option value={16}>16</option>
              <option value={32}>32</option>
              <option value={64}>64</option>
            </select>
          </div>
          
          <h4 style={{ marginTop: '20px', marginBottom: '10px' }}>Select Players ({selectedPlayers.length}/{formData.maxPlayers})</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {subscribedUsers.map(p => (
              <button
                key={p.id}
                className={`btn ${selectedPlayers.includes(p.id) ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => handlePlayerSelect(p.id)}
                style={{ padding: '8px 12px', fontSize: '0.85rem' }}
              >
                {p.username}
              </button>
            ))}
          </div>

          {selectedPlayers.length >= 2 && (
            <button className="btn btn-primary btn-block" style={{ marginTop: '20px' }} onClick={createBracket}>
              Generate Bracket
            </button>
          )}

          {matches.length > 0 && (
            <>
              <h4 style={{ marginTop: '20px', marginBottom: '15px' }}>Bracket</h4>
              <div style={{ display: 'flex', gap: '20px', overflowX: 'auto', padding: '10px' }}>
                {Array.from(new Set(matches.map(m => m.round))).map(round => (
                  <div key={round} style={{ minWidth: '200px' }}>
                    <h5 style={{ color: 'var(--accent-cyan)', marginBottom: '10px' }}>
                      {round === Math.max(...matches.map(m => m.round)) ? 'Final' : 
                       round === Math.max(...matches.map(m => m.round)) - 1 ? 'Semi-Final' : `Round ${round}`}
                    </h5>
                    {matches.filter(m => m.round === round).map(match => (
                      <div key={match.id} style={{ 
                        background: 'var(--bg-secondary)', 
                        padding: '10px', 
                        borderRadius: '8px',
                        marginBottom: '10px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                          <button 
                            className={`btn btn-sm ${match.winner === match.player1 ? 'btn-success' : 'btn-secondary'}`}
                            onClick={() => match.player1 && !match.winner && handleWinner(match.id, match.player1)}
                            disabled={!match.player1 || match.winner}
                          >
                            {allUsers.find(u => u.id === match.player1)?.username || 'TBD'}
                          </button>
                          <span style={{ color: 'var(--text-muted)' }}>vs</span>
                          <button 
                            className={`btn btn-sm ${match.winner === match.player2 ? 'btn-success' : 'btn-secondary'}`}
                            onClick={() => match.player2 && !match.winner && handleWinner(match.id, match.player2)}
                            disabled={!match.player2 || match.winner}
                          >
                            {allUsers.find(u => u.id === match.player2)?.username || 'TBD'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {winner && (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '20px', 
                  background: 'linear-gradient(135deg, #ffd700, #ff8c00)',
                  borderRadius: '12px',
                  marginTop: '20px'
                }}>
                  <h3>🏆 Winner: {allUsers.find(u => u.id === winner)?.username}</h3>
                </div>
              )}

              <button className="btn btn-primary btn-block" style={{ marginTop: '20px' }} onClick={saveCup}>
                Save Cup (Creates Fixtures)
              </button>
            </>
          )}

          <button className="btn btn-secondary btn-block" style={{ marginTop: '10px' }} onClick={() => setShowCreate(false)}>
            Cancel
          </button>
        </div>
      )}

      {cups.length === 0 && !showCreate && (
        <div className="card">
          <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
            No cup tournaments yet. Create one to get started!
          </p>
        </div>
      )}

      {cups.map(cup => {
        const prizePot = cup.entryFee * (cup.players?.length || 0)
        return (
          <div key={cup.id} className="card" style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="card-title" style={{ margin: 0 }}>{cup.name}</h3>
              {isAdmin && (
                <button 
                  className="btn btn-danger btn-sm"
                  onClick={() => {
                    if (confirm(`Are you sure you want to delete "${cup.name}"?`)) {
                      const updatedCups = cups.filter(c => c.id !== cup.id)
                      localStorage.setItem('eliteArrowsCups', JSON.stringify(updatedCups))
                      window.location.reload()
                    }
                  }}
                >
                  Delete Cup
                </button>
              )}
            </div>
            <p style={{ color: 'var(--text-muted)', marginTop: '10px' }}>
              Entry: £{cup.entryFee} | Players: {cup.players?.length || 0} | Prize Pot: £{prizePot}
            </p>
          </div>
        )
      })}
    </div>
  )
}
