import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

const GamepadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <line x1="6" y1="10" x2="6" y2="14" />
    <line x1="10" y1="10" x2="10" y2="14" />
    <line x1="14" y1="10" x2="14" y2="14" />
    <line x1="18" y1="10" x2="18" y2="14" />
  </svg>
)

export default function Games() {
  const { user, getAllUsers } = useAuth()
  const [selectedPlayer, setSelectedPlayer] = useState('')
  const [gameType, setGameType] = useState('')
  const [sent, setSent] = useState(false)

  const allUsers = getAllUsers()
  const otherUsers = allUsers.filter(u => u.id !== user?.id)

  const handleSendRequest = () => {
    if (!selectedPlayer || !gameType) {
      alert('Please select a player and game type')
      return
    }

    const selectedUser = allUsers.find(u => u.id === selectedPlayer)
    
    const gameRequests = JSON.parse(localStorage.getItem('eliteArrowsGameRequests') || '[]')
    gameRequests.push({
      id: Date.now(),
      fromUserId: user.id,
      fromUsername: user.username,
      toUserId: selectedPlayer,
      toUsername: selectedUser.username,
      gameType: gameType,
      status: 'pending',
      createdAt: new Date().toISOString()
    })
    localStorage.setItem('eliteArrowsGameRequests', JSON.stringify(gameRequests))

    const targetUser = allUsers.find(u => u.id === selectedPlayer)
    const isInDND = targetUser?.doNotDisturb && targetUser.dndEndTime && new Date(targetUser.dndEndTime) > new Date()
    
    if (!isInDND) {
      const notifications = JSON.parse(localStorage.getItem('eliteArrowsNotifications') || '[]')
      notifications.unshift({
        id: Date.now(),
        type: 'game_request',
        fromUserId: user.id,
        fromUsername: user.username,
        message: `${user.username} wants to play a ${gameType} game with you`,
        toUserId: selectedPlayer,
        isRead: false,
        createdAt: new Date().toISOString()
      })
      localStorage.setItem('eliteArrowsNotifications', JSON.stringify(notifications))
    }

    setSent(true)
    setTimeout(() => {
      setSent(false)
      setSelectedPlayer('')
      setGameType('')
    }, 3000)
  }

  const gameRequests = JSON.parse(localStorage.getItem('eliteArrowsGameRequests') || '[]')
  const myPendingRequests = gameRequests.filter(
    r => r.fromUserId === user?.id && r.status === 'pending'
  )
  const incomingRequests = gameRequests.filter(
    r => r.toUserId === user?.id && r.status === 'pending'
  )

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Games</h1>
      </div>

      <div className="card">
        <h3 className="card-title">Challenge a Player</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
          Select a player and choose a game type to send a challenge request.
        </p>

        <div className="form-group">
          <label>Select Player</label>
          <select 
            value={selectedPlayer}
            onChange={(e) => setSelectedPlayer(e.target.value)}
          >
            <option value="">Choose a player...</option>
            {otherUsers.map(u => (
              <option key={u.id} value={u.id}>
                {u.username} ({u.division})
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Game Type</label>
          <select 
            value={gameType}
            onChange={(e) => setGameType(e.target.value)}
          >
            <option value="">Select game type...</option>
            <option value="Friendly">Friendly</option>
            <option value="League">League</option>
          </select>
        </div>

        <button 
          onClick={handleSendRequest} 
          className="btn btn-primary btn-block"
        >
          {sent ? 'Request Sent!' : 'Send Challenge'}
        </button>
      </div>

      {myPendingRequests.length > 0 && (
        <div className="card" style={{ marginTop: '20px' }}>
          <h3 className="card-title">Your Pending Challenges</h3>
          {myPendingRequests.map(req => (
            <div key={req.id} className="player-card">
              <div className="player-avatar">
                {req.toUsername.charAt(0).toUpperCase()}
              </div>
              <div className="player-info">
                <h3>{req.toUsername}</h3>
                <p>{req.gameType} Game</p>
              </div>
              <span className="status-badge pending">Pending</span>
            </div>
          ))}
        </div>
      )}

      {incomingRequests.length > 0 && (
        <div className="card" style={{ marginTop: '20px' }}>
          <h3 className="card-title">Incoming Challenges</h3>
          {incomingRequests.map(req => (
            <div key={req.id} className="player-card">
              <div className="player-avatar">
                {req.fromUsername.charAt(0).toUpperCase()}
              </div>
              <div className="player-info">
                <h3>{req.fromUsername}</h3>
                <p>{req.gameType} Game</p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className="btn btn-sm btn-primary"
                  onClick={() => {
                    const requests = gameRequests.map(r => 
                      r.id === req.id ? { ...r, status: 'accepted' } : r
                    )
                    localStorage.setItem('eliteArrowsGameRequests', JSON.stringify(requests))
                    window.location.reload()
                  }}
                >
                  Accept
                </button>
                <button 
                  className="btn btn-sm"
                  onClick={() => {
                    const requests = gameRequests.map(r => 
                      r.id === req.id ? { ...r, status: 'rejected' } : r
                    )
                    localStorage.setItem('eliteArrowsGameRequests', JSON.stringify(requests))
                    window.location.reload()
                  }}
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}