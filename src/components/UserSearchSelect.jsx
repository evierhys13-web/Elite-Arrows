import { useState, useRef, useEffect } from 'react'

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)

export default function UserSearchSelect({ 
  users, 
  selectedId, 
  onSelect, 
  placeholder = 'Search players...',
  excludeIds = [],
  label = 'Select Player',
  maxResults = 15
}) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const wrapperRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredUsers = users
    .filter(u => !excludeIds.includes(u.id))
    .filter(u => {
      if (!query.trim()) return true
      const searchTerm = query.toLowerCase()
      return (
        u.username?.toLowerCase().includes(searchTerm) ||
        u.nickname?.toLowerCase().includes(searchTerm) ||
        u.dartCounterUsername?.toLowerCase().includes(searchTerm)
      )
    })
    .slice(0, maxResults)

  const selectedUser = users.find(u => u.id === selectedId)

  const handleSelect = (user) => {
    onSelect(user.id)
    setQuery('')
    setIsOpen(false)
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      {label && (
        <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '0.9rem' }}>
          {label}
        </label>
      )}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          background: 'var(--bg-primary)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '10px 12px',
          cursor: 'pointer',
          minHeight: '44px'
        }}
      >
        <SearchIcon />
        <span style={{ 
          flex: 1, 
          marginLeft: '8px',
          color: selectedUser ? 'var(--text)' : 'var(--text-muted)'
        }}>
          {selectedUser 
            ? `${selectedUser.username}${selectedUser.dartCounterUsername ? ` (${selectedUser.dartCounterUsername})` : ''}`
            : placeholder
          }
        </span>
        <span style={{ 
          fontSize: '0.75rem', 
          color: 'var(--accent-cyan)',
          background: 'var(--bg-secondary)',
          padding: '2px 8px',
          borderRadius: '4px'
        }}>
          {selectedUser?.division || 'Unassigned'}
        </span>
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          marginTop: '4px',
          maxHeight: '300px',
          overflowY: 'auto',
          zIndex: 100,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}>
          <div style={{ 
            padding: '8px 12px', 
            borderBottom: '1px solid var(--border)' 
          }}>
            <input
              type="text"
              placeholder="Search by username or DartCounter..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              style={{
                width: '100%',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                padding: '8px 10px',
                color: 'var(--text)',
                fontSize: '0.85rem',
                outline: 'none'
              }}
            />
          </div>
          
          {filteredUsers.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No players found
            </div>
          ) : (
            filteredUsers.map(user => (
              <div
                key={user.id}
                onClick={() => handleSelect(user)}
                style={{
                  padding: '10px 12px',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: user.id === selectedId ? 'var(--accent-primary)' : 'transparent'
                }}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '0.8rem',
                  overflow: 'hidden'
                }}>
                  {user.profilePicture ? (
                    <img src={user.profilePicture} alt={user.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    user.username?.charAt(0).toUpperCase()
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>
                    {user.username}
                    {user.nickname && <span style={{ color: 'var(--accent-cyan)', marginLeft: '4px' }}>"{user.nickname}"</span>}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {user.dartCounterUsername && <span>{user.dartCounterUsername} • </span>}
                    <span style={{ color: 'var(--accent-cyan)' }}>{user.division || 'Unassigned'}</span>
                    {' • '}{user.threeDartAverage?.toFixed(2) || 0} avg
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
