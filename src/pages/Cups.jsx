import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Link } from 'react-router-dom'
import { db, doc, setDoc, deleteDoc, getDoc, collection, query, where, getDocs, writeBatch } from '../firebase'
import { ADMIN_EMAILS } from '../config'
import UserSearchSelect from '../components/UserSearchSelect'
import { useToast } from '../context/ToastContext'

export default function CupTournaments() {
  const { user, getAllUsers, getCups, getFixtures, triggerDataRefresh } = useAuth()
  const { showToast } = useToast()
  const [showCreate, setShowCreate] = useState(false)
  const [formData, setFormData] = useState({ name: '', entryFee: 5, maxPlayers: 8 })
  const [selectedPlayers, setSelectedPlayers] = useState([])
  const [matches, setMatches] = useState([])
  const [roundFormats, setRoundFormats] = useState({})
  const [refreshKey, setRefreshKey] = useState(0)
  const [expandedCups, setExpandedCups] = useState({})
  const [showSwapModal, setShowSwapModal] = useState(false)
  const [swapCup, setSwapCup] = useState(null)
  const [playerToRemove, setPlayerToRemove] = useState('')
  const [playerToAdd, setPlayerToAdd] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const toggleCup = (cupId) => {
    setExpandedCups(prev => ({
      ...prev,
      [cupId]: !prev[cupId]
    }))
  }

  const handleSwapPlayer = async () => {
    if (!swapCup || !playerToRemove || !playerToAdd) return showToast?.('Please select both players', 'error')

    setIsSubmitting(true)
    try {
      const cupRef = doc(db, 'cups', String(swapCup.id))
      const cupSnap = await getDoc(cupRef)
      if (!cupSnap.exists()) throw new Error('Cup not found')

      const cupData = cupSnap.data()
      const newPlayer = allUsers.find(u => u.id === playerToAdd)
      if (!newPlayer) throw new Error('New player not found')

      // 1. Update participants list
      const updatedPlayers = cupData.players.map(pid => String(pid) === String(playerToRemove) ? playerToAdd : pid)

      // 2. Update all matches
      const updatedMatches = cupData.matches.map(m => ({
        ...m,
        player1: String(m.player1) === String(playerToRemove) ? playerToAdd : m.player1,
        player2: String(m.player2) === String(playerToRemove) ? playerToAdd : m.player2,
        winner: String(m.winner) === String(playerToRemove) ? playerToAdd : m.winner
      }))

      await setDoc(cupRef, { ...cupData, players: updatedPlayers, matches: updatedMatches }, { merge: true })

      // 3. Update Fixtures
      const fixturesSnap = await getDocs(query(collection(db, 'fixtures'), where('cupId', '==', parseInt(swapCup.id))))
      const batch = writeBatch(db)
      let fixtureCount = 0

      fixturesSnap.docs.forEach(fDoc => {
        const fData = fDoc.data()
        let changed = false
        const updates = {}

        if (String(fData.player1Id) === String(playerToRemove)) {
          updates.player1Id = playerToAdd
          updates.player1 = newPlayer.username
          changed = true
        }
        if (String(fData.player2Id) === String(playerToRemove)) {
          updates.player2Id = playerToAdd
          updates.player2 = newPlayer.username
          changed = true
        }

        if (changed) {
          batch.update(fDoc.ref, updates)
          fixtureCount++
        }
      })

      if (fixtureCount > 0) await batch.commit()

      showToast?.(`Swapped player in bracket and ${fixtureCount} fixtures.`, 'success')
      setShowSwapModal(false)
      setPlayerToRemove('')
      setPlayerToAdd('')
      triggerDataRefresh('all')
      setRefreshKey(prev => prev + 1)
    } catch (e) {
      showToast?.('Error: ' + e.message, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isEmailAdmin = user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase())
  const isAdmin = isEmailAdmin || user?.isAdmin || user?.isTournamentAdmin || user?.isCupAdmin
  const isSubscribed = user?.isSubscribed === true || isAdmin

  const allUsers = getAllUsers()
  const cups = getCups()
  const selectablePlayers = allUsers.filter(u => !selectedPlayers.includes(u.id))

  const handlePlayerSelect = (playerId) => {
    if (selectedPlayers.includes(playerId)) {
      setSelectedPlayers(selectedPlayers.filter(id => id !== playerId))
      setMatches([])
    } else if (selectedPlayers.length < formData.maxPlayers) {
      setSelectedPlayers([...selectedPlayers, playerId])
      setMatches([])
    }
  }

  const createBracket = () => {
    if (selectedPlayers.length < 2) return alert('Need at least 2 players')
    
    const shuffled = [...selectedPlayers].sort(() => Math.random() - 0.5)
    const newMatches = []
    const numRounds = Math.ceil(Math.log2(shuffled.length))
    
    const defaultFormats = {}
    for (let r = 1; r <= numRounds; r++) {
      if (r === numRounds) {
        defaultFormats[r] = { startScore: 501, bestOf: 9, firstTo: 5 }
      } else if (r === numRounds - 1) {
        defaultFormats[r] = { startScore: 501, bestOf: 7, firstTo: 4 }
      } else if (r === numRounds - 2) {
        defaultFormats[r] = { startScore: 501, bestOf: 5, firstTo: 3 }
      } else {
        defaultFormats[r] = { startScore: 501, bestOf: 3, firstTo: 2 }
      }
    }
    setRoundFormats(defaultFormats)
    
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

  const updateRoundFormat = (round, field, value) => {
    setRoundFormats(prev => ({
      ...prev,
      [round]: {
        ...prev[round],
        [field]: parseInt(value)
      }
    }))
  }

  const saveCup = async () => {
    if (!formData.name) return alert('Enter cup name')
    if (matches.length === 0) return alert('Generate a bracket first')
    
    const newCup = {
      id: Date.now(),
      ...formData,
      players: selectedPlayers,
      matches,
      roundFormats,
      createdAt: new Date().toISOString(),
      status: 'active',
      currentRound: 1
    }
    
    const round1Matches = matches.filter(m => m.round === 1)
    const existingFixtures = getFixtures()
    
    const newFixtures = round1Matches.map(m => ({
      id: Date.now() + m.id,
      cupId: newCup.id,
      cupName: formData.name,
      startScore: roundFormats[1]?.startScore || 501,
      bestOf: roundFormats[1]?.bestOf || 3,
      firstTo: Math.ceil((roundFormats[1]?.bestOf || 3) / 2),
      player1: m.player1,
      player1Id: m.player1,
      player2: m.player2,
      player2Id: m.player2,
      matchId: m.id,
      round: 1,
      date: '',
      time: '',
      scheduledBy: m.player1,
      status: 'accepted',
      proposalStatus: 'accepted',
      proposedDate: '',
      proposedTime: '',
      counterDate: '',
      counterTime: '',
      createdAt: new Date().toISOString()
    }))
    
    localStorage.setItem('eliteArrowsFixtures', JSON.stringify([...existingFixtures, ...newFixtures]))
    localStorage.setItem('eliteArrowsCups', JSON.stringify([...cups, newCup]))
    
    try {
      await setDoc(doc(db, 'cups', newCup.id.toString()), newCup)
      for (const fixture of newFixtures) {
        await setDoc(doc(db, 'fixtures', fixture.id.toString()), fixture)
      }
      triggerDataRefresh('cups')
      triggerDataRefresh('fixtures')
    } catch (e) {
      console.log('Error saving to Firebase:', e)
    }
    
    alert('Cup tournament created! Fixtures have been created for Round 1 matches. ' + newFixtures.length + ' fixtures made.')
    setShowCreate(false)
    setSelectedPlayers([])
    setMatches([])
    setRefreshKey(prev => prev + 1)
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
              onChange={(e) => {
                const maxPlayers = parseInt(e.target.value)
                setFormData({...formData, maxPlayers})
                setSelectedPlayers(prev => prev.slice(0, maxPlayers))
                setMatches([])
              }}
            >
              <option value={4}>4</option>
              <option value={8}>8</option>
              <option value={16}>16</option>
              <option value={32}>32</option>
              <option value={64}>64</option>
            </select>
          </div>
          
          <h4 style={{ marginTop: '20px', marginBottom: '10px' }}>Select Players ({selectedPlayers.length}/{formData.maxPlayers})</h4>
          {selectedPlayers.length < formData.maxPlayers ? (
            <UserSearchSelect
              users={selectablePlayers}
              selectedId={null}
              onSelect={handlePlayerSelect}
              placeholder="Search by name, nickname, or DartCounter..."
              label=""
              maxResults={allUsers.length}
            />
          ) : (
            <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Maximum players selected. Remove someone below to add another player.
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px', marginTop: '15px' }}>
            {selectedPlayers.map((playerId, index) => {
              const player = allUsers.find(u => u.id === playerId)
              if (!player) return null
              return (
                <div
                  key={player.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    padding: '8px 10px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px'
                  }}
                >
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {index + 1}. {player.username}
                  </span>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handlePlayerSelect(player.id)}
                    style={{ padding: '4px 8px', flexShrink: 0 }}
                  >
                    Remove
                  </button>
                </div>
              )
            })}
          </div>
          {selectedPlayers.length < 2 && (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '10px' }}>
              Search and add at least 2 players to create a cup
            </p>
          )}

          {selectedPlayers.length >= 2 && (
            <button className="btn btn-primary btn-block" style={{ marginTop: '20px' }} onClick={createBracket}>
              Generate Bracket
            </button>
          )}

          {matches.length > 0 && (
            <>
              <h4 style={{ marginTop: '20px', marginBottom: '15px' }}>Bracket Preview & Round Formats</h4>
              <div style={{ display: 'flex', gap: '20px', overflowX: 'auto', padding: '10px' }}>
                {Array.from(new Set(matches.map(m => m.round))).sort((a, b) => b - a).map(round => (
                  <div key={round} style={{ minWidth: '200px' }}>
                    <h5 style={{ color: 'var(--accent-cyan)', marginBottom: '10px' }}>
                      {round === Math.max(...matches.map(m => m.round)) ? 'Final' : 
                       round === Math.max(...matches.map(m => m.round)) - 1 ? 'Semi-Final' : 
                       round === Math.max(...matches.map(m => m.round)) - 2 ? 'Quarter-Final' : `Round ${round}`}
                    </h5>
                    
                    <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: '8px', marginBottom: '10px' }}>
                      <div className="form-group" style={{ marginBottom: '8px' }}>
                        <label style={{ fontSize: '0.75rem' }}>Start Score</label>
                        <select 
                          value={roundFormats[round]?.startScore || 501}
                          onChange={(e) => updateRoundFormat(round, 'startScore', e.target.value)}
                          style={{ fontSize: '0.8rem', padding: '5px' }}
                        >
                          <option value={301}>301</option>
                          <option value={501}>501</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ marginBottom: '0' }}>
                        <label style={{ fontSize: '0.75rem' }}>Best Of</label>
                        <select 
                          value={roundFormats[round]?.bestOf || 3}
                          onChange={(e) => updateRoundFormat(round, 'bestOf', e.target.value)}
                          style={{ fontSize: '0.8rem', padding: '5px' }}
                        >
                          <option value={3}>Best of 3</option>
                          <option value={5}>Best of 5</option>
                          <option value={7}>Best of 7</option>
                          <option value={9}>Best of 9</option>
                        </select>
                      </div>
                    </div>
                    
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
        const isExpanded = expandedCups[cup.id]

        return (
          <div key={cup.id} className="card" style={{ marginTop: '20px', padding: '0' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '20px',
                cursor: 'pointer'
              }}
              onClick={() => toggleCup(cup.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{
                  fontSize: '1.2rem',
                  transition: 'transform 0.2s',
                  transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
                }}>▶</span>
                <h3 className="card-title" style={{ margin: 0 }}>{cup.name}</h3>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                <Link to={`/cups/${cup.id}`} className="btn btn-primary btn-sm">
                  View Bracket
                </Link>
                {isAdmin && (
                  <>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSwapCup(cup)
                        setShowSwapModal(true)
                      }}
                    >
                      🔄 Swap
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                    onClick={async () => {
                      if (confirm(`Are you sure you want to delete "${cup.name}"?`)) {
                        const updatedCups = cups.filter(c => c.id !== cup.id)
                        localStorage.setItem('eliteArrowsCups', JSON.stringify(updatedCups))
                        
                        const fixtures = getFixtures()
                        const updatedFixtures = fixtures.filter(f => f.cupId !== cup.id)
                        localStorage.setItem('eliteArrowsFixtures', JSON.stringify(updatedFixtures))
                        
                        try {
                          await deleteDoc(doc(db, 'cups', cup.id.toString()))
                          for (const fixture of fixtures.filter(f => f.cupId === cup.id)) {
                            await deleteDoc(doc(db, 'fixtures', fixture.id.toString()))
                          }
                          triggerDataRefresh('cups')
                          triggerDataRefresh('fixtures')
                        } catch (e) {
                          console.log('Error deleting from Firebase:', e)
                        }
                        
                        setRefreshKey(prev => prev + 1)
                      }
                    }}
                  >
                    Delete
                  </button>
                  </>
                )}
              </div>
            </div>

            {isExpanded && (
              <div style={{
                padding: '0 20px 20px 20px',
                borderTop: '1px solid rgba(255,255,255,0.05)',
                marginTop: '0'
              }} className="animate-fade-in">
                {isAdmin && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '15px', marginBottom: '15px' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1, background: 'rgba(255,255,255,0.05)' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        setSwapCup(cup)
                        setShowSwapModal(true)
                      }}
                    >
                      🔄 Swap Participant
                    </button>
                  </div>
                )}
                <p style={{ color: 'var(--text-muted)', marginTop: '15px' }}>
                  Entry: £{cup.entryFee} | Players: {cup.players?.length || 0} | Prize Pot: £{prizePot}
                </p>
                {cup.roundFormats && (
                  <div style={{
                    fontSize: '0.85rem',
                    color: 'var(--accent-cyan)',
                    marginTop: '8px',
                    background: 'rgba(0,0,0,0.2)',
                    padding: '10px',
                    borderRadius: '8px'
                  }}>
                    <strong style={{ display: 'block', marginBottom: '5px', color: 'white' }}>Format:</strong>
                    {Object.entries(cup.roundFormats).map(([round, format]) => {
                      const roundName = parseInt(round) === cup.currentRound ? 'Current' : ''
                      return (
                        <div key={round} style={{ display: 'inline-block', marginRight: '15px' }}>
                          <span style={{ opacity: 0.7 }}>{roundName}{roundName ? ' ' : ''}R{round}:</span> {format.startScore} / Bo{format.bestOf}
                        </div>
                      )
                    })}
                  </div>
                )}
                <p style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)', marginTop: '12px', fontWeight: 'bold' }}>
                  Status: {cup.status === 'completed' ? 'Completed' : `Active - Round ${cup.currentRound || 1}`}
                </p>
              </div>
            )}
          </div>
        )
      })}

      {showSwapModal && (
        <div className="modal-overlay">
          <div className="modal-content glass" style={{ maxWidth: '400px' }}>
            <h3 style={{ marginBottom: '20px' }}>Swap Player in Cup</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Replace a participant throughout the entire bracket and all fixtures for <strong>{swapCup?.name}</strong>.
            </p>

            <div className="form-group">
              <label>Player to Remove</label>
              <select
                className="glass"
                value={playerToRemove}
                onChange={e => setPlayerToRemove(e.target.value)}
              >
                <option value="">Select participant...</option>
                {swapCup?.players?.map(pid => {
                  const p = allUsers.find(u => u.id === pid)
                  return <option key={pid} value={pid}>{p?.username || pid}</option>
                })}
              </select>
            </div>

            <div className="form-group">
              <label>Replacement Player</label>
              <UserSearchSelect
                users={allUsers.filter(u => !(swapCup?.players || []).includes(u.id))}
                selectedId={playerToAdd}
                onSelect={setPlayerToAdd}
                label=""
                placeholder="Search for new player..."
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '30px' }}>
              <button className="btn btn-secondary btn-block" onClick={() => setShowSwapModal(false)}>Cancel</button>
              <button
                className="btn btn-primary btn-block"
                onClick={handleSwapPlayer}
                disabled={isSubmitting || !playerToRemove || !playerToAdd}
              >
                {isSubmitting ? 'Swapping...' : 'Perform Swap'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
