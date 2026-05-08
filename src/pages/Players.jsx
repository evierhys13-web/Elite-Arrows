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
  const [searchTerm, setSearchBar] = useState('')
  const [visible, setVisible] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    setVisible(true)
  }, [])

  const allUsers = getAllUsers()

  const filteredPlayers = allUsers.filter(u => {
    if (u.id === user.id) return false;
    const matchesSearch = u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (u.nickname && u.nickname.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesFriends = showFriendsOnly ? (user.friends || []).includes(u.id) : true;
    return matchesSearch && matchesFriends;
  })

  return (
    <div className="page animate-fade-in">
      <Breadcrumbs items={[
        { label: 'Home', path: '/home' },
        { label: 'Players' }
      ]} />
      
      <div className="page-header" style={{ marginBottom: '32px' }}>
        <h1 className="page-title text-gradient" style={{ fontSize: '2.5rem' }}>League Members</h1>
        <p style={{ color: 'var(--text-muted)' }}>Connect with players across all divisions</p>
      </div>

      <div className="card glass" style={{ marginBottom: '32px', padding: '20px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
            <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>🔍</span>
            <input
              placeholder="Search by name or nickname..."
              value={searchTerm}
              onChange={(e) => setSearchBar(e.target.value)}
              style={{ paddingLeft: '44px', width: '100%', borderRadius: '12px' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className={`division-tab ${!showFriendsOnly ? 'active' : ''}`}
              onClick={() => setShowFriendsOnly(false)}
            >
              All Players
            </button>
            <button
              className={`division-tab ${showFriendsOnly ? 'active' : ''}`}
              onClick={() => setShowFriendsOnly(true)}
            >
              Friends ({user.friends?.length || 0})
            </button>
          </div>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '24px',
        paddingBottom: '40px'
      }}>
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card glass skeleton" style={{ height: '240px' }} />
          ))
        ) : filteredPlayers.length === 0 ? (
          <div className="card glass" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>👤</div>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
              {showFriendsOnly ? 'No friends found matching your search.' : 'No players found matching your search.'}
            </p>
          </div>
        ) : (
          filteredPlayers.map((player) => {
            const isOnline = player.isOnline && player.lastSeen && (Date.now() - new Date(player.lastSeen).getTime()) < 5 * 60 * 1000;
            const isFriend = (user.friends || []).includes(player.id);

            return (
              <div key={player.id} className="card glass animate-fade-in" style={{
                padding: '24px',
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform 0.2s ease, border-color 0.2s ease',
                cursor: 'pointer',
                border: isOnline ? '1px solid var(--success-bg)' : '1px solid var(--border)',
                background: isOnline ? 'rgba(16, 185, 129, 0.02)' : 'var(--bg-card)'
              }} onClick={() => navigate(`/profile/${player.id}`)}>

                <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
                  <div className="avatar-ring" style={{ width: '70px', height: '70px', padding: '2px', flexShrink: 0 }}>
                    <div className="avatar-inner">
                      {player.profilePicture ? (
                        <img src={player.profilePicture} alt={player.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: '1.5rem', fontWeight: 900 }}>{player.username.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                       <h3 style={{ fontSize: '1.2rem', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{player.username}</h3>
                       {isOnline && <div className="pulse-success" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)' }} />}
                    </div>
                    {player.nickname && <p style={{ color: 'var(--accent-cyan)', fontSize: '0.85rem', fontWeight: 600, marginTop: '-4px', marginBottom: '4px' }}>"{player.nickname}"</p>}
                    <span style={{
                      fontSize: '0.7rem',
                      background: 'rgba(255,255,255,0.05)',
                      padding: '4px 10px',
                      borderRadius: '20px',
                      color: 'var(--text-muted)',
                      fontWeight: 700,
                      textTransform: 'uppercase'
                    }}>
                      {player.division || 'Unassigned'}
                    </span>
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                   <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                      <div style={{ flex: 1 }}>
                         <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg</div>
                         <div style={{ fontWeight: 800, color: 'white' }}>{player.threeDartAverage?.toFixed(2) || '0.00'}</div>
                      </div>
                      {player.dart && (
                        <div style={{ flex: 2 }}>
                           <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Equipment</div>
                           <div style={{ fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>🎯 {player.dart}</div>
                        </div>
                      )}
                   </div>
                   <p style={{
                     fontSize: '0.85rem',
                     color: 'var(--text-secondary)',
                     lineHeight: '1.5',
                     display: '-webkit-box',
                     WebkitLineClamp: '2',
                     WebkitBoxOrient: 'vertical',
                     overflow: 'hidden',
                     height: '2.5rem',
                     marginBottom: '20px'
                   }}>
                     {player.bio || 'This player hasn\'t written a bio yet.'}
                   </p>
                </div>

                <div style={{ display: 'flex', gap: '10px' }} onClick={e => e.stopPropagation()}>
                  <button 
                    className="btn btn-primary btn-sm"
                    style={{ flex: 2 }}
                    onClick={() => navigate('/chat', { state: { openChat: `friend_${player.id}` } })}
                  >
                    💬 Message
                  </button>
                  {isFriend ? (
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1, padding: '8px' }}
                      onClick={async () => {
                        if(window.confirm(`Remove ${player.username} from friends?`)) {
                          await removeFriend(player.id);
                          showToast('Removed friend', 'info');
                        }
                      }}
                    >
                      Remove
                    </button>
                  ) : (
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1, padding: '8px' }}
                      onClick={async () => {
                        try {
                          await addFriend(player.id)
                          showToast('Friend added!', 'success')
                        } catch (e) { showToast('Failed to add', 'error') }
                      }}
                    >
                      Add
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      <style>{`
        .pulse-success {
          box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4);
          animation: pulse-green 2s infinite;
        }
        @keyframes pulse-green {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
      `}</style>
    </div>
  )
}
