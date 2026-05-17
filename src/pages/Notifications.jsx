import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { db, doc, setDoc, deleteDoc } from '../firebase'
import Breadcrumbs from '../components/Breadcrumbs'

const getNotificationIcon = (type) => {
  switch (type) {
    case 'result_approved': return '✓'
    case 'result_rejected': return '✗'
    case 'fixture_proposed':
    case 'proposal_pending':
    case 'fixture_challenge': return '🎯'
    case 'fixture_accepted': return '✅'
    case 'fixture_declined': return '❌'
    case 'fixture_countered': return '🔄'
    case 'fixture_cancelled': return '🚫'
    case 'fixture_activity': return '📢'
    case 'friend_request': return '👤'
    case 'friend_accepted': return '🤝'
    case 'cup_match': return '🏆'
    case 'table_updated': return '📊'
    case 'tournament': return '🥇'
    case 'chat': return '💬'
    default: return '•'
  }
}

export default function Notifications() {
  const { user, notifications: contextNotifications, unreadCount, updateBadgeCount } = useAuth()
  const [notifications, setNotifications] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    setNotifications(contextNotifications)
  }, [contextNotifications])

  const markAsRead = async (notification) => {
    if (notification.isRead) return

    const notificationDocId = notification.notificationDocId || notification.id
    const updated = notifications.map(n => n.id === notification.id ? { ...n, isRead: true } : n)
    setNotifications(updated)

    const unread = updated.filter(n => !n.isRead).length
    updateBadgeCount(unread)

    const allStored = JSON.parse(localStorage.getItem('eliteArrowsNotifications') || '[]')
    const updatedStored = allStored.map(n => n.id === notification.id ? { ...n, isRead: true } : n)
    localStorage.setItem('eliteArrowsNotifications', JSON.stringify(updatedStored))

    try {
      await setDoc(doc(db, 'notifications', notificationDocId), { isRead: true }, { merge: true })
    } catch (error) {
      console.log('Error marking notification read:', error)
    }
  }

  const handleNotificationClick = async (notification) => {
    await markAsRead(notification)

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
      }
    }
    navigate(url)
  }

  const markAllAsRead = async () => {
    const updated = notifications.map(n => ({ ...n, isRead: true }))
    setNotifications(updated)
    updateBadgeCount(0)

    const unreadNotifications = contextNotifications.filter(n => !n.isRead)
    const unreadIds = new Set(unreadNotifications.map(n => n.id))

    const allStored = JSON.parse(localStorage.getItem('eliteArrowsNotifications') || '[]')
    const updatedStored = allStored.map(n => unreadIds.has(n.id) ? { ...n, isRead: true } : n)
    localStorage.setItem('eliteArrowsNotifications', JSON.stringify(updatedStored))

    await Promise.all(
      unreadNotifications.map(n =>
        setDoc(doc(db, 'notifications', n.notificationDocId || n.id), { isRead: true }, { merge: true })
      )
    ).catch(error => {
      console.log('Error marking all notifications read:', error)
    })
  }

  const deleteNotification = async (e, id) => {
    e.stopPropagation()
    const updated = notifications.filter(n => n.id !== id)
    setNotifications(updated)

    const unread = updated.filter(n => !n.isRead).length
    updateBadgeCount(unread)

    const allStored = JSON.parse(localStorage.getItem('eliteArrowsNotifications') || '[]')
    const filteredStored = allStored.filter(n => n.id !== id)
    localStorage.setItem('eliteArrowsNotifications', JSON.stringify(filteredStored))

    try {
      await deleteDoc(doc(db, 'notifications', id))
    } catch (error) {
      console.log('Error deleting notification:', error)
    }
  }

  return (
    <div className="page animate-fade-in">
      <Breadcrumbs items={[{ label: 'Home', path: '/home' }, { label: 'Notifications', path: '/notifications' }]} />

      <div className="page-header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title text-gradient">Notifications</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Stay updated with your latest activities</p>
        </div>
        {unreadCount > 0 && (
          <button className="btn btn-secondary btn-sm glass" onClick={markAllAsRead}>
            Mark all read
          </button>
        )}
      </div>

      <div className="card glass" style={{ padding: '0', overflow: 'hidden' }}>
        {notifications.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px', opacity: 0.5 }}>🔔</div>
            <h3 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>No notifications yet</h3>
            <p style={{ color: 'var(--text-muted)' }}>We'll notify you when something important happens.</p>
          </div>
        ) : (
          <div>
            {notifications.map(notification => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                style={{
                  padding: '20px',
                  borderBottom: '1px solid var(--border)',
                  background: notification.isRead ? 'transparent' : 'rgba(129, 140, 248, 0.08)',
                  display: 'flex',
                  gap: '16px',
                  cursor: 'pointer',
                  transition: 'background 0.2s ease',
                  position: 'relative'
                }}
                className="notification-item"
              >
                {!notification.isRead && (
                  <div style={{
                    position: 'absolute',
                    left: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: 'var(--accent-primary)',
                    boxShadow: '0 0 8px var(--accent-primary)'
                  }} />
                )}

                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  background: notification.isRead ? 'var(--bg-secondary)' : 'var(--accent-primary)',
                  color: notification.isRead ? 'var(--text-muted)' : 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.2rem',
                  flexShrink: 0
                }}>
                  {getNotificationIcon(notification.type)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <p style={{
                      fontSize: '0.95rem',
                      margin: 0,
                      fontWeight: notification.isRead ? '400' : '600',
                      color: 'var(--text-primary)',
                      lineHeight: '1.4'
                    }}>
                      {notification.message || notification.title}
                    </p>
                    <button
                      onClick={(e) => deleteNotification(e, notification.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '4px',
                        opacity: 0.6
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = 0.6}
                    >
                      ×
                    </button>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                    {new Date(notification.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
