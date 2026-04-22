import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Tooltip from '../components/Tooltip'

const AVAILABLE_BADGES = [
  { id: 'competitive', label: 'Competitive', icon: '🏆', color: '#FFD700' },
  { id: 'friendly', label: 'Friendly', icon: '🤝', color: '#22C55E' },
  { id: 'practice', label: 'Practice', icon: '🎯', color: '#7C5CFC' },
  { id: 'tournament', label: 'Tournament Pro', icon: '🥇', color: '#F59E0B' },
  { id: 'social', label: 'Social Player', icon: '💬', color: '#00D4FF' },
  { id: 'improver', label: 'Always Improving', icon: '📈', color: '#EC4899' },
  { id: 'veteran', label: 'League Veteran', icon: '⭐', color: '#6366F1' },
  { id: ' newcomer', label: 'Newcomer', icon: '🌟', color: '#10B981' },
]

export default function Profile() {
  const { user, updateUser, requestAdminRole, getAllUsers, addFriend, removeFriend, cancelFriendRequest, acceptFriendRequest, declineFriendRequest } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams()
  
  const isViewingOther = id && id !== user.id
  const viewedUser = isViewingOther ? getAllUsers().find(u => u.id === id) : null
  const displayUser = isViewingOther ? viewedUser : user
  
  const [formData, setFormData] = useState({
    username: '',
    nickname: '',
    bio: '',
    country: '',
    dartCounterUsername: '',
    dartCounterLink: '',
    threeDartAverage: ''
  })
  
  useEffect(() => {
    if (displayUser) {
      setFormData({
        username: displayUser.username || '',
        nickname: displayUser.nickname || '',
        bio: displayUser.bio || '',
        country: displayUser.country || '',
        dartCounterUsername: displayUser.dartCounterUsername || '',
        dartCounterLink: displayUser.dartCounterLink || '',
        threeDartAverage: displayUser.threeDartAverage !== undefined && displayUser.threeDartAverage !== null 
          ? String(displayUser.threeDartAverage) 
          : ''
      })
      setProfilePicture(displayUser.profilePicture || '')
      setTags(displayUser.tags || [])
      setSelectedBadges(displayUser.badges || [])
    }
  }, [displayUser?.id, displayUser?.bio, displayUser?.nickname, displayUser?.threeDartAverage])
  const [profilePicture, setProfilePicture] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [tags, setTags] = useState([])
  const [newTag, setNewTag] = useState('')
  const [selectedBadges, setSelectedBadges] = useState([])
  const [showBadgeSelector, setShowBadgeSelector] = useState(false)

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim()) && tags.length < 10) {
      setTags([...tags, newTag.trim()])
      setNewTag('')
    }
  }

  const handleRemoveTag = (tagToRemove) => {
    setTags(tags.filter(tag => tag !== tagToRemove))
  }

  const handleToggleBadge = (badgeId) => {
    if (selectedBadges.includes(badgeId)) {
      setSelectedBadges(selectedBadges.filter(b => b !== badgeId))
    } else if (selectedBadges.length < 4) {
      setSelectedBadges([...selectedBadges, badgeId])
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTag()
    }
  }

  const results = JSON.parse(localStorage.getItem('eliteArrowsResults') || '[]')
  const approvedResults = results.filter(r => r.status === 'approved')
  
  const getHeadToHead = (otherUserId) => {
    const matches = approvedResults.filter(r => 
      (r.player1Id === user.id && r.player2Id === otherUserId) || 
      (r.player2Id === user.id && r.player1Id === otherUserId)
    )
    
    let wins = 0, losses = 0, draws = 0
    let player180s = 0
    let opponent180s = 0
    
    matches.forEach(m => {
      const isPlayer1 = m.player1Id === user.id
      if (isPlayer1) {
        player180s += m.player1Stats?.['180s'] || 0
        opponent180s += m.player2Stats?.['180s'] || 0
        if (m.score1 > m.score2) wins++
        else if (m.score1 < m.score2) losses++
        else draws++
      } else {
        player180s += m.player2Stats?.['180s'] || 0
        opponent180s += m.player1Stats?.['180s'] || 0
        if (m.score2 > m.score1) wins++
        else if (m.score2 < m.score1) losses++
        else draws++
      }
    })
    
    return { wins, losses, draws, total: matches.length, player180s, opponent180s }
  }

  const allUsers = getAllUsers()
  const displayUserFriends = displayUser?.friends 
    ? allUsers.filter(u => displayUser.friends.includes(u.id))
    : []

  const headToHead = isViewingOther ? getHeadToHead(id) : null

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'threeDartAverage' ? parseFloat(value) || 0 : value
    }))
  }

  const handlePictureChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setProfilePicture(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    const avgValue = parseFloat(formData.threeDartAverage) || 0
    
    const updates = {
      username: formData.username?.trim() || '',
      nickname: formData.nickname?.trim() || '',
      bio: formData.bio?.trim() || '',
      country: formData.country?.trim() || '',
      dartCounterUsername: formData.dartCounterUsername?.trim() || '',
      threeDartAverage: formData.threeDartAverage ? avgValue : 0,
      profilePicture: profilePicture || '',
      tags: tags || [],
      badges: selectedBadges || []
    }
    
    if (updates.dartCounterUsername) {
      updates.dartCounterLink = `https://dartcounter.app/profile/${updates.dartCounterUsername}`
    }
    
    Object.keys(updates).forEach(key => {
      if (updates[key] === '') delete updates[key]
    })
    
    console.log('Saving updates:', updates)
    
    try {
      await updateUser(updates, false)
      alert('Profile updated!')
      navigate(0) // Force page reload
    } catch (e) {
      console.error('Save error:', e)
      alert('Error saving: ' + e.message)
    }
    setSaving(false)
  }

  const handleRequestAdmin = () => {
    requestAdminRole()
    setMessage('Admin request submitted!')
    setTimeout(() => setMessage(''), 3000)
  }

  if (isViewingOther && viewedUser) {
    return (
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">{viewedUser.username}'s Profile</h1>
        </div>

        <div className="card" style={{ marginBottom: '20px' }}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <div style={{
              width: '100px',
              height: '100px',
              borderRadius: '50%',
              background: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '3rem',
              margin: '0 auto 15px',
              overflow: 'hidden'
            }}>
              {viewedUser.profilePicture ? (
                <img src={viewedUser.profilePicture} alt={viewedUser.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                viewedUser.username.charAt(0).toUpperCase()
              )}
            </div>
            <h2 style={{ color: 'var(--accent-cyan)' }}>{viewedUser.username}</h2>
            {viewedUser.nickname && <p style={{ color: 'var(--text-muted)' }}>"{viewedUser.nickname}"</p>}
            {viewedUser.isAdmin && <span className="admin-badge">Admin</span>}
            {viewedUser.badges && viewedUser.badges.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginTop: '8px', flexWrap: 'wrap' }}>
                {viewedUser.badges.map(badgeId => {
                  const badge = AVAILABLE_BADGES.find(b => b.id === badgeId)
                  return badge ? (
                    <Tooltip key={badgeId} content={badge.label}>
                      <span style={{ 
                        padding: '4px 8px', 
                        background: badge.color + '20',
                        border: `2px solid ${badge.color}`,
                        borderRadius: '12px',
                        fontSize: '0.9rem'
                      }}>
                        {badge.icon}
                      </span>
                    </Tooltip>
                  ) : null
                })}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px', marginBottom: '20px' }}>
            <div style={{ padding: '15px', background: 'var(--bg-secondary)', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>{viewedUser.division || 'Unassigned'}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Division</div>
            </div>
            <div style={{ padding: '15px', background: 'var(--bg-secondary)', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>{viewedUser.threeDartAverage?.toFixed(2) || 0}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>3-Dart Avg</div>
            </div>
            {viewedUser.stats && (
              <>
                <div style={{ padding: '15px', background: 'var(--bg-secondary)', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>{viewedUser.stats.played || 0}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Played</div>
                </div>
                <div style={{ padding: '15px', background: 'var(--bg-secondary)', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--success)' }}>{viewedUser.stats.wins || 0}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Wins</div>
                </div>
                <div style={{ padding: '15px', background: 'var(--bg-secondary)', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>{viewedUser.stats['180s'] || 0}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>180s</div>
                </div>
                <div style={{ padding: '15px', background: 'var(--bg-secondary)', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>{viewedUser.stats.highestCheckout || 0}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Hi Checkout</div>
                </div>
              </>
            )}
            {viewedUser.country && (
              <div style={{ padding: '15px', background: 'var(--bg-secondary)', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.2rem' }}>{viewedUser.country}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Country</div>
              </div>
            )}
            <div style={{ padding: '15px', background: 'var(--bg-secondary)', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1rem' }}>{viewedUser.createdAt ? new Date(viewedUser.createdAt).toLocaleDateString() : 'N/A'}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Member Since</div>
            </div>
          </div>

          {viewedUser.dart && (
            <div style={{ marginBottom: '15px' }}>
              <h4 style={{ marginBottom: '8px' }}>Darts</h4>
              <p style={{ color: 'var(--text-muted)' }}>{viewedUser.dart}</p>
            </div>
          )}

          {(viewedUser.dartCounterLink || viewedUser.dartCounterUsername) && (
            <div style={{ marginBottom: '15px' }}>
              <a 
                href={viewedUser.dartCounterLink || `https://dartcounter.app/profile/${viewedUser.dartCounterUsername}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary btn-block"
                style={{ display: 'inline-block', textDecoration: 'none' }}
              >
                📊 View DartCounter Profile
              </a>
            </div>
          )}

          {viewedUser.socialLinks && (
            <div style={{ marginBottom: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {viewedUser.socialLinks.whatsapp && (
                <a href={`https://wa.me/${viewedUser.socialLinks.whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" style={{ color: '#25D366', fontSize: '1.5rem' }}>💬</a>
              )}
              {viewedUser.socialLinks.messenger && (
                <a href={`https://m.me/${viewedUser.socialLinks.messenger}`} target="_blank" rel="noopener noreferrer" style={{ color: '#0084FF', fontSize: '1.5rem' }}>💬</a>
              )}
              {viewedUser.socialLinks.facebook && (
                <a href={viewedUser.socialLinks.facebook} target="_blank" rel="noopener noreferrer" style={{ color: '#1877F2', fontSize: '1.5rem' }}>📘</a>
              )}
              {viewedUser.socialLinks.instagram && (
                <a href={`https://instagram.com/${viewedUser.socialLinks.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" style={{ color: '#E4405F', fontSize: '1.5rem' }}>📷</a>
              )}
              {viewedUser.socialLinks.tiktok && (
                <a href={`https://tiktok.com/@${viewedUser.socialLinks.tiktok.replace('@', '')}`} target="_blank" rel="noopener noreferrer" style={{ color: '#fff', fontSize: '1.5rem' }}>🎵</a>
              )}
              {viewedUser.socialLinks.twitter && (
                <a href={`https://twitter.com/${viewedUser.socialLinks.twitter.replace('@', '')}`} target="_blank" rel="noopener noreferrer" style={{ color: '#1DA1F2', fontSize: '1.5rem' }}>🐦</a>
              )}
            </div>
          )}

          {viewedUser.bio && (
            <div style={{ marginBottom: '15px' }}>
              <h4 style={{ marginBottom: '8px' }}>About</h4>
              <p style={{ color: 'var(--text-muted)' }}>{viewedUser.bio}</p>
            </div>
          )}

          {viewedUser.tags && viewedUser.tags.length > 0 && (
            <div style={{ marginBottom: '15px' }}>
              <h4 style={{ marginBottom: '8px' }}>Tags</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {viewedUser.tags.map((tag, index) => (
                  <span 
                    key={index} 
                    style={{ 
                      padding: '4px 12px',
                      background: 'var(--accent-primary)',
                      borderRadius: '15px',
                      fontSize: '0.85rem'
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {headToHead && headToHead.total > 0 && (
            <div style={{ marginBottom: '15px' }}>
              <h4 style={{ marginBottom: '8px' }}>Head to Head (vs You)</h4>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <div style={{ padding: '10px', background: 'var(--success)', borderRadius: '8px', textAlign: 'center', flex: 1 }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{headToHead.wins}</div>
                  <div style={{ fontSize: '0.75rem' }}>Wins</div>
                </div>
                <div style={{ padding: '10px', background: 'var(--warning)', borderRadius: '8px', textAlign: 'center', flex: 1 }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{headToHead.draws}</div>
                  <div style={{ fontSize: '0.75rem' }}>Draws</div>
                </div>
                <div style={{ padding: '10px', background: 'var(--error)', borderRadius: '8px', textAlign: 'center', flex: 1 }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{headToHead.losses}</div>
                  <div style={{ fontSize: '0.75rem' }}>Losses</div>
                </div>
              </div>
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '8px', fontSize: '0.85rem' }}>
                Total games: {headToHead.total} | Their 180s vs you: {headToHead.opponent180s}
              </p>
            </div>
          )}

          {displayUserFriends.length > 0 && (
            <div style={{ marginBottom: '15px' }}>
              <h4 style={{ marginBottom: '8px' }}>Friends ({displayUserFriends.length})</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {displayUserFriends.slice(0, 10).map(friend => (
                  <span key={friend.id} style={{ 
                    padding: '4px 10px', 
                    background: 'var(--bg-secondary)', 
                    borderRadius: '15px',
                    fontSize: '0.85rem'
                  }}>
                    {friend.username}
                  </span>
                ))}
                {displayUserFriends.length > 10 && (
                  <span style={{ padding: '4px 10px', color: 'var(--text-muted)' }}>+{displayUserFriends.length - 10} more</span>
                )}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '15px', flexWrap: 'wrap' }}>
            {isViewingOther && (
              <>
                {(user.friends || []).includes(viewedUser.id) ? (
                  <>
                    <button 
                      className="btn btn-secondary"
                      onClick={() => removeFriend(viewedUser.id)}
                    >
                      Remove Friend
                    </button>
                    {(user.isSubscribed || user.isAdmin) && (
                      <button 
                        className="btn btn-secondary"
                        onClick={() => navigate('/chat', { state: { openChat: `friend_${viewedUser.id}` } })}
                      >
                        Chat
                      </button>
                    )}
                  </>
                ) : (user.sentFriendRequests || []).includes(viewedUser.id) ? (
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <span style={{ 
                      padding: '8px 16px', 
                      background: 'var(--warning)', 
                      borderRadius: '8px',
                      fontSize: '0.9rem',
                      fontWeight: '500'
                    }}>
                      Pending
                    </span>
                    <button 
                      className="btn btn-secondary"
                      onClick={() => cancelFriendRequest(viewedUser.id)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (user.receivedFriendRequests || []).includes(viewedUser.id) ? (
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button 
                      className="btn btn-primary"
                      onClick={() => acceptFriendRequest(viewedUser.id)}
                    >
                      Accept
                    </button>
                    <button 
                      className="btn btn-secondary"
                      onClick={() => declineFriendRequest(viewedUser.id)}
                    >
                      Decline
                    </button>
                  </div>
                ) : (
                  <button 
                    className="btn btn-primary"
                    onClick={() => {
                      console.log('Add Friend button clicked', viewedUser.id)
                      addFriend(viewedUser.id)
                    }}
                  >
                    Add Friend
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Profile</h1>
      </div>

      <div className="card">
        <div className="profile-header">
          <label className="profile-avatar-large">
            {profilePicture ? (
              <img src={profilePicture} alt={user.username} />
            ) : (
              <span className="home-avatar-placeholder" style={{ fontSize: '3rem' }}>
                {user.username.charAt(0).toUpperCase()}
              </span>
            )}
            <input type="file" accept="image/*" onChange={handlePictureChange} />
          </label>
          {user.badges && user.badges.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginTop: '12px', flexWrap: 'wrap' }}>
              {user.badges.map(badgeId => {
                const badge = AVAILABLE_BADGES.find(b => b.id === badgeId)
                return badge ? (
                  <Tooltip key={badgeId} content={badge.label}>
                    <span style={{ 
                      padding: '4px 8px', 
                      background: badge.color + '20',
                      border: `2px solid ${badge.color}`,
                      borderRadius: '12px',
                      fontSize: '0.9rem'
                    }}>
                      {badge.icon}
                    </span>
                  </Tooltip>
                ) : null
              })}
            </div>
          )}
        </div>

        <div className="profile-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="nickname">Nickname</label>
            <input
              type="text"
              id="nickname"
              name="nickname"
              value={formData.nickname}
              onChange={handleChange}
              placeholder="Your darts nickname"
            />
          </div>

          <div className="form-group">
            <label htmlFor="bio">Bio</label>
            <textarea
              id="bio"
              name="bio"
              value={formData.bio}
              onChange={handleChange}
              rows={3}
              placeholder="Tell us about yourself..."
            />

          </div>

          <div className="form-group">
            <label htmlFor="country">Country</label>
            <input
              type="text"
              id="country"
              name="country"
              value={formData.country}
              onChange={handleChange}
              placeholder="e.g., England, Scotland, Wales..."
            />
          </div>

          <div className="form-group">
            <label>Tags (up to 10)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
              {tags.map((tag, index) => (
                <span 
                  key={index} 
                  style={{ 
                    padding: '4px 10px',
                    background: 'var(--accent-primary)',
                    borderRadius: '15px',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {tag}
                  <button 
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      color: 'var(--text-primary)', 
                      cursor: 'pointer',
                      padding: '0',
                      fontSize: '1rem',
                      lineHeight: '1'
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Add a tag..."
                style={{ flex: 1 }}
                disabled={tags.length >= 10}
              />
              <button 
                type="button"
                className="btn btn-secondary"
                onClick={handleAddTag}
                disabled={tags.length >= 10 || !newTag.trim()}
              >
                Add
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Profile Badges (select up to 4)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
              {selectedBadges.map(badgeId => {
                const badge = AVAILABLE_BADGES.find(b => b.id === badgeId)
                return badge ? (
                  <span 
                    key={badgeId}
                    style={{ 
                      padding: '4px 10px',
                      background: badge.color + '20',
                      border: `2px solid ${badge.color}`,
                      borderRadius: '12px',
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    {badge.icon} {badge.label}
                    <button 
                      type="button"
                      onClick={() => handleToggleBadge(badgeId)}
                      style={{ 
                        background: 'none', 
                        border: 'none', 
                        color: 'var(--text-primary)', 
                        cursor: 'pointer',
                        padding: '0',
                        fontSize: '1rem',
                        lineHeight: '1'
                      }}
                    >
                      ×
                    </button>
                  </span>
                ) : null
              })}
            </div>
            <button 
              type="button"
              className="btn btn-secondary btn-block"
              onClick={() => setShowBadgeSelector(!showBadgeSelector)}
            >
              {showBadgeSelector ? 'Hide Badges' : 'Choose Badges'}
            </button>
            {showBadgeSelector && (
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(2, 1fr)', 
                gap: '8px', 
                marginTop: '12px',
                padding: '12px',
                background: 'var(--bg-primary)',
                borderRadius: '8px'
              }}>
                {AVAILABLE_BADGES.map(badge => (
                  <button
                    key={badge.id}
                    type="button"
                    onClick={() => handleToggleBadge(badge.id)}
                    style={{
                      padding: '8px 12px',
                      background: selectedBadges.includes(badge.id) ? badge.color + '30' : 'var(--bg-secondary)',
                      border: selectedBadges.includes(badge.id) ? `2px solid ${badge.color}` : '1px solid var(--border)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.85rem',
                      transition: 'all 0.2s'
                    }}
                  >
                    <span>{badge.icon}</span>
                    <span>{badge.label}</span>
                    {selectedBadges.includes(badge.id) && (
                      <span style={{ marginLeft: 'auto', fontSize: '0.75rem' }}>✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="dartCounterUsername">DartCounter Username</label>
            <input
              type="text"
              id="dartCounterUsername"
              name="dartCounterUsername"
              value={formData.dartCounterUsername}
              onChange={handleChange}
              placeholder="Your DartCounter username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="dartCounterLink">DartCounter Link</label>
            <input
              type="url"
              id="dartCounterLink"
              name="dartCounterLink"
              value={formData.dartCounterLink}
              onChange={handleChange}
              placeholder="https://dartcounter.net/player/..."
            />
          </div>

          <div className="form-group">
            <label htmlFor="threeDartAverage">3-Dart Average</label>
            <input
              type="number"
              id="threeDartAverage"
              name="threeDartAverage"
              value={formData.threeDartAverage}
              onChange={handleChange}
              step="0.1"
              min="0"
            />
          </div>

          <button 
            className="btn btn-primary btn-block" 
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>

          {message && <p className="form-error" style={{ color: 'var(--success)' }}>{message}</p>}

          <div className="profile-actions">
            {!user.isAdmin && !user.adminRequestPending && (
              <button 
                className="btn btn-secondary btn-block"
                onClick={handleRequestAdmin}
              >
                Apply for Admin Role
              </button>
            )}
            {user.adminRequestPending && (
              <p style={{ color: 'var(--warning)', textAlign: 'center', marginBottom: '10px' }}>
                Admin request pending approval
              </p>
            )}
            
            <button 
              className="btn btn-secondary btn-block"
              onClick={() => navigate('/settings')}
            >
              Go to Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}