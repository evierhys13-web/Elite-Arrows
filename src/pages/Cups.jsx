import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Link } from 'react-router-dom'

export default function CupTournaments() {
  const { user, getAllUsers } = useAuth()
  const [showCreate, setShowCreate] = useState(false)
  const [formData, setFormData] = useState({ name: '', entryFee: 5, maxPlayers: 8 })
  const [selectedPlayers, setSelectedPlayers] = useState([])
  const [matches, setMatches] = useState([])
  
  const ADMIN_EMAILS = ['rhyshowe2023@outlook.com', 'dhineberry@yahoo.com']
  const isEmailAdmin = ADMIN_EMAILS.includes(user?.email?.toLowerCase())
  const isDbAdmin = user?.isAdmin === true
  const isTournamentAdmin = user?.isTournamentAdmin === true
  const isAdmin = isEmailAdmin || isDbAdmin || isTournamentAdmin
  const isSubscribed = user?.isSubscribed === true

  const allUsers = getAllUsers()
  const cups = JSON.parse(localStorage.getItem('eliteArrowsCups') || '[]')

  const handlePlayerSelect = (playerId) => {
    if (selectedPlayers.includes(playerId)) {
      setSelectedPlayers(selectedPlayers.filter(id => id !== playerId))
    } else if (selectedPlayers.length < formData.maxPlayers) {
      setSelectedPlayers([...selectedPlayers, playerId])
    }
  }

  const createBracket = () => {
    if (selectedPlayers.length < 2) return alert('Need at least 2 players')
    
    const shuffled = [...selectedPlayers].sort(() => Math.random() - 0.5)
    const newMatches = []
    const numRounds = Math.ceil(Math.log2(shuffled.length))
    
    let matchId = 1
    let roundStartId = 1
    
    for (let round = 1; round <= numRounds; round++) {
      const matchesInRound = Math.ceil(shuffled.length / Math.pow(2, round))
      const nextRoundStartId = matchId + matchesInRound
      
      for (let i = 0; i < matchesInRound; i++) {
        const p1Index = i * 2
        const p2Index = i * 2 + 1
        
        newMatches.push({
          id: matchId,
          round,
          matchNum: i + 1,
          player1: round === 1 ? (shuffled[p1Index] || null) : null,
          player2: round === 1 ? (shuffled[p2Index] || null) : null,
          winner: null,
          nextMatchId: round < numRounds ? roundStartId + matchesInRound + Math.floor(i / 2) : null
        })
        matchId++
      }
      roundStartId = nextRoundStartId
    }
    
    setMatches(newMatches)
  }

  const saveCup = () => {
    if (!formData.name) return alert('Enter cup name')
    if (matches.length === 0) return alert('Generate a bracket first')
    
    const newCup = {
      id: Date.now(),
      ...formData,
      players: selectedPlayers,
      matches,
      createdAt: new Date().toISOString(),
      status: 'active',
      currentRound: 1
    }
    
    const round1Matches = matches.filter(m => m.round === 1)
    const existingFixtures = JSON.parse(localStorage.getItem('eliteArrowsFixtures') || '[]')
    
    const newFixtures = round1Matches.map(m => ({
      id: Date.now() + m.id,
      cupId: newCup.id,
      cupName: formData.name,
      player1: m.player1,
      player2: m.player2,
      matchId: m.id,
      round: 1,
      date: '',
      time: '',
      scheduledBy: m.player1,
      status: 'pending',
      proposedDate: '',
      proposedTime: '',
      counterDate: '',
      counterTime: '',
      createdAt: new Date().toISOString()
    }))
    
    localStorage.setItem('eliteArrowsFixtures', JSON.stringify([...existingFixtures, ...newFixtures]))
    localStorage.setItem('eliteArrowsCups', JSON.stringify([...cups, newCup]))
    alert('Cup tournament created! Fixtures have been created for Round 1 matches.')
    setShowCreate(false)
    setSelectedPlayers([])
    setMatches([])
    window.location.reload()
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
            {allUsers.map(p => (
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
              <h4 style={{ marginTop: '20px', marginBottom: '15px' }}>Bracket Preview</h4>
              <div style={{ display: 'flex', gap: '20px', overflowX: 'auto', padding: '10px' }}>
                {Array.from(new Set(matches.map(m => m.round))).sort((a, b) => b - a).map(round => (
                  <div key={round} style={{ minWidth: '200px' }}>
                    <h5 style={{ color: 'var(--accent-cyan)', marginBottom: '10px' }}>
                      {round === Math.max(...matches.map(m => m.round)) ? 'Final' : 
                       round === Math.max(...matches.map(m => m.round)) - 1 ? 'Semi-Final' : 
                       round === Math.max(...matches.map(m => m.round)) - 2 ? 'Quarter-Final' : `Round ${round}`}
                    </h5>
                    {matches.filter(m => m.round === round).map(match => (
                      <div key={match.id} style={{ 
                        background: 'var(--bg-secondary)', 
                        padding: '10px', 
                        borderRadius: '8px',
                        marginBottom: '10px'
                      }}>
                        <div style={{ fontSize: '0.85rem', textAlign: 'center' }}>
                          {allUsers.find(u => u.id === match.player1)?.username || 'TBD'} vs {allUsers.find(u => u.id === match.player2)?.username || 'TBD'}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <button className="btn btn-primary btn-block" style={{ marginTop: '20px' }} onClick={saveCup}>
                Create Cup Tournament
              </button>
            </>
          )}

          <button className="btn btn-secondary btn-block" style={{ marginTop: '10px' }} onClick={() => { setShowCreate(false); setSelectedPlayers([]); setMatches([]); }}>
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
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <Link to={`/cups/${cup.id}`} className="btn btn-primary btn-sm">
                  View Bracket
                </Link>
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
                    Delete
                  </button>
                )}
              </div>
            </div>
            <p style={{ color: 'var(--text-muted)', marginTop: '10px' }}>
              Entry: £{cup.entryFee} | Players: {cup.players?.length || 0} | Prize Pot: £{prizePot}
            </p>
            <p style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)' }}>
              Status: {cup.status === 'completed' ? 'Completed' : `Active - Round ${cup.currentRound || 1}`}
            </p>
          </div>
        )
      })}
    </div>
  )
}
