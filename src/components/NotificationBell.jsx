import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

const BellIcon = ({ hasUnread }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill={hasUnread ? 'var(--accent-primary)' : 'none'} 
    stroke="currentColor" 
    strokeWidth="2"
    style={{ width: 22, height: 22 }}
  >
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
)

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const getNotificationIcon = (type) => {
  switch (type) {
    case 'result_approved':
      return '✅'
    case 'result_rejected':
      return '❌'
    case 'result_submitted':
      return '📋'
    case 'fixture_proposed':
      return '📅'
    case 'fixture_accepted':
      return '✅'
    case 'friend_request':
      return '👤'
    case 'friend_accepted':
      return '🤝'
    case 'cup_match':
      return '🏆'
    case 'table_updated':
      return '📊'
    case 'tournament':
      return '🎯'
    case 'chat':
      return '💬'
    default:
      return '🔔'
  }
}

const formatTime = (dateString) => {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now - date
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}

export default function NotificationBell() {
  const { user, notifications, unreadCount, updateBadgeCount } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [localNotifications, setLocalNotifications] = useState([])
  const dropdownRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    setLocalNotifications(notifications.slice(0, 20))
  }, [notifications])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleNotificationClick = (notification) => {
    let url = '/settings'
    
    switch (notification.type) {
      case 'result_approved':
      case 'result_rejected':
        url = '/results'
        break
      case 'fixture_proposed':
      case 'fixture_accepted':
        url = '/fixtures'
        break
      case 'friend_request':
      case 'friend_accepted':
        url = '/settings'
        break
      case 'cup_match':
        url = '/cups'
        break
      case 'table_updated':
        url = '/table'
        break
      case 'tournament':
        url = '/tournaments'
        break
      case 'chat':
        url = '/chat'
        break
      default:
        url = '/settings'
    }

    if (!notification.isRead) {
      const updated = localNotifications.map(n => 
        n.id === notification.id ? { ...n, isRead: true } : n
      )
      setLocalNotifications(updated)
      const unread = updated.filter(n => !n.isRead).length
      updateBadgeCount(unread)
      
      const allStored = JSON.parse(localStorage.getItem('eliteArrowsNotifications') || '[]')
      const updatedStored = allStored.map(n => 
        n.id === notification.id ? { ...n, isRead: true } : n
      )
      localStorage.setItem('eliteArrowsNotifications', JSON.stringify(updatedStored))
    }

    setIsOpen(false)
    navigate(url)
  }

  const markAllAsRead = () => {
    const updated = localNotifications.map(n => ({ ...n, isRead: true }))
    setLocalNotifications(updated)
    updateBadgeCount(0)
    
    const allStored = JSON.parse(localStorage.getItem('eliteArrowsNotifications') || '[]')
    const updatedStored = allStored.map(n => ({ ...n, isRead: true }))
    localStorage.setItem('eliteArrowsNotifications', JSON.stringify(updatedStored))
  }

  if (!user) return null

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'relative',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: '8px',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: isOpen ? 'var(--accent-primary)' : 'var(--text-primary)',
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <BellIcon hasUnread={unreadCount > 0} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 2,
              right: 2,
              background: '#ff4444',
              color: 'white',
              fontSize: '0.65rem',
              fontWeight: 'bold',
              borderRadius: '50%',
              width: '18px',
              height: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '18px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
            }}
            aria-hidden="true"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Notifications"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '8px',
            width: '360px',
            maxHeight: '480px',
            background: 'var(--bg-primary)',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            border: '1px solid var(--border)',
            zIndex: 1000,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)'
            }}
          >
            <h3 id="notifications-title" style={{ margin: 0, fontSize: '1rem' }}>Notifications</h3>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  aria-label="Mark all notifications as read"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--accent-primary)',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    padding: '4px 8px',
                    borderRadius: '4px'
                  }}
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Close notifications"
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  color: 'var(--text-muted)'
                }}
              >
                <CloseIcon />
              </button>
            </div>
          </div>

          <div 
            style={{ flex: 1, overflowY: 'auto' }}
            role="list"
            aria-labelledby="notifications-title"
          >
            {localNotifications.length === 0 ? (
              <div
                role="listitem"
                style={{
                  padding: '40px 20px',
                  textAlign: 'center',
                  color: 'var(--text-muted)'
                }}
              >
                <p style={{ margin: 0, fontSize: '0.9rem' }}>No notifications yet</p>
              </div>
            ) : (
              localNotifications.map((notification) => (
                <div
                  key={notification.id}
                  role="listitem"
                  onClick={() => handleNotificationClick(notification)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleNotificationClick(notification)
                    }
                  }}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    background: notification.isRead 
                      ? 'transparent' 
                      : 'rgba(0, 212, 255, 0.05)',
                    transition: 'background 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!notification.isRead) return
                    e.currentTarget.style.background = 'var(--bg-secondary)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = notification.isRead 
                      ? 'transparent' 
                      : 'rgba(0, 212, 255, 0.05)'
                  }}
                >
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>
                      {getNotificationIcon(notification.type)}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          margin: '0 0 4px 0',
                          fontSize: '0.9rem',
                          fontWeight: notification.isRead ? 'normal' : '600',
                          color: 'var(--text-primary)',
                          lineHeight: 1.3
                        }}
                      >
                        {notification.message || notification.title || 'New notification'}
                      </p>
                      <p
                        style={{
                          margin: 0,
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)'
                        }}
                      >
                        {formatTime(notification.createdAt)}
                      </p>
                    </div>
                    {!notification.isRead && (
                      <span
                        style={{
                          width: '8px',
                          height: '8px',
                          background: 'var(--accent-primary)',
                          borderRadius: '50%',
                          flexShrink: 0,
                          marginTop: '6px'
                        }}
                        aria-hidden="true"
                      />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div
            style={{
              padding: '10px 16px',
              borderTop: '1px solid var(--border)',
              textAlign: 'center'
            }}
          >
            <button
              onClick={() => {
                setIsOpen(false)
                navigate('/settings')
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--accent-primary)',
                fontSize: '0.85rem',
                cursor: 'pointer',
                padding: '4px 8px'
              }}
            >
              View all in Settings
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
