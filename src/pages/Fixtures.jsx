import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Link } from 'react-router-dom'

export default function Fixtures() {
  const { user, getAllUsers } = useAuth()
  const [activeTab, setActiveTab] = useState('upcoming')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({
    opponent: '',
    gameType: 'Friendly',
    fixtureDate: '',
    fixtureTime: ''
  })

  const allUsers = getAllUsers()
  const availablePlayers = allUsers.filter(u => u.id !== user.id)
  
  const getFilteredOpponents = (gameType) => {
    if (gameType === 'League') {
      return availablePlayers.filter(p => p.division === user.division)
    }
    return availablePlayers
  }

  useEffect(() => {
    const pendingFixtures = JSON.parse(localStorage.getItem('eliteArrowsFixtures') || '[]')
      .filter(f => f.player2Id === user.id && f.status === 'pending')
    if (pendingFixtures.length > 0 && activeTab === 'upcoming') {
      setActiveTab('pending')
    }
  }, [])

  const fixtures = JSON.parse(localStorage.getItem('eliteArrowsFixtures') || '[]')

  const pendingFixtures = fixtures.filter(f => f.player2Id === user.id && f.status === 'pending')
  const sentFixtures = fixtures.filter(f => f.createdBy === user.id)
  const upcomingFixtures = fixtures.filter(f => 
    (f.player1Id === user.id || f.player2Id === user.id) && f.status === 'accepted'
  )

  const handleAcceptFixture = (fixtureId) => {
    const updatedFixtures = fixtures.map(f => 
      f.id === fixtureId ? { ...f, status: 'accepted' } : f
    )
    localStorage.setItem('eliteArrowsFixtures', JSON.stringify(updatedFixtures))

    const fixture = fixtures.find(f => f.id === fixtureId)
    const notifications = JSON.parse(localStorage.getItem('eliteArrowsNotifications') || '[]')
    notifications.push({
      id: `fixture_accept_${Date.now()}`,
      type: 'fixture_accepted',
      fromUserId: user.id,
      fromUsername: user.username,
      toUserId: fixture.createdBy,
      message: `${user.username} accepted your fixture challenge for ${fixture.fixtureDate} at ${fixture.fixtureTime}`,
      isRead: false,
      createdAt: new Date().toISOString()
    })
    localStorage.setItem('eliteArrowsNotifications', JSON.stringify(notifications))
    window.location.reload()
  }

  const handleDeclineFixture = (fixtureId) => {
    if (!confirm('Decline this fixture?')) return
    
    const fixture = fixtures.find(f => f.id === fixtureId)
    const updatedFixtures = fixtures.filter(f => f.id !== fixtureId)
    localStorage.setItem('eliteArrowsFixtures', JSON.stringify(updatedFixtures))

    const notifications = JSON.parse(localStorage.getItem('eliteArrowsNotifications') || '[]')
    notifications.push({
      id: `fixture_decline_${Date.now()}`,
      type: 'fixture_declined',
      fromUserId: user.id,
      fromUsername: user.username,
      toUserId: fixture.createdBy,
      message: `${user.username} declined your fixture challenge`,
      isRead: false,
      createdAt: new Date().toISOString()
    })
    localStorage.setItem('eliteArrowsNotifications', JSON.stringify(notifications))
    window.location.reload()
  }

  const handleCancelFixture = (fixtureId) => {
    if (!confirm('Cancel this fixture?')) return
    const updatedFixtures = fixtures.filter(f => f.id !== fixtureId)
    localStorage.setItem('eliteArrowsFixtures', JSON.stringify(updatedFixtures))
    window.location.reload()
  }

  return (
    <div className="page">
      <div className="page-header" style={{ textAlign: 'center', paddingBottom: '20px' }}>
        <h1 className="page-title" style={{ marginBottom: '15px' }}>Fixtures</h1>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          + Create Fixture
        </button>
      </div>

      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }} onClick={() => setShowCreateModal(false)}>
          <div style={{
            background: 'var(--bg-secondary)',
            borderRadius: '16px',
            padding: '25px',
            maxWidth: '450px',
            width: '100%',
            border: '1px solid var(--border)'
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '20px', color: 'var(--accent-cyan)', textAlign: 'center' }}>
              {createForm.opponent 
                ? `You vs ${allUsers.find(u => u.id === createForm.opponent)?.username || 'Select Opponent'}` 
                : 'Create New Fixture'}
            </h3>
            
