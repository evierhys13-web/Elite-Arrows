import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { db, doc, setDoc } from '../firebase'

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
      return 'OK'
    case 'result_rejected':
      return 'NO'
    case 'result_submitted':
      return 'RS'
    case 'fixture_proposed':
    case 'fixture_challenge':
      return 'FX'
    case 'fixture_accepted':
      return 'AC'
    case 'fixture_declined':
      return 'DC'
    case 'fixture_countered':
      return 'CT'
    case 'fixture_cancelled':
      return 'CA'
    case 'fixture_activity':
      return 'AD'
    case 'friend_request':
      return 'FR'
    case 'friend_accepted':
      return 'FA'
    case 'cup_match':
      return 'CP'
    case 'table_updated':
      return 'TB'
    case 'tournament':
      return 'TR'
    case 'chat':
      return 'CH'
    default:
      return 'NT'
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
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1100)
  const [dropdownPosition, setDropdownPosition] = useState({ top: '100%', right: 0, left: 'auto', transform: 'none' })
  const dropdownRef = useRef(null)
  const buttonRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1100)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const spaceOnRight = window.innerWidth - rect.right
      const spaceOnLeft = rect.left
      const dropdownWidth = 380

      if (isMobile) {
        setDropdownPosition({
          position: 'fixed',
          top: `calc(var(--header-height) + var(--safe-top) + 10px)`,
          left: '50%',
          right: 'auto',
          transform: 'translateX(-50%)'
        })
      } else if (spaceOnRight < dropdownWidth && spaceOnLeft > dropdownWidth) {
        // Not enough space on right, but enough on left -> align right
        setDropdownPosition({
          position: 'absolute',
          top: '100%',
          right: 0,
          left: 'auto',
          transform: 'none'
        })
      } else if (spaceOnLeft < dropdownWidth) {
        // Not enough space on left -> align left (extend to right)
        setDropdownPosition({
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 'auto',
          transform: 'none'
        })
      } else {
        // Default to right alignment
        setDropdownPosition({
          position: 'absolute',
          top: '100%',
          right: 0,
          left: 'auto',
          transform: 'none'
        })
      }
    }
  }, [isOpen, isMobile])

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

  const handleNotificationClick = async (notification) => {
    let url = notification.data?.url || '/home'

    if (!notification.data?.url) {
      switch (notification.type) {
        case 'result_approved':
        case 'result_rejected':
          url = '/results'
          break
        case 'result_submitted':
          url = '/admin?tab=results'
          break
        case 'fixture_proposed':
        case 'proposal_pending':
        case 'fixture_challenge':
        case 'fixture_accepted':
        case 'fixture_declined':
        case 'fixture_countered':
        case 'fixture_cancelled':
        case 'fixture_activity':
          url = notification.data?.fixtureKind === 'cup' ? '/cup-fixtures' : '/fixtures'
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
          url = '/notifications'
      }
    }

    if (!notification.isRead) {
      const notificationDocId = notification.notificationDocId || notification.id
      const updated = localNotifications.map((n) =>
        n.id === notification.id ? { ...n, isRead: true } : n
      )
      setLocalNotifications(updated)
      const unread = updated.filter((n) => !n.isRead).length
      updateBadgeCount(unread)

      const allStored = JSON.parse(localStorage.getItem('eliteArrowsNotifications') || '[]')
      const updatedStored = allStored.map((n) =>
        n.id === notification.id ? { ...n, isRead: true } : n
      )
      localStorage.setItem('eliteArrowsNotifications', JSON.stringify(updatedStored))
      try {
        await setDoc(doc(db, 'notifications', notificationDocId), { isRead: true }, { merge: true })
      } catch (error) {
        console.log('Error marking notification read:', error)
      }
    }

    setIsOpen(false)
    navigate(url)
  }

  const markAllAsRead = async () => {
    const updated = localNotifications.map((n) => ({ ...n, isRead: true }))
    setLocalNotifications(updated)
    updateBadgeCount(0)

    const allStored = JSON.parse(localStorage.getItem('eliteArrowsNotifications') || '[]')
    const unreadNotifications = notifications.filter((n) => !n.isRead)
    const unreadIds = new Set(unreadNotifications.map((n) => n.id))
    const updatedStored = allStored.map((n) => (
      n.toUserId === user.id || unreadIds.has(n.id) ? { ...n, isRead: true } : n
    ))
    localStorage.setItem('eliteArrowsNotifications', JSON.stringify(updatedStored))
    await Promise.all(
      unreadNotifications.map((n) => 
        setDoc(doc(db, 'notifications', n.notificationDocId || n.id), { isRead: true }, { merge: true })
      )
    ).catch((error) => {
      console.log('Error marking all notifications read:', error)
    })
  }

  if (!user) return null

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }} ref={dropdownRef}>
      <button
        ref={buttonRef}
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
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-secondary)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <BellIcon hasUnread={unreadCount > 0} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              background: '#ff4444',
              color: 'white',
              fontSize: '0.6rem',
              fontWeight: '900',
              borderRadius: '50%',
              width: '18px',
              height: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '18px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
              border: '2px solid #0b1228'
            }}
            aria-hidden="true"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="notifications-dropdown"
          role="dialog"
          aria-label="Notifications"
          style={{
            ...dropdownPosition,
            width: 'min(380px, calc(100vw - 20px))',
            maxHeight: 'min(500px, calc(100vh - 120px))',
            background: '#0b1228',
            color: '#f8fafc',
            borderRadius: '16px',
            boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
            border: '1px solid rgba(148, 163, 184, 0.3)',
            zIndex: 11000,
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
            <h3 id="notifications-title" style={{ margin: 0, fontSize: '1rem', color: '#f8fafc' }}>Notifications</h3>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  aria-label="Mark all notifications as read"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#67e8f9',
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
                  color: '#cbd5e1',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <CloseIcon />
              </button>
            </div>
          </div>

          <div
            aria-labelledby="notifications-title"
            style={{ overflowY: 'auto', flex: 1 }}
          >
            {localNotifications.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: '#cbd5e1' }}>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#f8fafc' }}>No notifications yet</p>
              </div>
            ) : (
              localNotifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: notification.isRead ? 'transparent' : 'rgba(103, 232, 249, 0.16)',
                    border: 'none',
                    borderBottom: '1px solid rgba(148, 163, 184, 0.22)',
                    padding: '14px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    gap: '12px',
                    color: '#f8fafc'
                  }}
                >
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#67e8f9', minWidth: '26px' }}>
                    {getNotificationIcon(notification.type)}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '0.9rem', margin: 0, fontWeight: notification.isRead ? 'normal' : '600', color: '#f8fafc', overflowWrap: 'anywhere', whiteSpace: 'normal' }}>
                      {notification.message || notification.title || 'New notification'}
                    </p>
                    <div style={{ marginTop: '4px', fontSize: '0.75rem', color: '#cbd5e1' }}>
                      {formatTime(notification.createdAt)}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
