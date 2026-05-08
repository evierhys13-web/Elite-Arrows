import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, DIVISIONS } from '../context/AuthContext'
import { SkeletonList } from '../components/Skeleton'
import Breadcrumbs from '../components/Breadcrumbs'
import Tooltip from '../components/Tooltip'
import { useToast } from '../context/ToastContext'
import { db, doc, setDoc } from '../firebase'

export default function Players() {
  const { user, getAllUsers, addFriend, removeFriend, loading, getFixtures, updateFixtures, notifyUser, triggerDataRefresh } = useAuth()
  const { showToast } = useToast()
  const [showFriendsOnly, setShowFriendsOnly] = useState(false)
  const [searchTerm, setSearchBar] = useState('')
  const [selectedDivision, setSelectedDivision] = useState('All')
  const [visible, setVisible] = useState(false)
  const [proposeModal, setProposeModal] = useState(null)
  const [proposeForm, setProposeForm] = useState({ date: '', time: '', type: 'Friendly' })
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
    const matchesDivision = selectedDivision === 'All' ? true : u.division === selectedDivision;
    return matchesSearch && matchesFriends && matchesDivision;
  })

  const handleProposeTime = async () => {
    if (!proposeForm.date || !proposeForm.time) return showToast('Please select date and time', 'error')

    const newFixture = {
      id: Date.now(),
      player1Id: user.id,
      player1Name: user.username,
      player2Id: proposeModal.id,
      player2Name: proposeModal.username,
      division: user.division,
      gameType: proposeForm.type,
      fixtureDate: proposeForm.date,
      fixtureTime: proposeForm.time,
      createdBy: user.id,
      createdAt: new Date().toISOString(),
      status: 'pending',
      proposalStatus: 'sent'
    }

    try {
      await setDoc(doc(db, 'fixtures', String(newFixture.id)), newFixture)
      await notifyUser(
        proposeModal.id,
        'New Fixture Proposal',
        `${user.username} proposed a ${proposeForm.type} match for ${proposeForm.date} at ${proposeForm.time}.`,
        'proposal_pending',
        { fixtureId: newFixture.id }
      )
      showToast('Proposal sent!', 'success')
      setProposeModal(null)
      triggerDataRefresh('fixtures')
    } catch (e) {
      showToast('Error sending proposal', 'error')
    }
  }

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

      <div className="card glass" style={{ marginBottom: '32px', padding: '24px' }}>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 2, minWidth: '280px', position: 'relative' }}>
            <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>🔍</span>
            <input
              placeholder="Search by name or nickname..."
              value={searchTerm}
              onChange={(e) => setSearchBar(e.target.value)}
              className="glass"
              style={{ paddingLeft: '44px', width: '100%', borderRadius: '14px', height: '48px' }}
            />
          </div>

          <div style={{ flex: 1, minWidth: '200px' }}>
            <select
              value={selectedDivision}
              onChange={(e) => setSelectedDivision(e.target.value)}
              className="glass"
              style={{ width: '100%', height: '48px', borderRadius: '14px', padding: '0 15px' }}
            >
              <option value="All">All Divisions</option>
              {DIVISIONS.map(div => <option key={div} value={div}>{div}</option>)}
              <option value="Unassigned">Unassigned</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '12px' }}>
            <button
              className={`division-tab ${!showFriendsOnly ? 'active' : ''}`}
              onClick={() => setShowFriendsOnly(false)}
              style={{ margin: 0, padding: '8px 16px' }}
            >
              All
            </button>
            <button
              className={`division-tab ${showFriendsOnly ? 'active' : ''}`}
              onClick={() => setShowFriendsOnly(true)}
              style={{ margin: 0, padding: '8px 16px' }}
            >
              Friends
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
            <div key={i} className="card glass skeleton" style={{ height: '280px' }} />
          ))
        ) : filteredPlayers.length === 0 ? (
          <div className="card glass" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ fontSize: '4rem', marginBottom: '20px', opacity: 0.3 }}>👤</div>
            <h3 style={{ color: 'white', marginBottom: '8px' }}>No Players Found</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>
              Try adjusting your search or filters.
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
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'pointer',
                border: isOnline ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border)',
                background: isOnline ? 'rgba(16, 185, 129, 0.03)' : 'rgba(255,255,255,0.02)',
                position: 'relative',
                overflow: 'hidden'
              }} onClick={() => navigate(`/profile/${player.id}`)}>

                {isOnline && <div style={{ position: 'absolute', top: 0, right: 0, width: '40px', height: '40px', background: 'var(--success)', clipPath: 'polygon(100% 0, 0 0, 100% 100%)', opacity: 0.2 }} />}

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
                    {player.nickname && <p style={{ color: 'var(--accent-cyan)', fontSize: '0.85rem', fontWeight: 600, marginTop: '-4px', marginBottom: '6px' }}>"{player.nickname}"</p>}
                    <span style={{
                      fontSize: '0.65rem',
                      background: 'rgba(124, 92, 252, 0.1)',
                      border: '1px solid rgba(124, 92, 252, 0.2)',
                      padding: '3px 10px',
                      borderRadius: '20px',
                      color: 'var(--accent-purple)',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.02em'
                    }}>
                      {player.division || 'Unassigned'}
                    </span>
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                   <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                      <div style={{ flex: 1 }}>
                         <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Average</div>
                         <div style={{ fontWeight: 900, color: 'white', fontSize: '1.1rem' }}>{player.threeDartAverage?.toFixed(2) || '0.00'}</div>
                      </div>
                      {player.dart && (
                        <div style={{ flex: 2 }}>
                           <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Equipment</div>
                           <div style={{ fontWeight: 700, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--accent-cyan)' }}>🎯 {player.dart}</div>
                        </div>
                      )}
                   </div>
                   <p style={{
                     fontSize: '0.85rem',
                     color: 'var(--text-muted)',
                     lineHeight: '1.6',
                     display: '-webkit-box',
                     WebkitLineClamp: '2',
                     WebkitBoxOrient: 'vertical',
                     overflow: 'hidden',
                     height: '2.6rem',
                     marginBottom: '24px'
                   }}>
                     {player.bio || 'Elite Arrows league member.'}
                   </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }} onClick={e => e.stopPropagation()}>
                  <button 
                    className="btn btn-primary btn-sm"
                    onClick={() => navigate('/chat', { state: { openChat: `friend_${player.id}` } })}
                  >
                    💬 Chat
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setProposeModal(player)}
                  >
                    📅 Propose
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ gridColumn: 'span 2' }}
                    onClick={() => navigate(`/profile/${player.id}`)}
                  >
                    📊 View Stats
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {proposeModal && (
        <div className="modal-overlay" onClick={() => setProposeModal(null)}>
          <div className="modal-content glass" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <h2 className="text-gradient" style={{ marginBottom: '20px' }}>Propose Match</h2>
            <p style={{ marginBottom: '24px', color: 'var(--text-muted)' }}>Suggest a time to play <strong>{proposeModal.username}</strong></p>

            <div className="form-group">
              <label>Match Type</label>
              <select value={proposeForm.type} onChange={e => setProposeForm({...proposeForm, type: e.target.value})}>
                <option value="Friendly">Friendly</option>
                {proposeModal.division === user.division && <option value="League">League</option>}
                <option value="Cup">Cup</option>
              </select>
            </div>

            <div className="form-group">
              <label>Date</label>
              <input type="date" value={proposeForm.date} onChange={e => setProposeForm({...proposeForm, date: e.target.value})} min={new Date().toISOString().split('T')[0]} />
            </div>

            <div className="form-group">
              <label>Time</label>
              <input type="time" value={proposeForm.time} onChange={e => setProposeForm({...proposeForm, time: e.target.value})} />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '30px' }}>
              <button className="btn btn-secondary btn-block" onClick={() => setProposeModal(null)}>Cancel</button>
              <button className="btn btn-primary btn-block" onClick={handleProposeTime}>Send Proposal</button>
            </div>
          </div>
        </div>
      )}

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
        .division-tab {
          border: none;
          background: transparent;
          color: var(--text-muted);
          cursor: pointer;
          font-weight: 700;
          transition: all 0.2s ease;
          border-radius: 8px;
        }
        .division-tab.active {
          background: white;
          color: black;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
      `}</style>
    </div>
  )
}