<div className="form-group">
              <label>Game Type</label>
              <select 
                value={createForm.gameType} 
                onChange={(e) => {
                  const newType = e.target.value
                  setCreateForm({...createForm, gameType: newType, opponent: ''})
                }}
              >
                <option value="Friendly">Friendly</option>
                <option value="League">League</option>
              </select>
              {createForm.gameType === 'League' && (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '5px' }}>
                  Only players in your division ({user.division}) are shown
                </p>
              )}
            </div>

            <div className="form-group">
              <label>Select Opponent</label>
              <select 
                value={createForm.opponent} 
                onChange={e => setCreateForm({...createForm, opponent: e.target.value})}
              >
                <option value="">Select opponent</option>
                {getFilteredOpponents(createForm.gameType).map(p => (
                  <option key={p.id} value={p.id}>
                    {p.username} ({p.division})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Select Opponent</label>
              <select 
                value={createForm.opponent} 
                onChange={e => setCreateForm({...createForm, opponent: e.target.value})}
              >
                <option value="">Select opponent</option>
                {availablePlayers.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.username} ({p.division})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '15px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Date</label>
                <input
                  type="date"
                  value={createForm.fixtureDate}
                  onChange={e => setCreateForm({...createForm, fixtureDate: e.target.value})}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Time</label>
                <input
                  type="time"
                  value={createForm.fixtureTime}
                  onChange={e => setCreateForm({...createForm, fixtureTime: e.target.value})}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button 
                className="btn btn-secondary" 
                style={{ flex: 1 }}
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                style={{ flex: 1 }}
                onClick={() => {
                  if (!createForm.opponent || !createForm.fixtureDate || !createForm.fixtureTime) {
                    alert('Please fill in all fields')
                    return
                  }
                  const opponentUser = availablePlayers.find(p => p.id === createForm.opponent)
                  const fixtures = JSON.parse(localStorage.getItem('eliteArrowsFixtures') || '[]')
                  const existingFixture = fixtures.find(f => 
                    (f.player1Id === user.id && f.player2Id === opponentUser.id) ||
                    (f.player1Id === opponentUser.id && f.player2Id === user.id)
                  )
                  if (existingFixture) {
                    alert('A fixture already exists with this player')
                    return
                  }
                  const newFixture = {
                    id: Date.now(),
                    player1Id: user.id,
                    player1Name: user.username,
                    player2Id: opponentUser.id,
                    player2Name: opponentUser.username,
                    division: user.division,
                    gameType: createForm.gameType,
                    fixtureDate: createForm.fixtureDate,
                    fixtureTime: createForm.fixtureTime,
                    createdBy: user.id,
                    createdAt: new Date().toISOString(),
                    status: 'pending'
                  }
                  fixtures.push(newFixture)
                  localStorage.setItem('eliteArrowsFixtures', JSON.stringify(fixtures))
                  const notifications = JSON.parse(localStorage.getItem('eliteArrowsNotifications') || '[]')
                  notifications.push({
                    id: `fixture_${Date.now()}`,
                    type: 'fixture_challenge',
                    fromUserId: user.id,
                    fromUsername: user.username,
                    toUserId: opponentUser.id,
                    message: `${user.username} has sent you a fixture challenge: ${createForm.fixtureDate} at ${createForm.fixtureTime}`,
                    isRead: false,
                    createdAt: new Date().toISOString()
                  })
                  localStorage.setItem('eliteArrowsNotifications', JSON.stringify(notifications))
                  setShowCreateModal(false)
                  setCreateForm({ opponent: '', gameType: 'Friendly', fixtureDate: '', fixtureTime: '' })
                  window.location.reload()
                }}
              >
                Send Challenge
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button
          className={`btn ${activeTab === 'upcoming' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('upcoming')}
        >
          Upcoming ({upcomingFixtures.length})
        </button>
        <button
          className={`btn ${activeTab === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('pending')}
        >
          Pending ({pendingFixtures.length})
        </button>
        <button
          className={`btn ${activeTab === 'sent' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('sent')}
        >
          Sent ({sentFixtures.length})
        </button>
      </div>

      {activeTab === 'upcoming' && (
        <div className="card">
          <h3 className="card-title">Upcoming Fixtures</h3>
          {upcomingFixtures.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <p style={{ color: 'var(--text-muted)', marginBottom: '15px' }}>
                No upcoming fixtures
              </p>
              <Link to="/submit-result" className="btn btn-primary">
                Create a Fixture
              </Link>
            </div>
          ) : (
            upcomingFixtures.map(fixture => (
              <div key={fixture.id} style={{ 
                padding: '20px', 
                background: 'rgba(34, 197, 94, 0.1)', 
                border: '1px solid var(--success)',
                borderRadius: '12px',
                marginBottom: '15px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                  <div>
                    <div style={{ fontSize: '1.1rem', marginBottom: '5px' }}>
                      <strong>{fixture.player1Name}</strong>
                      <span style={{ margin: '0 10px', color: 'var(--text-muted)' }}>vs</span>
                      <strong>{fixture.player2Name}</strong>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)' }}>
                      {fixture.division} | {fixture.gameType}
                    </div>
                  </div>
                  <span style={{ 
                    padding: '5px 12px', 
                    background: 'var(--success)', 
                    color: '#000', 
                    borderRadius: '20px',
                    fontSize: '0.8rem',
                    fontWeight: 'bold'
                  }}>
                    CONFIRMED
                  </span>
                </div>
                <div style={{ 
                  display: 'flex', 
                  gap: '20px',
                  padding: '15px',
                  background: 'var(--bg-secondary)',
                  borderRadius: '8px'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px' }}>DATE</div>
                    <div style={{ fontWeight: '600' }}>📅 {fixture.fixtureDate}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px' }}>TIME</div>
                    <div style={{ fontWeight: '600' }}>⏰ {fixture.fixtureTime}</div>
                  </div>
                </div>
                <p style={{ marginTop: '10px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Submit result at: <Link to="/submit-result" style={{ color: 'var(--accent-cyan)' }}>Submit Result</Link>
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'pending' && (
        <div className="card">
          <h3 className="card-title">Pending Requests</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '15px', fontSize: '0.9rem' }}>
            These players want to play you
          </p>
          {pendingFixtures.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 20px' }}>
              No pending requests
            </p>
          ) : (
            pendingFixtures.map(fixture => (
              <div key={fixture.id} style={{ 
                padding: '20px', 
                background: 'var(--bg-secondary)', 
                border: '2px solid var(--warning)',
                borderRadius: '12px',
                marginBottom: '15px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                  <div>
                    <div style={{ fontSize: '1.1rem', marginBottom: '5px' }}>
                      <strong>{fixture.player1Name}</strong>
                      <span style={{ margin: '0 10px', color: 'var(--text-muted)' }}>wants to play you</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)' }}>
                      {fixture.division} | {fixture.gameType}
                    </div>
                  </div>
                  <span style={{ 
                    padding: '5px 12px', 
                    background: 'var(--warning)', 
                    color: '#000', 
                    borderRadius: '20px',
                    fontSize: '0.8rem',
                    fontWeight: 'bold'
                  }}>
                    PENDING
                  </span>
                </div>
                <div style={{ 
                  display: 'flex', 
                  gap: '20px',
                  padding: '15px',
                  background: 'var(--bg-primary)',
                  borderRadius: '8px',
                  marginBottom: '15px'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px' }}>DATE</div>
                    <div style={{ fontWeight: '600' }}>📅 {fixture.fixtureDate}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px' }}>TIME</div>
                    <div style={{ fontWeight: '600' }}>⏰ {fixture.fixtureTime}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button 
                    className="btn btn-primary" 
                    style={{ flex: 1 }}
                    onClick={() => handleAcceptFixture(fixture.id)}
                  >
                    Accept
                  </button>
                  <button 
                    className="btn btn-secondary" 
                    style={{ flex: 1 }}
                    onClick={() => handleDeclineFixture(fixture.id)}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'sent' && (
        <div className="card">
          <h3 className="card-title">Your Sent Requests</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '15px', fontSize: '0.9rem' }}>
            Fixtures you've requested from other players
          </p>
          {sentFixtures.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 20px' }}>
              No sent requests
            </p>
          ) : (
            sentFixtures.map(fixture => (
              <div key={fixture.id} style={{ 
                padding: '20px', 
                background: 'var(--bg-secondary)', 
                borderRadius: '12px',
                marginBottom: '15px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                  <div>
                    <div style={{ fontSize: '1.1rem', marginBottom: '5px' }}>
                      You vs <strong>{fixture.player2Name}</strong>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)' }}>
                      {fixture.division} | {fixture.gameType}
                    </div>
                  </div>
                  <span style={{ 
                    padding: '5px 12px', 
                    background: fixture.status === 'accepted' ? 'var(--success)' : 'var(--warning)', 
                    color: '#000', 
                    borderRadius: '20px',
                    fontSize: '0.8rem',
                    fontWeight: 'bold'
                  }}>
                    {fixture.status === 'accepted' ? 'ACCEPTED' : 'PENDING'}
                  </span>
                </div>
                <div style={{ 
                  display: 'flex', 
                  gap: '20px',
                  padding: '15px',
                  background: 'var(--bg-primary)',
                  borderRadius: '8px',
                  marginBottom: '15px'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px' }}>DATE</div>
                    <div style={{ fontWeight: '600' }}>📅 {fixture.fixtureDate}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px' }}>TIME</div>
                    <div style={{ fontWeight: '600' }}>⏰ {fixture.fixtureTime}</div>
                  </div>
                </div>
                {fixture.status === 'pending' && (
                  <button 
                    className="btn btn-danger btn-block"
                    onClick={() => handleCancelFixture(fixture.id)}
                  >
                    Cancel Request
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
