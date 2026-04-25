import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { db, doc, setDoc, collection, query, where, onSnapshot, deleteDoc } from '../firebase'

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
  const navigate = useNavigate()
  const [selectedPlayer, setSelectedPlayer] = useState('')
  const [selectedPlayerData, setSelectedPlayerData] = useState(null)
  const [gameType, setGameType] = useState('')
  const [sent, setSent] = useState(false)
  const [onlinePlayers, setOnlinePlayers] = useState([])
  const [gameRequests, setGameRequests] = useState([])
  const [showChallengeModal, setShowChallengeModal] = useState(false)

  const allUsers = getAllUsers()

  useEffect(() => {
    const q = query(collection(db, 'users'), where('isOnline', '==', true))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const online = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(u => u.lastSeen && (Date.now() - new Date(u.lastSeen).getTime()) < 5 * 60 * 1000 && u.id !== user?.id)
      setOnlinePlayers(online)
    })
    return () => unsubscribe()
  }, [user?.id])

  useEffect(() => {
    if (!user) return
    const requestsRef = collection(db, 'gameRequests')
    const q = query(
      requestsRef,
      where('toUserId', '==', user.id)
    )
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setGameRequests(requests.filter(r => r.status === 'pending'))
    })
    return () => unsubscribe()
  }, [user?.id])

  const handleSendRequest = async () => {
    if (!selectedPlayer || !gameType) {
      alert('Please select a player and game type')
      return
    }

    const selectedUser = allUsers.find(u => u.id === selectedPlayer)
    
    if (gameType === 'League' && selectedUser.division !== user.division) {
      alert(`You can only play League games against players in the same division. ${selectedUser.username} is in ${selectedUser.division} division and you are in ${user.division} division.`)
      return
    }
    
    const requestId = Date.now().toString()
    await setDoc(doc(db, 'gameRequests', requestId), {
      fromUserId: user.id,
      fromUsername: user.username,
      toUserId: selectedPlayer,
      toUsername: selectedUser.username,
      gameType: gameType,
      status: 'pending',
      createdAt: new Date().toISOString()
    })

    await setDoc(doc(db, 'users', selectedUser.id), {
      hasGameChallenge: true,
      gameChallengeFrom: {
        id: requestId,
        fromUserId: user.id,
        fromUsername: user.username,
        gameType: gameType
      }
    }, { merge: true })

    setSent(true)
    setSelectedPlayer('')
    setGameType('')
    setTimeout(() => setSent(false), 3000)
  }

  const handleAccept = async (req) => {
    await setDoc(doc(db, 'gameRequests', req.id), { status: 'accepted' }, { merge: true })
    await setDoc(doc(db, 'users', user.id), { hasGameChallenge: false, gameChallengeFrom: null }, { merge: true })
    
    const friendId = req.fromUserId
    const currentUser = allUsers.find(u => u.id === user.id)
    const requesterUser = allUsers.find(u => u.id === friendId)
    
    const newFriends1 = [...(currentUser.friends || []), friendId]
    const newFriends2 = [...(requesterUser.friends || []), user.id]
    
    await setDoc(doc(db, 'users', user.id), { friends: newFriends1 }, { merge: true })
    await setDoc(doc(db, 'users', friendId), { friends: newFriends2 }, { merge: true })
    
    navigate('/chat', { state: { openChat: `friend_${friendId}` } })
  }

  const handleDecline = async (req) => {
    await deleteDoc(doc(db, 'gameRequests', req.id))
    await setDoc(doc(db, 'users', user.id), { hasGameChallenge: false, gameChallengeFrom: null }, { merge: true })
  }

  useEffect(() => {
    if (!user?.hasGameChallenge || !user?.gameChallengeFrom) return
    
    const challenge = user.gameChallengeFrom
    setShowChallengeModal(true)
    
    alert(`${challenge.fromUsername} wants to play a ${challenge.gameType} game with you!`)
  }, [user])

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Games</h1>
      </div>

      {showChallengeModal && gameRequests.length > 0 && (
        <div className="modal-overlay" onClick={() => setShowChallengeModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Game Challenge!</h3>
            {gameRequests.map(req => (
              <div key={req.id} style={{ marginBottom: '15px', padding: '15px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                <p><strong>{req.fromUsername}</strong> wants to play a <strong>{req.gameType}</strong> game with you</p>
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button className="btn btn-primary" onClick={() => handleAccept(req)}>Accept</button>
                  <button className="btn" onClick={() => handleDecline(req)}>Decline</button>
                </div>
              </div>
            ))}
            <button className="btn btn-secondary" onClick={() => setShowChallengeModal(false)}>Close</button>
          </div>
        </div>
      )}

      <div className="card">
        <h3 className="card-title">Online Players</h3>
        {onlinePlayers.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No players online right now</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {onlinePlayers.map(player => (
              <div 
                key={player.id}
                className="player-card"
                style={{ cursor: 'pointer', textAlign: 'center' }}
                onClick={() => {
                  setSelectedPlayer(player.id)
                  setShowChallengeModal(true)
                }}
              >
                <div className="player-avatar" style={{ margin: '0 auto 8px' }}>
                  {player.username.charAt(0).toUpperCase()}
                </div>
                <h3 style={{ fontSize: '0.9rem' }}>{player.username}</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>{player.division}</p>
                <span className="status-badge online">Online</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: '20px' }}>
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
            {allUsers.filter(u => u.id !== user?.id).map(u => (
              <option key={u.id} value={u.id}>
                {u.username} ({u.division}) {u.isOnline ? '✓' : ''}
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
          disabled={!selectedPlayer || !gameType}
        >
          {sent ? 'Request Sent!' : 'Send Challenge'}
        </button>
      </div>
    </div>
  )
}