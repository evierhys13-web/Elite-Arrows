import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Tooltip from '../components/Tooltip'
import { compressImage } from '../components/ImageUtils'
import { derivePlayerStatsFromResults } from '../utils/playerStats'
import Breadcrumbs from '../components/Breadcrumbs'

const AVAILABLE_BADGES = [
  { id: 'competitive', label: 'Competitive', icon: '🏆', color: '#FFD700' },
  { id: 'friendly', label: 'Friendly', icon: '🤝', color: '#10B981' },
  { id: 'practice', label: 'Practice', icon: '🎯', color: '#7C5CFC' },
  { id: 'tournament', label: 'Tournament Pro', icon: '🥇', color: '#F59E0B' },
  { id: 'social', label: 'Social Player', icon: '💬', color: '#00D4FF' },
  { id: 'improver', label: 'Always Improving', icon: '📈', color: '#EC4899' },
  { id: 'veteran', label: 'League Veteran', icon: '⭐', color: '#6366F1' },
  { id: 'newcomer', label: 'Newcomer', icon: '🌟', color: '#10B981' },
]

export default function Profile() {
  const { user, updateUser, requestAdminRole, getAllUsers, getResults, getFixtures, adminData, addFriend, removeFriend } = useAuth()
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
    dartCounterUsername: ''
  })
  
  const [profilePicture, setProfilePicture] = useState('')
  const [saving, setSaving] = useState(false)
  const [tags, setTags] = useState([])
  const [newTag, setNewTag] = useState('')
  const [selectedBadges, setSelectedBadges] = useState([])
  const [showBadgeSelector, setShowBadgeSelector] = useState(false)

  useEffect(() => {
    if (displayUser) {
      setFormData({
        username: displayUser.username || '',
        nickname: displayUser.nickname || '',
        bio: displayUser.bio || '',
        country: displayUser.country || '',
        dartCounterUsername: displayUser.dartCounterUsername || ''
      })
      setProfilePicture(displayUser.profilePicture || '')
      setTags(displayUser.tags || [])
      setSelectedBadges(displayUser.badges || [])
    }
  }, [displayUser])

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

  const allUsers = getAllUsers()
  const allResults = getResults()
  const fixtures = getFixtures()
  const statsByUserId = derivePlayerStatsFromResults(allUsers, allResults, {
    fixtures,
    adminData,
    leagueOnly: false
  })
  const displayStats = displayUser?.id ? statsByUserId[String(displayUser.id)] : null

  const handlePictureChange = async (e) => {
    const file = e.target.files[0]
    if (file) {
      const compressed = await compressImage(file, 300, 300, 0.8)
      setProfilePicture(compressed)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    const updates = {
      username: formData.username?.trim(),
      nickname: formData.nickname?.trim(),
      bio: formData.bio?.trim(),
      country: formData.country?.trim(),
      dartCounterUsername: formData.dartCounterUsername?.trim(),
      profilePicture,
      tags,
      badges: selectedBadges
    }

    try {
      await updateUser(updates, false)
      alert('Profile successfully updated!')
    } catch (e) {
      alert('Error: ' + e.message)
    }
    setSaving(false)
  }

  if (!displayUser) return <div className="page"><div className="card glass">User not found</div></div>

  return (
    <div className="page animate-fade-in">
      <Breadcrumbs items={[{ label: 'Home', path: '/home' }, { label: 'Profile', path: `/profile/${displayUser.id}` }]} />

      {/* Hero Header Section */}
      <div className="card glass" style={{
        padding: 0,
        overflow: 'hidden',
        marginBottom: '32px',
        border: 'none',
        background: 'linear-gradient(to bottom, rgba(124, 92, 252, 0.15), rgba(5, 8, 22, 0.5))'
      }}>
        <div style={{ height: '140px', background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', opacity: 0.8 }} />

        <div style={{ padding: '0 24px 40px', marginTop: '-70px', textAlign: 'center' }}>
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: '20px' }}>
            <div className="avatar-ring" style={{ width: '140px', height: '140px', padding: '4px', background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-cyan))', boxShadow: '0 12px 40px rgba(0,0,0,0.6)' }}>
              <div className="avatar-inner" style={{ background: '#050816' }}>
                {profilePicture ? (
                  <img src={profilePicture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '3.5rem', fontWeight: 900, color: 'white' }}>{(displayUser.username || '?').charAt(0).toUpperCase()}</span>
                )}
              </div>
            </div>
            {!isViewingOther && (
              <label style={{ position: 'absolute', bottom: '8px', right: '8px', background: 'var(--accent-primary)', width: '42px', height: '42px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '4px solid #050816', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>
                <input type="file" accept="image/*" onChange={handlePictureChange} style={{ display: 'none' }} />
                <span style={{ fontSize: '1.2rem' }}>📸</span>
              </label>
            )}
          </div>

          <h1 className="text-gradient" style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '6px' }}>{displayUser.username}</h1>
          {displayUser.nickname && <p style={{ color: 'var(--accent-cyan)', fontWeight: 800, fontSize: '1.2rem', marginBottom: '20px', letterSpacing: '0.02em' }}>"{displayUser.nickname}"</p>}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <span className="admin-badge" style={{ padding: '8px 20px', background: 'rgba(0, 212, 255, 0.1)', border: '1px solid rgba(0, 212, 255, 0.3)', color: 'var(--accent-cyan)', fontSize: '0.8rem', borderRadius: '99px' }}>
              {displayUser.division || 'League Member'}
            </span>
            {displayUser.isAdmin && <span className="admin-badge" style={{ padding: '8px 20px', borderRadius: '99px' }}>Official Admin</span>}
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '32px', flexWrap: 'wrap' }}>
            {selectedBadges.map(badgeId => {
              const badge = AVAILABLE_BADGES.find(b => b.id === badgeId)
              return badge ? (
                <Tooltip key={badgeId} content={badge.label}>
                  <div style={{ width: '54px', height: '54px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '16px', border: `1px solid ${badge.color}`, fontSize: '1.8rem', boxShadow: `0 8px 20px ${badge.color}22`, transition: 'transform 0.2s' }}>
                    {badge.icon}
                  </div>
                </Tooltip>
              ) : null
            })}
          </div>
        </div>
      </div>

      {/* Integrated Stats Grid */}
      <div className="home-stats-grid" style={{ marginBottom: '32px' }}>
        {[
          { label: 'Played', value: displayStats?.played || 0 },
          { label: 'Wins', value: displayStats?.wins || 0, color: 'var(--success)' },
          { label: 'Total 180s', value: displayStats?.['180s'] || 0, color: 'var(--warning)' },
          { label: 'Best CO', value: displayStats?.highestCheckout || 0, color: 'var(--accent-cyan)' }
        ].map(stat => (
          <div key={stat.label} className="stat-card glass" style={{ background: 'rgba(15, 23, 42, 0.3)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="stat-value" style={{ color: stat.color }}>{stat.value}</div>
            <div className="stat-label" style={{ opacity: 0.8 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '32px', marginBottom: '40px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Bio Section */}
          <div className="card glass" style={{ height: '100%' }}>
            <h3 className="card-title">📖 Player Bio</h3>
            {!isViewingOther ? (
              <div className="profile-form">
                <div className="form-group">
                  <label>Display Name</label>
                  <input name="username" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Nickname</label>
                  <input name="nickname" value={formData.nickname} onChange={e => setFormData({...formData, nickname: e.target.value})} placeholder="Optional" />
                </div>
                <div className="form-group">
                  <label>About You</label>
                  <textarea name="bio" value={formData.bio} onChange={e => setFormData({...formData, bio: e.target.value})} rows={5} placeholder="Tell us about your setup..." />
                </div>
                <button className="btn btn-primary btn-block" onClick={handleSave} disabled={saving}>
                  {saving ? 'Syncing...' : 'Save Profile Details'}
                </button>
              </div>
            ) : (
              <div style={{ color: 'var(--text-secondary)' }}>
                <p style={{ marginBottom: '24px', lineHeight: '1.8', fontSize: '1.05rem', opacity: 0.9 }}>
                  {displayUser.bio || "No biography provided."}
                </p>
                <div style={{ padding: '24px', background: 'rgba(0,0,0,0.2)', borderRadius: '20px', display: 'grid', gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Location</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{displayUser.country || 'Unknown'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Joined</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{displayUser.createdAt ? new Date(displayUser.createdAt).toLocaleDateString() : 'N/A'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Tags & Reputation Section */}
          <div className="card glass">
            <h3 className="card-title">✨ Tags & Reputation</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '24px' }}>
              {tags.map((tag, i) => (
                <span key={i} style={{ padding: '8px 18px', background: 'var(--accent-primary)', borderRadius: '99px', fontSize: '0.85rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {tag}
                  {!isViewingOther && (
                    <button onClick={() => handleRemoveTag(tag)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.2rem', padding: 0, lineScale: 1 }}>×</button>
                  )}
                </span>
              ))}
            </div>
            {!isViewingOther && tags.length < 10 && (
              <div style={{ display: 'flex', gap: '10px' }}>
                <input placeholder="Add skill/style tag..." value={newTag} onChange={e => setNewTag(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleAddTag()} />
                <button className="btn btn-secondary btn-sm" onClick={handleAddTag}>Add</button>
              </div>
            )}
          </div>

          {/* Connected Apps Section */}
          <div className="card glass" style={{ borderLeft: '4px solid var(--accent-cyan)' }}>
            <h3 className="card-title">🚀 Connectivity</h3>
            <div style={{ display: 'grid', gap: '16px' }}>
              {(displayUser.dartCounterUsername || displayUser.dartCounterLink) ? (
                <a
                  href={displayUser.dartCounterLink || `https://dartcounter.app/profile/${displayUser.dartCounterUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-block"
                  style={{ background: 'rgba(0, 212, 255, 0.05)', borderColor: 'var(--accent-cyan)', color: 'var(--accent-cyan)' }}
                >
                  🎯 DartCounter Statistics
                </a>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center' }}>No external apps connected.</p>
              )}

              {!isViewingOther && (
                <div style={{ marginTop: '8px' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>DartCounter Username</label>
                  <input
                    placeholder="Enter username"
                    value={formData.dartCounterUsername}
                    onChange={e => setFormData({...formData, dartCounterUsername: e.target.value})}
                  />
                </div>
              )}

              {isViewingOther && (
                <button className="btn btn-primary btn-block" onClick={() => addFriend(displayUser.id)}>
                  ➕ Add to Friends
                </button>
              )}
            </div>
          </div>

          {/* Badge Selector (Hidden by default) */}
          {!isViewingOther && (
            <div className="card glass">
              <h3 className="card-title">🎖️ My Badges</h3>
              <button className="btn btn-secondary btn-block" onClick={() => setShowBadgeSelector(!showBadgeSelector)}>
                {showBadgeSelector ? 'Close Badge Shop' : 'Select Profile Badges'}
              </button>

              {showBadgeSelector && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginTop: '24px' }}>
                  {AVAILABLE_BADGES.map(badge => (
                    <button
                      key={badge.id}
                      onClick={() => handleToggleBadge(badge.id)}
                      style={{
                        padding: '16px 12px',
                        background: selectedBadges.includes(badge.id) ? badge.color + '20' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${selectedBadges.includes(badge.id) ? badge.color : 'rgba(255,255,255,0.1)'}`,
                        borderRadius: '16px',
                        color: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '0.8rem'
                      }}
                    >
                      <span style={{ fontSize: '1.6rem' }}>{badge.icon}</span>
                      <span style={{ fontWeight: 600 }}>{badge.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
