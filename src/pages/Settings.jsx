import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { auth, sendPasswordResetEmail, db, doc, setDoc, deleteDoc, usersCollection } from '../firebase'

export default function Settings() {
  const { signOut, user, updateUser, getAllUsers, notifications: contextNotifications } = useAuth()
  const { theme, toggleTheme, language, setLanguage, chatSettings, setChatSettings, navMode, updateNavMode } = useTheme()
  const navigate = useNavigate()
  
  const [activeTab, setActiveTab] = useState('account')
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [socialLinks, setSocialLinks] = useState({
    instagram: user?.socialLinks?.instagram || '',
    whatsapp: user?.socialLinks?.whatsapp || '',
    messenger: user?.socialLinks?.messenger || '',
    facebook: user?.socialLinks?.facebook || '',
    tiktok: user?.socialLinks?.tiktok || '',
    twitter: user?.socialLinks?.twitter || ''
  })
  const [notifications, setNotifications] = useState([])

  useEffect(() => {
    setNotifications(contextNotifications)
  }, [contextNotifications])

  const markAsRead = async (id) => {
    const updated = notifications.map(n => n.id === id ? { ...n, isRead: true } : n)
    localStorage.setItem('eliteArrowsNotifications', JSON.stringify(updated))
    setNotifications(updated)
    try {
      await setDoc(doc(db, 'notifications', id), { isRead: true }, { merge: true })
    } catch (error) {
      console.log('Error marking notification as read:', error)
    }
  }

  const markAllAsRead = async () => {
    const updated = notifications.map(n => ({ ...n, isRead: true }))
    localStorage.setItem('eliteArrowsNotifications', JSON.stringify(updated))
    setNotifications(updated)
    await Promise.all(
      notifications
        .filter(n => !n.isRead)
        .map(n => setDoc(doc(db, 'notifications', n.id), { isRead: true }, { merge: true }))
    ).catch((error) => {
      console.log('Error marking all notifications as read:', error)
    })
  }

  const deleteNotification = async (id) => {
    const all = JSON.parse(localStorage.getItem('eliteArrowsNotifications') || '[]')
    const filtered = all.filter(n => n.id !== id)
    localStorage.setItem('eliteArrowsNotifications', JSON.stringify(filtered))
    setNotifications(notifications.filter(n => n.id !== id))
    try {
      await deleteDoc(doc(db, 'notifications', id))
    } catch (error) {
      console.log('Error deleting notification:', error)
    }
  }

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'result_approved': return '✓'
      case 'result_rejected': return '✗'
      case 'game_challenge': return '🎯'
      case 'tournament_signup': return '🏆'
      case 'tournament_update': return '📢'
      case 'payment_approved': return '£'
      case 'support_response': return '?'
      case 'friend_request': return '👤'
      case 'friend_accepted': return '✅'
      case 'friend_rejected': return '❌'
      default: return '•'
    }
  }

  const allUsers = getAllUsers()
  const blockedPlayers = allUsers.filter(u => (user?.blockedUsers || []).includes(u.id))

  const handleDeleteAccount = async () => {
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone. All your data including match history, stats, and messages will be permanently deleted.')) return
    if (!confirm('FINAL WARNING: This will permanently delete your Elite Arrows account. Type "DELETE" in the next prompt to confirm.')) return
    
    const confirmation = prompt('Type DELETE to confirm account deletion:')
    if (confirmation !== 'DELETE') {
      alert('Account deletion cancelled.')
      return
    }

    try {
      // Delete user document from Firestore
      await deleteDoc(doc(db, 'users', user.id))
      
      // Delete user from Firebase Auth
      await auth.currentUser.delete()
      
      // Clear local storage
      localStorage.removeItem('eliteArrowsCurrentUser')
      
      alert('Your account has been permanently deleted.')
      signOut()
      navigate('/auth')
    } catch (error) {
      if (error.code === 'auth/requires-recent-login') {
        alert('For security, please log out and log back in, then try deleting your account again.')
      } else {
        alert('Error deleting account: ' + error.message)
      }
    }
  }

  const handleSignOut = () => {
    signOut()
    navigate('/auth')
  }

  const toggleChatSound = () => setChatSettings(prev => ({ ...prev, soundEnabled: !prev.soundEnabled }))
  const toggleChatNotifications = () => setChatSettings(prev => ({ ...prev, notificationsEnabled: !prev.notificationsEnabled }))

  const handleUpdateEmail = () => {
    if (!newEmail) return alert('Please enter an email')
    const users = getAllUsers()
    if (users.find(u => u.email === newEmail && u.id !== user.id)) {
      return alert('Email already in use')
    }
    updateUser({ email: newEmail })
    setShowEmailForm(false)
    setNewEmail('')
    alert('Email updated!')
  }

  const handleForgotPassword = async () => {
    if (!user?.email) {
      alert('You must be logged in')
      return
    }
    if (!confirm('Send password reset email to your email address?')) return
    
    try {
      await sendPasswordResetEmail(auth, user.email)
      alert('Password reset email sent! Check your inbox.')
      setShowPasswordForm(false)
    } catch (error) {
      alert('Error: ' + error.message)
    }
  }

  const handleSaveSocials = () => {
    updateUser({ socialLinks })
    alert('Social links saved!')
  }

  const handleCancelSubscription = () => {
    if (confirm('Are you sure you want to cancel your subscription?')) {
      updateUser({ isSubscribed: false })
      alert('Subscription cancelled')
    }
  }

  const handleBlockPlayer = (playerId) => {
    const currentBlocked = user?.blockedUsers || []
    if (!currentBlocked.includes(playerId)) {
      updateUser({ blockedUsers: [...currentBlocked, playerId] })
      alert('Player blocked')
    }
  }

  const handleUnblockPlayer = (playerId) => {
    const currentBlocked = user?.blockedUsers || []
    updateUser({ blockedUsers: currentBlocked.filter(id => id !== playerId) })
    alert('Player unblocked')
  }

  const handleToggleOnlineStatus = () => {
    updateUser({ showOnlineStatus: !user?.showOnlineStatus })
  }

  const handleToggleDND = () => {
    if (user?.doNotDisturb) {
      updateUser({ doNotDisturb: false, dndEndTime: null })
    } else {
      const endTime = new Date()
      endTime.setHours(endTime.getHours() + 1)
      updateUser({ doNotDisturb: true, dndEndTime: endTime.toISOString() })
    }
  }

  const handleSetDNDDuration = (hours) => {
    const endTime = new Date()
    endTime.setHours(endTime.getHours() + hours)
    updateUser({ doNotDisturb: true, dndEndTime: endTime.toISOString() })
  }

  const formatDNDTime = () => {
    if (!user?.dndEndTime) return ''
    const remaining = new Date(user.dndEndTime) - new Date()
    if (remaining <= 0) {
      updateUser({ doNotDisturb: false, dndEndTime: null })
      return ''
    }
    const minutes = Math.floor(remaining / 60000)
    return `${minutes} min remaining`
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
      </div>

      <div className="division-tabs">
        <button className={`division-tab ${activeTab === 'account' ? 'active' : ''}`} onClick={() => setActiveTab('account')}>Account</button>
        <button className={`division-tab ${activeTab === 'status' ? 'active' : ''}`} onClick={() => setActiveTab('status')}>Status</button>
        <button className={`division-tab ${activeTab === 'notifications' ? 'active' : ''}`} onClick={() => setActiveTab('notifications')}>
          Notifications {notifications.filter(n => !n.isRead).length > 0 && `(${notifications.filter(n => !n.isRead).length})`}
        </button>
        <button className={`division-tab ${activeTab === 'subscription' ? 'active' : ''}`} onClick={() => setActiveTab('subscription')}>Subscription</button>
        <button className={`division-tab ${activeTab === 'social' ? 'active' : ''}`} onClick={() => setActiveTab('social')}>Social Links</button>
        <button className={`division-tab ${activeTab === 'blocked' ? 'active' : ''}`} onClick={() => setActiveTab('blocked')}>Blocked</button>
        <button className={`division-tab ${activeTab === 'appearance' ? 'active' : ''}`} onClick={() => setActiveTab('appearance')}>Appearance</button>
      </div>

      {activeTab === 'account' && (
        <div>
          {!user?.dartCounterUsername && (
            <div className="card" style={{ marginBottom: '20px', border: '2px solid var(--accent-primary)', background: 'rgba(139, 69, 19, 0.1)' }}>
              <h3 style={{ color: 'var(--accent-primary)', marginBottom: '10px' }}>Welcome! Please add your DartCounter details</h3>
              <p style={{ color: 'var(--text-muted)' }}>You need to add your DartCounter username before using the app.</p>
            </div>
          )}
          <div className="card" style={{ marginBottom: '20px' }}>
            <h3 className="card-title">Account Details</h3>
            <div className="form-group">
              <label>DartCounter Username</label>
              <input type="text" value={user?.dartCounterUsername || ''} onChange={(e) => updateUser({ dartCounterUsername: e.target.value, dartCounterLink: `https://dartcounter.app/profile/${e.target.value}` })} placeholder="Enter your DartCounter username" />
            </div>
            <div className="form-group">
              <label>Date of Birth</label>
              <input type="date" value={user?.dateOfBirth || ''} onChange={(e) => updateUser({ dateOfBirth: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="email" value={user?.email || ''} disabled style={{ flex: 1 }} />
                <button className="btn btn-secondary" onClick={() => setShowEmailForm(true)}>Change</button>
              </div>
            </div>
            {showEmailForm && (
              <div className="form-group">
                <label>New Email</label>
                <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Enter new email" />
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button className="btn btn-primary" onClick={handleUpdateEmail}>Save</button>
                  <button className="btn btn-secondary" onClick={() => setShowEmailForm(false)}>Cancel</button>
                </div>
              </div>
            )}
          </div>

          <div className="card" style={{ marginBottom: '20px' }}>
            <h3 className="card-title">Change Password</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '15px' }}>
              Send a password reset link to your email address.
            </p>
            <button className="btn btn-primary btn-block" onClick={handleForgotPassword}>
              Send Reset Email
            </button>
          </div>

          <div className="card" style={{ marginBottom: '20px' }}>
            <h3 className="card-title">Chat Settings</h3>
            <div className="settings-option">
              <label>Sound</label>
              <label className="toggle">
                <input type="checkbox" checked={chatSettings.soundEnabled} onChange={toggleChatSound} />
                <span className="toggle-slider"></span>
              </label>
            </div>
            <div className="settings-option">
              <label>Notifications</label>
              <label className="toggle">
                <input type="checkbox" checked={chatSettings.notificationsEnabled} onChange={toggleChatNotifications} />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>

          <div className="card" style={{ marginBottom: '20px' }}>
            <h3 className="card-title" style={{ color: 'var(--error)' }}>Danger Zone</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '15px' }}>
              Once you delete your account, there is no going back. Please be certain.
            </p>
            <button className="btn btn-danger btn-block" onClick={handleDeleteAccount}>Delete My Account</button>
          </div>

          <div className="card">
            <button className="btn btn-secondary btn-block" onClick={handleSignOut}>Logout</button>
          </div>
        </div>
      )}

      {activeTab === 'status' && (
        <div>
          <div className="card" style={{ marginBottom: '20px' }}>
            <h3 className="card-title">Online Status</h3>
            <div className="settings-option">
              <div>
                <label>Show Online Status</label>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Allow others to see when you're online
                </p>
              </div>
              <label className="toggle">
                <input type="checkbox" checked={user?.showOnlineStatus !== false} onChange={handleToggleOnlineStatus} />
                <span className="toggle-slider"></span>
              </label>
            </div>
            
            <div style={{ marginTop: '20px', padding: '15px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                <div style={{ 
                  width: '12px', 
                  height: '12px', 
                  borderRadius: '50%', 
                  background: user?.isOnline ? 'var(--success)' : 'var(--text-muted)' 
                }} />
                <span>{user?.isOnline ? 'Currently Online' : 'Offline'}</span>
              </div>
              {user?.lastSeen && (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Last seen: {new Date(user.lastSeen).toLocaleString()}
                </p>
              )}
            </div>
          </div>

          <div className="card">
            <h3 className="card-title">Do Not Disturb</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '15px' }}>
              Temporarily disable notifications
            </p>
            
            {user?.doNotDisturb ? (
              <div>
                <div style={{ 
                  padding: '15px', 
                  background: 'rgba(239, 68, 68, 0.1)', 
                  border: '1px solid #ef4444',
                  borderRadius: '8px',
                  marginBottom: '15px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}>
                    <span>🔕</span>
                    <strong>Do Not Disturb Active</strong>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: '#ef4444', marginTop: '4px' }}>
                    {formatDNDTime()}
                  </p>
                </div>
                <button className="btn btn-secondary btn-block" onClick={handleToggleDND}>
                  Turn Off Do Not Disturb
                </button>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button className="btn btn-secondary" onClick={() => handleSetDNDDuration(1)}>1 Hour</button>
                  <button className="btn btn-secondary" onClick={() => handleSetDNDDuration(2)}>2 Hours</button>
                  <button className="btn btn-secondary" onClick={() => handleSetDNDDuration(4)}>4 Hours</button>
                  <button className="btn btn-secondary" onClick={() => handleSetDNDDuration(8)}>8 Hours</button>
                  <button className="btn btn-secondary" onClick={() => handleSetDNDDuration(24)}>24 Hours</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'subscription' && (
        <div className="card">
          <h3 className="card-title">Elite Arrows Pass</h3>
          <div style={{ padding: '20px', background: 'var(--bg-secondary)', borderRadius: '8px', textAlign: 'center', marginBottom: '20px' }}>
            <p style={{ color: 'var(--success)', fontSize: '1.2rem', fontWeight: '600' }}>Active</p>
            <p style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--accent-cyan)', margin: '10px 0' }}>£5<span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/month</span></p>
            <p style={{ color: 'var(--text-muted)' }}>Monthly subscription</p>
          </div>
          
          <h4 style={{ marginBottom: '12px' }}>Transactions</h4>
          <div style={{ padding: '15px', background: 'var(--bg-secondary)', borderRadius: '8px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <span>Elite Arrows Pass - Monthly</span>
              <span style={{ color: 'var(--success)' }}>-£5.00</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <span>Date paid</span>
              <span>{user?.subscriptionDate ? new Date(user.subscriptionDate).toLocaleDateString() : 'N/A'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <span>Expiry date</span>
              <span>
                {user?.subscriptionExpiry 
                  ? new Date(user.subscriptionExpiry).toLocaleDateString()
                  : user?.subscriptionDate 
                    ? new Date(new Date(user.subscriptionDate).getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()
                    : 'N/A'}
              </span>
            </div>
            {user?.freeAdminSubscription && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', color: 'var(--accent-cyan)', fontSize: '0.85rem' }}>
                <span>Subscription type</span>
                <span>Free (Admin granted)</span>
              </div>
            )}
          </div>

          <button className="btn btn-danger btn-block" onClick={handleCancelSubscription}>Cancel Subscription</button>
        </div>
      )}

      {activeTab === 'social' && (
        <div className="card">
          <h3 className="card-title">Social Links</h3>
          <div className="form-group">
            <label>Instagram</label>
            <input type="text" value={socialLinks.instagram} onChange={(e) => setSocialLinks({...socialLinks, instagram: e.target.value})} placeholder="@username" />
          </div>
          <div className="form-group">
            <label>WhatsApp</label>
            <input type="text" value={socialLinks.whatsapp} onChange={(e) => setSocialLinks({...socialLinks, whatsapp: e.target.value})} placeholder="Phone number" />
          </div>
          <div className="form-group">
            <label>Messenger</label>
            <input type="text" value={socialLinks.messenger} onChange={(e) => setSocialLinks({...socialLinks, messenger: e.target.value})} placeholder="Username" />
          </div>
          <div className="form-group">
            <label>Facebook</label>
            <input type="text" value={socialLinks.facebook} onChange={(e) => setSocialLinks({...socialLinks, facebook: e.target.value})} placeholder="Profile URL" />
          </div>
          <div className="form-group">
            <label>TikTok</label>
            <input type="text" value={socialLinks.tiktok} onChange={(e) => setSocialLinks({...socialLinks, tiktok: e.target.value})} placeholder="@username" />
          </div>
          <div className="form-group">
            <label>X / Twitter</label>
            <input type="text" value={socialLinks.twitter} onChange={(e) => setSocialLinks({...socialLinks, twitter: e.target.value})} placeholder="@username" />
          </div>
          <button className="btn btn-primary btn-block" onClick={handleSaveSocials}>Save Social Links</button>
        </div>
      )}

      {activeTab === 'blocked' && (
        <div className="card">
          <h3 className="card-title">Blocked Players</h3>
          {blockedPlayers.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No blocked players</p>
          ) : (
            blockedPlayers.map(p => (
              <div key={p.id} className="player-card">
                <div className="player-avatar">{p.username.charAt(0).toUpperCase()}</div>
                <div className="player-info">
                  <h3>{p.username}</h3>
                  <p>{p.email}</p>
                </div>
                <button className="btn btn-danger" onClick={() => handleUnblockPlayer(p.id)}>Unblock</button>
              </div>
            ))
          )}
          
          <div style={{ marginTop: '20px' }}>
            <h4 style={{ marginBottom: '12px' }}>Block a Player</h4>
            <select 
              onChange={(e) => e.target.value && handleBlockPlayer(e.target.value)}
              style={{ width: '100%', padding: '12px' }}
            >
              <option value="">Select player to block</option>
              {allUsers.filter(u => u.id !== user.id && !(user?.blockedUsers || []).includes(u.id)).map(u => (
                <option key={u.id} value={u.id}>{u.username}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {activeTab === 'appearance' && (
        <div className="card">
          <h3 className="card-title">Appearance</h3>
          <div className="settings-option">
            <label>Theme</label>
            <label className="toggle">
              <input type="checkbox" checked={theme === 'light'} onChange={toggleTheme} />
              <span className="toggle-slider"></span>
            </label>
          </div>
          <div className="settings-option">
            <label>Language</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
            </select>
          </div>
          <div className="settings-option">
            <label>Navigation</label>
            <select value={navMode} onChange={(e) => updateNavMode(e.target.value)}>
              <option value="bottom">Bottom Bar</option>
              <option value="sidebar">Sidebar</option>
            </select>
          </div>
          <button className="btn btn-secondary btn-block" onClick={() => navigate('/profile')} style={{ marginTop: '12px' }}>Edit Profile</button>
          
          <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
            <h4 style={{ marginBottom: '12px' }}>App Updates</h4>
            <button 
              className="btn btn-secondary btn-block" 
              onClick={() => {
                localStorage.removeItem('eliteArrowsLastVersionSeen')
                window.location.reload()
              }}
            >
              Show Updates Again
            </button>
          </div>
        </div>
      )}

      {activeTab === 'notifications' && (
        <div>
          <div className="card" style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="card-title" style={{ margin: 0 }}>Your Notifications</h3>
              {notifications.filter(n => !n.isRead).length > 0 && (
                <button className="btn btn-secondary btn-sm" onClick={markAllAsRead}>Mark All Read</button>
              )}
            </div>
          </div>

          {notifications.length === 0 ? (
            <div className="card">
              <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No notifications yet.</p>
            </div>
          ) : (
            <div className="card">
              {notifications.slice(0, 20).map(notification => (
                <div 
                  key={notification.id}
                  style={{ 
                    padding: '12px', 
                    borderBottom: '1px solid var(--border)',
                    background: notification.isRead ? 'transparent' : 'rgba(77, 168, 218, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}
                >
                  <span style={{ fontSize: '1.2rem' }}>{getNotificationIcon(notification.type)}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '0.9rem', margin: 0, fontWeight: notification.isRead ? 'normal' : 'bold', color: 'var(--text)' }}>
                      {notification.message || notification.text || notification.title}
                    </p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                      {notification.fromUsername && `${notification.fromUsername} • `}
                      {new Date(notification.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {!notification.isRead && (
                    <button 
                      onClick={() => markAsRead(notification.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                    >
                      ✓
                    </button>
                  )}
                  <button 
                    onClick={() => deleteNotification(notification.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  )
}
