import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Tournaments() {
  const { user, getAllUsers } = useAuth()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showSignupForm, setShowSignupForm] = useState(null)
  const [formData, setFormData] = useState({ 
    name: '', type: 'knockout', divisions: [], entryFee: 0,
    isCashBased: false, prizeInfo: '', maxParticipants: 16,
    entryDeadline: '', daysBetweenRounds: 3,
    formatR1: '3', formatR2: '3', formatQF: '3', formatSF: '5', formatF: '7'
  })
  const [paymentProof, setPaymentProof] = useState('')
  const [trigger, setTrigger] = useState(0)
  const allUsers = getAllUsers()

  const tournaments = JSON.parse(localStorage.getItem('eliteArrowsTournaments') || '[]')
  const tournamentSignups = JSON.parse(localStorage.getItem('eliteArrowsTournamentSignups') || '[]')
  const tournamentMatches = JSON.parse(localStorage.getItem('eliteArrowsTournamentMatches') || '[]')

  useEffect(() => {
    const checkDeadlines = () => {
      tournaments.forEach(t => {
        if (t.status === 'open' && t.entryDeadline && new Date(t.entryDeadline) < new Date()) {
          generateBracket(t.id)
        }
      })
    }
    checkDeadlines()
    const interval = setInterval(checkDeadlines, 60000)
    return () => clearInterval(interval)
  }, [tournaments])

  const getRoundsNeeded = (playerCount) => {
    if (playerCount <= 2) return 1
    if (playerCount <= 4) return 2
    if (playerCount <= 8) return 3
    if (playerCount <= 16) return 4
    if (playerCount <= 32) return 5
    if (playerCount <= 64) return 6
    return 7
  }

  const getRoundName = (roundNum, totalRounds) => {
    const names = {
      1: ['Final'],
      2: ['Semi Finals', 'Final'],
      3: ['Quarter Finals', 'Semi Finals', 'Final'],
      4: ['Round of 16', 'Quarter Finals', 'Semi Finals', 'Final'],
      5: ['Round of 32', 'Round of 16', 'Quarter Finals', 'Semi Finals', 'Final'],
      6: ['Round of 64', 'Round of 32', 'Round of 16', 'Quarter Finals', 'Semi Finals', 'Final']
    }
    const total = Math.ceil(Math.log2(playerCount))
    return names[total]?.[roundNum - 1] || `Round ${roundNum}`
  }

  const generateBracket = (tournamentId) => {
    const tournament = tournaments.find(t => t.id === tournamentId)
    if (!tournament) return

    const approvedSignups = tournamentSignups.filter(s => s.tournamentId === tournamentId && s.status === 'approved')
    if (approvedSignups.length < 2) return

    const playerCount = tournament.maxParticipants
    const roundsNeeded = getRoundsNeeded(playerCount)
    const dayGap = tournament.daysBetweenRounds || 3

    const startDate = new Date(tournament.entryDeadline || Date.now())
    const rounds = []

    for (let r = 1; r <= roundsNeeded; r++) {
      const roundDate = new Date(startDate)
      roundDate.setDate(roundDate.getDate() + (r * dayGap))
      rounds.push({
        name: getRoundName(r, roundsNeeded),
        date: roundDate.toISOString(),
        format: getFormatForRound(r, roundsNeeded, tournament),
        matches: []
      })
    }

    const shuffledPlayers = [...approvedSignups].sort(() => Math.random() - 0.5)
    const firstRoundMatches = []
    
    for (let i = 0; i < shuffledPlayers.length; i += 2) {
      if (i + 1 < shuffledPlayers.length) {
        firstRoundMatches.push({
          player1Id: shuffledPlayers[i].userId,
          player1Name: shuffledPlayers[i].username,
          player2Id: shuffledPlayers[i + 1].userId,
          player2Name: shuffledPlayers[i + 1].username,
          status: 'pending',
          winner: null
        })
      }
    }

    rounds[0].matches = firstRoundMatches

    const updatedTournaments = tournaments.map(t => 
      t.id === tournamentId ? { ...t, status: 'started', rounds, generatedAt: new Date().toISOString() } : t
    )
    localStorage.setItem('eliteArrowsTournaments', JSON.stringify(updatedTournaments))
    
    const existingMatches = tournamentMatches.filter(m => m.tournamentId !== tournamentId)
    const newMatches = rounds.flatMap((round, roundIdx) => 
      round.matches.map((m, matchIdx) => ({
        ...m,
        id: Date.now() + roundIdx * 1000 + matchIdx,
        tournamentId,
        round: roundIdx + 1,
        roundName: round.name,
        format: round.format,
        date: round.date
      }))
    )
    localStorage.setItem('eliteArrowsTournamentMatches', JSON.stringify([...existingMatches, ...newMatches]))
    setTrigger(Date.now())
  }

  const getFormatForRound = (round, totalRounds, tournament) => {
    const customFormats = { r1: tournament.formatR1, r2: tournament.formatR2, qf: tournament.formatQF, sf: tournament.formatSF, f: tournament.formatF }
    
    const roundToFormatKey = { 1: 'r1', 2: 'r2', 3: 'qf', 4: 'sf', 5: 'f', 6: 'f', 7: 'f' }
    const formatKey = roundToFormatKey[round]
    return customFormats[formatKey] || getDefaultFormat(round, totalRounds)
  }

  const getDefaultFormat = (round, totalRounds) => {
    const formats = {
      1: 5,
      2: { 1: 3, 2: 5 },
      3: { 1: 3, 2: 5, 3: 7 },
      4: { 1: 3, 2: 5, 3: 5, 4: 7 },
      5: { 1: 3, 2: 3, 3: 5, 4: 5, 5: 7 },
      6: { 1: 3, 2: 3, 3: 3, 4: 5, 5: 5, 6: 7 }
    }
    if (totalRounds <= 2) return formats[totalRounds]
    return formats[totalRounds]?.[round] || 5
  }

  const handleCreate = () => {
    if (!user.isAdmin && !user.isTournamentAdmin) return alert('Only admins can create tournaments')
    if (!formData.name) return alert('Please enter a tournament name')
    if (formData.isCashBased && formData.entryFee <= 0) return alert('Please set an entry fee')
    if (!formData.entryDeadline) return alert('Please set an entry deadline')
    
    const newTournament = {
      id: Date.now(),
      ...formData,
      createdAt: new Date().toISOString(),
      createdBy: user.id,
      createdByName: user.username,
      status: 'open',
      rounds: []
    }
    
    localStorage.setItem('eliteArrowsTournaments', JSON.stringify([...tournaments, newTournament]))
    setShowCreateForm(false)
    setFormData({ name: '', type: 'knockout', divisions: [], entryFee: 0, isCashBased: false, prizeInfo: '', maxParticipants: 16, entryDeadline: '', daysBetweenRounds: 3, formatR1: '3', formatR2: '3', formatQF: '3', formatSF: '5', formatF: '7' })
    alert('Tournament created! Players can now sign up.')
  }

  const handleDelete = (tournamentId) => {
    if (!confirm('Delete this tournament?')) return
    localStorage.setItem('eliteArrowsTournaments', JSON.stringify(tournaments.filter(t => t.id !== tournamentId)))
    localStorage.setItem('eliteArrowsTournamentSignups', JSON.stringify(tournamentSignups.filter(s => s.tournamentId !== tournamentId)))
    localStorage.setItem('eliteArrowsTournamentMatches', JSON.stringify(tournamentMatches.filter(m => m.tournamentId !== tournamentId)))
    alert('Tournament deleted')
  }

  const handleApproveSignup = (tournamentId, signupId, playerId) => {
    const updatedSignups = tournamentSignups.map(s => s.id === signupId ? { ...s, status: 'approved' } : s)
    localStorage.setItem('eliteArrowsTournamentSignups', JSON.stringify(updatedSignups))

    const tournament = tournaments.find(t => t.id === tournamentId)
    const player = allUsers.find(p => p.id === playerId)
    const announcements = JSON.parse(localStorage.getItem('eliteArrowsChat') || '{}')
    const mainChat = announcements['main'] || []
    mainChat.push({
      id: Date.now(), sender: 'System', senderId: 'system',
      text: `🎉 ${player?.username} approved for "${tournament?.name}"!`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: new Date().toISOString(), type: 'text', isSystemMessage: true
    })
    announcements['main'] = mainChat
    localStorage.setItem('eliteArrowsChat', JSON.stringify(announcements))
    setTrigger(Date.now())
    alert(`Approved!`)
  }

  const handleRejectSignup = (signupId) => {
    localStorage.setItem('eliteArrowsTournamentSignups', JSON.stringify(tournamentSignups.map(s => s.id === signupId ? { ...s, status: 'rejected' } : s)))
    setTrigger(Date.now())
  }

  const handleRequestGame = (matchId, opponentId) => {
    const opponent = allUsers.find(p => p.id === opponentId)
    const notifications = JSON.parse(localStorage.getItem('eliteArrowsNotifications') || '[]')
    notifications.unshift({
      id: Date.now(), type: 'tournament_game_request',
      fromUserId: user.id, fromUsername: user.username,
      message: `Tournament game request`,
      toUserId: opponentId, matchId, isRead: false,
      createdAt: new Date().toISOString()
    })
    localStorage.setItem('eliteArrowsNotifications', JSON.stringify(notifications))
    alert(`Game request sent to ${opponent?.username}`)
  }

  const handleSignup = (tournamentId) => {
    const tournament = tournaments.find(t => t.id === tournamentId)
    if (!tournament) return

    if (!tournament.isCashBased || user.isAdmin) {
      const signup = { id: Date.now(), tournamentId, userId: user.id, username: user.username, paymentProof: null, status: 'approved', signedUpAt: new Date().toISOString() }
      localStorage.setItem('eliteArrowsTournamentSignups', JSON.stringify([...tournamentSignups, signup]))
      setTrigger(Date.now())
      alert('You\'re in!')
    } else {
      if (!paymentProof) return alert('Please upload payment proof')
      const signup = { id: Date.now(), tournamentId, userId: user.id, username: user.username, paymentProof, status: 'pending', signedUpAt: new Date().toISOString() }
      localStorage.setItem('eliteArrowsTournamentSignups', JSON.stringify([...tournamentSignups, signup]))
      setShowSignupForm(null)
      setPaymentProof('')
      setTrigger(Date.now())
      alert('Waiting for admin approval')
    }
  }

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => setPaymentProof(reader.result)
      reader.readAsDataURL(file)
    }
  }

  const getUserSignup = (tournamentId) => tournamentSignups.find(s => s.tournamentId === tournamentId && s.userId === user.id)
  const getUserMatch = (tournamentId) => tournamentMatches.find(m => m.tournamentId === tournamentId && (m.player1Id === user.id || m.player2Id === user.id))

  const refreshedTournaments = JSON.parse(localStorage.getItem('eliteArrowsTournaments') || '[]')
  const refreshedSignups = JSON.parse(localStorage.getItem('eliteArrowsTournamentSignups') || '[]')
  const refreshedMatches = JSON.parse(localStorage.getItem('eliteArrowsTournamentMatches') || '[]')

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Tournaments</h1>
      </div>

      {(user.isAdmin || user.isTournamentAdmin) && (
        <button className="btn btn-primary btn-block" onClick={() => setShowCreateForm(!showCreateForm)} style={{ marginBottom: '20px' }}>
          {showCreateForm ? 'Cancel' : 'Create Tournament (Admin Only)'}
        </button>
      )}

      {showCreateForm && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <h3 className="card-title">Create Tournament</h3>
          
          <div className="form-group">
            <label>Tournament Name</label>
            <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="Enter tournament name" />
          </div>

          <div className="form-group">
            <label>Max Participants</label>
            <select value={formData.maxParticipants} onChange={(e) => setFormData({...formData, maxParticipants: parseInt(e.target.value)})}>
              <option value="8">8 Players</option>
              <option value="16">16 Players</option>
              <option value="32">32 Players</option>
              <option value="64">64 Players</option>
            </select>
          </div>

          <div className="form-group">
            <label>Tournament Format</label>
            <div style={{ display: 'flex', gap: '20px', marginTop: '10px' }}>
              <label><input type="radio" checked={!formData.isCashBased} onChange={() => setFormData({...formData, isCashBased: false, entryFee: 0})} /> Free / Reward</label>
              <label><input type="radio" checked={formData.isCashBased} onChange={() => setFormData({...formData, isCashBased: true})} /> Cash Entry</label>
            </div>
          </div>

          {formData.isCashBased && (
            <div className="form-group">
              <label>Entry Fee (£)</label>
              <input type="number" value={formData.entryFee} onChange={(e) => setFormData({...formData, entryFee: parseFloat(e.target.value) || 0})} min="0" step="0.01" />
            </div>
          )}

          {!formData.isCashBased && (
            <div className="form-group">
              <label>Prize / Reward Info</label>
              <input type="text" value={formData.prizeInfo} onChange={(e) => setFormData({...formData, prizeInfo: e.target.value})} placeholder="e.g., Weekly leaderboard prizes" />
            </div>
          )}

          <div className="form-group">
            <label>Entry Deadline</label>
            <input type="datetime-local" value={formData.entryDeadline} onChange={(e) => setFormData({...formData, entryDeadline: e.target.value})} />
          </div>

          <div className="form-group">
            <label>Days Between Rounds</label>
            <select value={formData.daysBetweenRounds} onChange={(e) => setFormData({...formData, daysBetweenRounds: parseInt(e.target.value)})}>
              <option value="1">1 Day</option>
              <option value="2">2 Days</option>
              <option value="3">3 Days</option>
              <option value="4">4 Days</option>
              <option value="5">5 Days</option>
              <option value="6">6 Days</option>
              <option value="7">1 Week</option>
            </select>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '15px', marginTop: '15px' }}>
            <h4 style={{ marginBottom: '15px' }}>Best Of Settings (First to X legs)</h4>
            <div className="form-group">
              <label>Round 1 / Round of 32/16</label>
              <select value={formData.formatR1} onChange={(e) => setFormData({...formData, formatR1: e.target.value})}>
                {[1,2,3,4,5,6,7,8,9,10,11,12,13].map(n => <option key={n} value={n}>First to {n}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Round 2 / Round of 16/8</label>
              <select value={formData.formatR2} onChange={(e) => setFormData({...formData, formatR2: e.target.value})}>
                {[1,2,3,4,5,6,7,8,9,10,11,12,13].map(n => <option key={n} value={n}>First to {n}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Quarter Finals</label>
              <select value={formData.formatQF} onChange={(e) => setFormData({...formData, formatQF: e.target.value})}>
                {[1,2,3,4,5,6,7,8,9,10,11,12,13].map(n => <option key={n} value={n}>First to {n}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Semi Finals</label>
              <select value={formData.formatSF} onChange={(e) => setFormData({...formData, formatSF: e.target.value})}>
                {[1,2,3,4,5,6,7,8,9,10,11,12,13].map(n => <option key={n} value={n}>First to {n}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Final</label>
              <select value={formData.formatF} onChange={(e) => setFormData({...formData, formatF: e.target.value})}>
                {[1,2,3,4,5,6,7,8,9,10,11,12,13].map(n => <option key={n} value={n}>First to {n}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '15px' }}>
            <label>Divisions</label>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
              {['Elite', 'Premier', 'Champion', 'Diamond', 'Gold'].map(div => (
                <label key={div}>
                  <input type="checkbox" checked={formData.divisions.includes(div)}
                    onChange={(e) => setFormData({...formData, divisions: e.target.checked ? [...formData.divisions, div] : formData.divisions.filter(d => d !== div)})} />
                  {' '}{div}
                </label>
              ))}
            </div>
          </div>

          <button className="btn btn-primary btn-block" onClick={handleCreate}>Create Tournament</button>
        </div>
      )}

      <div className="card">
        <h3 className="card-title">All Tournaments</h3>
        {refreshedTournaments.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No tournaments yet</p>
        ) : (
          refreshedTournaments.map(t => {
            const signups = refreshedSignups.filter(s => s.tournamentId === t.id && s.status === 'approved')
            const pendingSignups = (user.isAdmin || user.isTournamentAdmin) ? refreshedSignups.filter(s => s.tournamentId === t.id && s.status === 'pending') : []
            const userSignup = getUserSignup(t.id)
            const userMatch = getUserMatch(t.id)
            const isClosed = t.entryDeadline && new Date(t.entryDeadline) < new Date()
            const rounds = t.rounds || []
            const canManage = user.isAdmin || (user.isTournamentAdmin && t.createdBy === user.id)
            
            return (
              <div key={t.id} style={{ padding: '15px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div>
                    <h4>{t.name}</h4>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t.type} • {t.divisions?.join(', ') || 'All divisions'}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ color: t.status === 'open' ? 'var(--success)' : 'var(--accent-cyan)' }}>
                      {t.status === 'open' ? (isClosed ? 'Closing' : 'Open') : 'In Progress'}
                    </span>
                    {canManage && (
                      <button onClick={() => handleDelete(t.id)} style={{ display: 'block', background: 'none', border: 'none', color: 'var(--error)', fontSize: '0.8rem', cursor: 'pointer', marginTop: '5px' }}>
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.85rem', padding: '4px 8px', background: 'var(--bg-secondary)', borderRadius: '4px' }}>
                    {t.isCashBased ? `£${t.entryFee} Entry` : 'Free Entry'}
                  </span>
                  <span style={{ fontSize: '0.85rem', padding: '4px 8px', background: 'var(--bg-secondary)', borderRadius: '4px' }}>
                    {signups.length} / {t.maxParticipants} Players
                  </span>
                  {t.entryDeadline && (
                    <span style={{ fontSize: '0.85rem', padding: '4px 8px', background: isClosed ? 'var(--error)' : 'var(--warning)', color: isClosed ? '#fff' : '#000', borderRadius: '4px' }}>
                      {isClosed ? 'Closed: ' : 'Ends: '}{new Date(t.entryDeadline).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {rounds.length > 0 && (
                  <div style={{ marginBottom: '10px', padding: '10px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                    <h5 style={{ marginBottom: '8px', fontSize: '0.9rem' }}>📅 Tournament Schedule</h5>
                    {rounds.map((round, idx) => (
                      <div key={idx} style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{round.name}</span>
                        <span>{round.date ? new Date(round.date).toLocaleDateString() : 'TBD'} (Best of {round.format || 3})</span>
                      </div>
                    ))}
                  </div>
                )}

                {userMatch && (
                  <div style={{ marginBottom: '10px', padding: '10px', background: 'rgba(77, 168, 218, 0.1)', borderRadius: '8px' }}>
                    <h5 style={{ marginBottom: '8px' }}>🎯 Your Match</h5>
                    <p style={{ fontSize: '0.9rem' }}>
                      vs {userMatch.player1Id === user.id ? userMatch.player2Name : userMatch.player1Name}
                    </p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{userMatch.roundName} • Best of {userMatch.format}</p>
                    <button className="btn btn-primary btn-sm" style={{ marginTop: '8px' }} onClick={() => handleRequestGame(userMatch.id, userMatch.player1Id === user.id ? userMatch.player2Id : userMatch.player1Id)}>
                      Request Game Time
                    </button>
                  </div>
                )}

                {pendingSignups.length > 0 && (
                  <div style={{ marginBottom: '15px', padding: '10px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '8px' }}>
                    <h5 style={{ marginBottom: '10px', color: 'var(--warning)' }}>Pending ({pendingSignups.length})</h5>
                    {pendingSignups.map(s => (
                      <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', background: 'var(--bg-secondary)', borderRadius: '4px', marginBottom: '5px' }}>
                        <div>
                          <span style={{ fontWeight: 'bold' }}>{s.username}</span>
                          {s.paymentProof && <img src={s.paymentProof} alt="Proof" style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px', marginLeft: '10px' }} />}
                        </div>
                        <div style={{ display: 'flex', gap: '5px' }}>
                          <button className="btn btn-sm btn-primary" onClick={() => handleApproveSignup(t.id, s.id, s.userId)}>Approve</button>
                          <button className="btn btn-sm" onClick={() => handleRejectSignup(s.id)}>Reject</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {userSignup?.status === 'approved' ? (
                  <div style={{ padding: '10px', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid var(--success)', borderRadius: '8px', textAlign: 'center', color: 'var(--success)' }}>
                    ✅ You're in!
                  </div>
                ) : t.status === 'open' && !isClosed && signups.length < t.maxParticipants ? (
                  <button className="btn btn-primary btn-block" onClick={() => setShowSignupForm(t.id)}>Sign Up</button>
                ) : isClosed && signups.length < 2 ? (
                  <div style={{ padding: '10px', background: 'var(--bg-secondary)', borderRadius: '8px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Not enough players to start
                  </div>
                ) : null}

                {showSignupForm === t.id && (
                  <div style={{ marginTop: '15px', padding: '15px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                    <h4 style={{ marginBottom: '10px' }}>Sign Up for {t.name}</h4>
                    {t.isCashBased && !user.isAdmin && (
                      <div className="form-group">
                        <label>Payment Proof</label>
                        <div style={{ border: '2px dashed var(--border)', borderRadius: '8px', padding: '20px', textAlign: 'center', cursor: 'pointer', background: 'var(--bg-primary)' }} onClick={() => document.getElementById(`payment-${t.id}`).click()}>
                          {paymentProof ? <img src={paymentProof} alt="Proof" style={{ maxWidth: '100%', maxHeight: '150px', borderRadius: '8px' }} /> : <p style={{ color: 'var(--text-muted)' }}>Click to upload</p>}
                        </div>
                        <input id={`payment-${t.id}`} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button className="btn btn-primary" onClick={() => handleSignup(t.id)}>Confirm</button>
                      <button className="btn btn-secondary" onClick={() => setShowSignupForm(null)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}