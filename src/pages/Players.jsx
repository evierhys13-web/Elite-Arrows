import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { SkeletonList } from '../components/Skeleton'
import Breadcrumbs from '../components/Breadcrumbs'
import Tooltip from '../components/Tooltip'
import { useToast } from '../context/ToastContext'

export default function Players() {
  const { user, getAllUsers, addFriend, removeFriend, loading } = useAuth()
  const { showToast } = useToast()
  const [showFriendsOnly, setShowFriendsOnly] = useState(false)
  const [visible, setVisible] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    setVisible(true)
  }, [])

  const allUsers = getAllUsers()
  const players = showFriendsOnly 
    ? allUsers.filter(u => (user.friends || []).includes(u.id))
    : allUsers.filter(u => u.id !== user.id)

  return (
    <div className="page">
      <Breadcrumbs items={[
        { label: 'Home', path: '/home' },
        { label: 'Players' }
      ]} />
      
      <div className={`page-header animate-fade-in ${visible ? '' : 'opacity-0'}`}>
        <h1 className="page-title">Players</h1>
      </div>

      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }} className={`animate-fade-in-up ${visible ? '' : 'opacity-0'}`}>
        <button 
          className={`btn ${!showFriendsOnly ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setShowFriendsOnly(false)}
        >
          All Players
        </button>
        <button 
          className={`btn ${showFriendsOnly ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setShowFriendsOnly(true)}
        >
          Friends ({user.friends?.length || 0})
        </button>
      </div>

      <div>
        {loading ? (
          <SkeletonList items={6} />
        ) : players.length === 0 ? (
          <div className="card">
            <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
              {showFriendsOnly ? 'No friends yet. Add players to your friends list!' : 'No other players registered yet.'}
            </p>
          </div>
        ) : (
          players.map((player, index) => (
            <div key={player.id} className={`player-card stagger-item`} style={{ flexWrap: 'wrap' }}>
              <div className="player-avatar">
                {player.profilePicture ? (
                  <img src={player.profilePicture} alt={player.username} />
                ) : (
                  player.username.charAt(0).toUpperCase()
                )}
              </div>
              <div className="player-info" style={{ flex: 1, minWidth: '200px' }}>
                <h3 
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/profile/${player.id}`)}
                >
                  {player.username}
                  {player.nickname && <span style={{ color: 'var(--accent-cyan)', fontWeight: 'normal', marginLeft: '8px' }}>"{player.nickname}"</span>}
                  {player.isAdmin && <span className="admin-badge" style={{ marginLeft: '8px' }}>Admin</span>}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  {player.showOnlineStatus !== false && (
                    <div style={{ 
                      width: '10px', 
                      height: '10px', 
                      borderRadius: '50%',
                      background: player.isOnline && player.lastSeen && (Date.now() - new Date(player.lastSeen).getTime()) < 5 * 60 * 1000 ? 'var(--success)' : 'var(--text-muted)',
                      border: player.isOnline && player.lastSeen && (Date.now() - new Date(player.lastSeen).getTime()) < 5 * 60 * 1000 ? '2px solid var(--bg-primary)' : '2px solid var(--bg-secondary)'
                    }} />
                  )}
                  {player.showOnlineStatus !== false ? (
                    player.isOnline && player.lastSeen && (Date.now() - new Date(player.lastSeen).getTime()) < 5 * 60 * 1000 ? (
                      <span style={{ fontSize: '0.85rem', color: 'var(--success)' }}>Online</span>
                    ) : player.lastSeen ? (
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Last seen: {new Date(player.lastSeen).toLocaleDateString()}
                      </span>
                    ) : null
                  ) : (
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Status hidden</span>
                  )}
                  {player.doNotDisturb && player.dndEndTime && new Date(player.dndEndTime) > new Date() && (
                    <span style={{ fontSize: '0.75rem', color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                      🔕 DND
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {player.division} • Avg: {player.threeDartAverage?.toFixed(2) || 0}
                </p>
                {player.dart && (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    🎯 {player.dart}
                  </p>
                )}
                {player.dartCounterLink && (
                  <a 
                    href={player.dartCounterLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '4px',
                      marginTop: '8px',
                      color: 'var(--accent-cyan)',
                      fontSize: '0.85rem',
                      textDecoration: 'none'
                    }}
                  >
                    📊 View DartCounter Profile
                  </a>
                )}
                <p style={{ marginTop: '8px', fontSize: '0.9rem' }}>{player.bio || 'No bio yet'}</p>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                {(user.friends || []).includes(player.id) && (
                  <button 
                    className="btn btn-primary"
                    style={{ padding: '8px 16px' }}
                    onClick={() => navigate('/chat', { state: { openChat: `friend_${player.id}` } })}
                  >
                    💬 Chat
                  </button>
                )}
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '8px 16px' }}
                    onClick={async () => {
                      if(window.confirm(`Remove ${player.username}?`)) {
                        await removeFriend(player.id);
                        showToast(`Removed ${player.username}`, 'info');
                      }
                    }}
                  >
                    Remove
                  </button>
                ) : (
                  <button 
                    className="btn btn-primary"
                    style={{ padding: '8px 16px' }}
                    onClick={async () => {
                      try {
                        await addFriend(player.id)
                        showToast(`Added ${player.username}`, 'success')
                      } catch (error) {
                        showToast('Add friend failed', 'error')
                      }
                    }}
                  >
                    Add Friend
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
