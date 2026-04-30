import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)

const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)

const divisionColors = {
  Elite: '#9333ea',
  Premier: '#3b82f6',
  Champion: '#10b981',
  Diamond: '#06b6d4',
  Gold: '#eab308',
  Silver: '#94a3b8',
  Bronze: '#d97706',
  Development: '#22c55e'
}

export default function GlobalSearch() {
  const { user, allUsers, addFriend, removeFriend, updateUser } = useAuth()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const [showActionsFor, setShowActionsFor] = useState(null)
  const searchRef = useRef(null)
  const navigate = useNavigate()

  const isAdmin = user?.isAdmin || user?.isTournamentAdmin

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setIsOpen(false)
        setShowActionsFor(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }

    const timer = setTimeout(() => {
      const searchTerm = query.toLowerCase()
      const filtered = allUsers
        .filter(u => u.id !== user?.id)
        .filter(u => 
          u.username?.toLowerCase().includes(searchTerm) ||
          u.nickname?.toLowerCase().includes(searchTerm)
        )
        .slice(0, 10)
      setResults(filtered)
    }, 300)

    return () => clearTimeout(timer)
  }, [query, allUsers, user?.id])

  const getFriendStatus = (playerId) => {
    if ((user.friends || []).includes(playerId)) return 'friends'
    return 'none'
  }

  const handleViewProfile = (playerId) => {
    navigate(`/profile/${playerId}`)
    setQuery('')
    setIsOpen(false)
    setShowActionsFor(null)
  }

  const handleChat = (playerId) => {
    navigate('/chat', { state: { openChat: `friend_${playerId}` } })
    setQuery('')
    setIsOpen(false)
    setShowActionsFor(null)
  }

  const handleAction = async (action, player) => {
    switch (action) {
      case 'addFriend':
        await addFriend(player.id)
        break
      case 'removeFriend':
        await removeFriend(player.id)
        break
      case 'subscribe':
        await updateUser({ isSubscribed: true })
        break
      case 'viewProfile':
        handleViewProfile(player.id)
        return
      case 'chat':
        handleChat(player.id)
        return
      default:
        break
    }
    setShowActionsFor(null)
  }

  return (
    <div ref={searchRef} style={{ position: 'relative', padding: '0 15px', marginBottom: '10px' }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        background: 'var(--bg-secondary)', 
        borderRadius: '8px',
        padding: '8px 12px',
        gap: '8px',
        border: '1px solid var(--border)'
      }}>
        <SearchIcon />
        <input
          type="text"
          placeholder="Search players..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontSize: '0.9rem'
          }}
        />
      </div>

      {isOpen && results.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: '15px',
          right: '15px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          marginTop: '4px',
          maxHeight: '400px',
          overflowY: 'auto',
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}>
          {results.map(player => {
            const status = getFriendStatus(player.id)
            return (
              <div key={player.id} style={{
                padding: '10px 12px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  overflow: 'hidden',
                  flexShrink: 0
                }}>
                  {player.profilePicture ? (
                    <img src={player.profilePicture} alt={player.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    player.username?.charAt(0).toUpperCase()
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '600', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {player.username}
                    {player.isAdmin && <span style={{ fontSize: '0.7rem', background: '#9333ea', padding: '1px 4px', borderRadius: '3px' }}>Admin</span>}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: divisionColors[player.division] || 'var(--text-muted)' }}>
                    {player.division} • {player.threeDartAverage?.toFixed(2) || 0} avg
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                  <button
                    onClick={() => handleViewProfile(player.id)}
                    style={{
                      padding: '6px 10px',
                      fontSize: '0.75rem',
                      background: 'var(--accent-primary)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    View
                  </button>
                  {status === 'friends' && (
                    <>
                      <button
                        onClick={() => handleChat(player.id)}
                        style={{
                          padding: '6px 10px',
                          fontSize: '0.75rem',
                          background: 'var(--accent-cyan)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        Chat
                      </button>
                      <button
                        onClick={() => setShowActionsFor(showActionsFor === player.id ? null : player.id)}
                        style={{
                          padding: '6px 8px',
                          fontSize: '0.75rem',
                          background: 'var(--bg-primary)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border)',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        ⋮
                      </button>
                    </>
                  )}
                  {status === 'none' && (
                    <button
                      onClick={() => handleAction('addFriend', player)}
                      style={{
                        padding: '6px 10px',
                        fontSize: '0.75rem',
                        background: 'var(--success)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      + Add
                    </button>
                  )}
                  {isAdmin && !player.isSubscribed && (
                    <button
                      onClick={() => handleAction('subscribe', player)}
                      style={{
                        padding: '6px 10px',
                        fontSize: '0.75rem',
                        background: '#eab308',
                        color: 'black',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      ⭐
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {isOpen && query && results.length === 0 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: '15px',
          right: '15px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          marginTop: '4px',
          padding: '12px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.85rem',
          zIndex: 1000
        }}>
          No players found
        </div>
      )}
    </div>
  )
}
