import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { db, doc, setDoc, deleteDoc } from '../firebase'
import UserSearchSelect from '../components/UserSearchSelect'

export default function Fixtures() {
  const { user, getAllUsers, getFixtures, updateFixtures, triggerDataRefresh, notifyUser, notifyAdmins } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('upcoming')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({
    opponent: '',
    gameType: 'Friendly',
    fixtureDate: '',
    fixtureTime: ''
  })
  const [selectedCupFixture, setSelectedCupFixture] = useState(null)
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  const ADMIN_EMAILS = ['rhyshowe2023@outlook.com', 'dhineberry@yahoo.com']
  const isEmailAdmin = ADMIN_EMAILS.includes(user?.email?.toLowerCase())
  const isDbAdmin = user?.isAdmin === true
  const isTournamentAdmin = user?.isTournamentAdmin === true
  const isAdmin = isEmailAdmin || isDbAdmin || isTournamentAdmin
  const isSubscribed = user?.isSubscribed === true

  const seasons = JSON.parse(localStorage.getItem('eliteArrowsSeasons') || '[]')
  const currentSeason = seasons.find(s => s.status === 'active')
  const seasonStartDate = currentSeason?.startDate ? new Date(currentSeason.startDate) : null
  const seasonHasStarted = !seasonStartDate || new Date() >= seasonStartDate
  const canCreateLeagueFixtures = seasonHasStarted || isAdmin

  const allUsers = getAllUsers()
  const availablePlayers = allUsers.filter(u => u.id !== user.id)
  
  useEffect(() => {
    const pendingFixtures = getFixtures()
      .filter(f => f.player2Id === user.id && f.status === 'pending')
    if (pendingFixtures.length > 0 && activeTab === 'upcoming') {
      setActiveTab('pending')
    }
  }, [])

  const fixtures = getFixtures()
  const allResults = JSON.parse(localStorage.getItem('eliteArrowsResults') || '[]')
  
  const regularFixtures = fixtures.filter(f => !f.cupId)

  const pendingFixtures = regularFixtures.filter(f => (
    f.player2Id === user.id &&
    f.createdBy !== user.id &&
    f.status === 'pending' &&
    (f.proposalStatus || 'sent') === 'sent'
  ))
  const sentFixtures = regularFixtures.filter(f => 
    f.status === 'pending' &&
    (f.proposalStatus || 'sent') === 'sent' &&
    (f.createdBy === user.id || f.player1Id === user.id)
  )
  const upcomingFixtures = regularFixtures.filter(f => 
    (f.player1Id === user.id || f.player2Id === user.id) && f.status === 'accepted'
  )
  const completedResults = allResults.filter(r =>
    r.status === 'approved' &&
    (r.player1Id === user.id || r.player2Id === user.id)
  )

  const cupFixturesData = fixtures.filter(f => f.cupId && (f.player1Id === user.id || f.player2Id === user.id))
  
  const cupNeedsScheduling = cupFixturesData.filter(f => f.status === 'pending' && !f.proposedDate)
  
  const cupAwaitingResponse = cupFixturesData.filter(f => {
    if (f.status === 'pending' && f.proposedDate && f.proposedBy !== user.id) return true
    if (f.status === 'countered' && f.counterBy !== user.id) return true
    return false
  })
  
  const cupAwaitingOpponent = cupFixturesData.filter(f => {
    if (f.status === 'pending' && f.proposedBy === user.id) return true
    if (f.status === 'countered' && f.counterBy === user.id) return true
    return false
  })
  
  const cupAccepted = cupFixturesData.filter(f => f.status === 'accepted')
  const upcomingCount = upcomingFixtures.length + cupAccepted.length
  
  const getPlayerName = (id) => allUsers.find(u => u.id === id)?.username || 'Unknown'
  
  const getCupName = (cupId) => {
    const cups = JSON.parse(localStorage.getItem('eliteArrowsCups') || '[]')
    return cups.find(c => c.id === cupId)?.name || 'Unknown Cup'
  }
  
  const getRoundName = (round, cupId) => {
    const cups = JSON.parse(localStorage.getItem('eliteArrowsCups') || '[]')
    const cup = cups.find(c => c.id === cupId)
    const totalRounds = cup ? Math.max(...(cup.matches?.map(m => m.round) || [1])) : 1
    if (round === totalRounds) return 'Final'
    if (round === totalRounds - 1) return 'Semi-Final'
    if (round === totalRounds - 2) return 'Quarter-Final'
    return `Round ${round}`
  }

  const saveFixtures = (updatedFixtures) => {
    updateFixtures(updatedFixtures)
  }

  const stripUndefined = (value) => {
    if (Array.isArray(value)) return value.map(stripUndefined)
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value)
          .filter(([, entryValue]) => entryValue !== undefined)
          .map(([key, entryValue]) => [key, stripUndefined(entryValue)])
      )
    }
    return value
  }

  const persistFixture = async (fixture) => {
    await setDoc(doc(db, 'fixtures', fixture.id.toString()), stripUndefined(fixture), { merge: true })
  }

  const getOtherPlayerId = (fixture) => {
    if (!fixture) return null
    return fixture.player1Id === user.id ? fixture.player2Id : fixture.player1Id
  }

  const sendFixtureActivityToAdmins = async (action, fixture, details = {}) => {
    const fixtureKind = fixture.cupId ? 'cup' : 'league'
    const opponentId = fixture.player1Id === user.id ? fixture.player2Id : fixture.player1Id
    const opponentName = getPlayerName(opponentId)
    await notifyAdmins(
      'Fixture Activity',
      `${user.username} ${action} a ${fixtureKind} fixture ${fixture.player1Name || getPlayerName(fixture.player1Id)} vs ${fixture.player2Name || getPlayerName(fixture.player2Id)}${opponentName ? ` (${opponentName})` : ''}`,
      {
        type: 'fixture_activity',
        adminLog: true,
        fixtureKind,
        action,
        fixtureId: fixture.id,
        ...details
      }
    )
  }
  
  const proposeCupSchedule = async () => {
    if (!scheduleDate || !scheduleTime) {
      alert('Please select a date and time')
      return
    }
    const allFixtures = getFixtures()
    const index = allFixtures.findIndex(f => f.id === selectedCupFixture.id)
    if (index !== -1) {
      allFixtures[index].proposedDate = scheduleDate
      allFixtures[index].proposedTime = scheduleTime
      allFixtures[index].proposedBy = user.id
      allFixtures[index].proposalStatus = 'sent'
      saveFixtures(allFixtures)
      
      try {
        await persistFixture(allFixtures[index])
        const opponentId = allFixtures[index].player1Id === user.id ? allFixtures[index].player2Id : allFixtures[index].player1Id
        await notifyUser(
          opponentId,
          'Cup Fixture Proposal',
          `${user.username} proposed ${scheduleDate} at ${scheduleTime} for your cup fixture.`,
          'proposal_pending',
          { fixtureKind: 'cup', fixtureId: allFixtures[index].id }
        )
        await sendFixtureActivityToAdmins('proposed', allFixtures[index], { proposedDate: scheduleDate, proposedTime: scheduleTime })
      } catch (e) {
        console.log('Error saving to Firebase:', e)
      }
      
      setSelectedCupFixture(null)
      setScheduleDate('')
      setScheduleTime('')
      alert('Schedule proposal sent!')
      triggerDataRefresh('fixtures')
      setRefreshKey(prev => prev + 1)
    }
  }
  
  const acceptCupProposal = async (fixture) => {
    const allFixtures = getFixtures()
    const index = allFixtures.findIndex(f => f.id === fixture.id)
    if (index !== -1) {
      allFixtures[index].status = 'accepted'
      allFixtures[index].proposalStatus = 'accepted'
      allFixtures[index].date = fixture.proposedDate
      allFixtures[index].time = fixture.proposedTime
      saveFixtures(allFixtures)
      
      try {
        await persistFixture(allFixtures[index])
        const opponentId = getOtherPlayerId(allFixtures[index])
        await notifyUser(
          opponentId,
          'Cup Fixture Accepted',
          `${user.username} accepted your cup fixture proposal.`,
          'fixture_accepted',
          { fixtureKind: 'cup', fixtureId: allFixtures[index].id }
        )
        await notifyUser(
          user.id,
          'Cup Fixture Confirmed',
          `You accepted the cup fixture proposal. It is now confirmed.`,
          'fixture_accepted',
          { fixtureKind: 'cup', fixtureId: allFixtures[index].id }
        )
        await sendFixtureActivityToAdmins('accepted', allFixtures[index])
      } catch (e) {
        console.log('Error saving to Firebase:', e)
      }
      
      alert('Fixture accepted!')
      triggerDataRefresh('fixtures')
      setRefreshKey(prev => prev + 1)
    }
  }
  
  const rejectCupProposal = async (fixture) => {
    if (!confirm('Reject this fixture?')) return
    const allFixtures = getFixtures()
    const updatedFixtures = allFixtures.filter(f => f.id !== fixture.id)
    saveFixtures(updatedFixtures)
    
    try {
      await deleteDoc(doc(db, 'fixtures', fixture.id.toString()))
      const opponentId = fixture.player1Id === user.id ? fixture.player2Id : fixture.player1Id
      await notifyUser(
        opponentId,
        'Cup Fixture Rejected',
        `${user.username} rejected your cup fixture proposal.`,
        'fixture_declined',
        { fixtureKind: 'cup', fixtureId: fixture.id }
      )
      await notifyUser(
        user.id,
        'Cup Fixture Rejected',
        `You rejected the cup fixture proposal.`,
        'fixture_declined',
        { fixtureKind: 'cup', fixtureId: fixture.id }
      )
      await sendFixtureActivityToAdmins('declined', fixture)
    } catch (e) {
      console.log('Error saving to Firebase:', e)
    }
    
    alert('Fixture rejected')
    triggerDataRefresh('fixtures')
    setRefreshKey(prev => prev + 1)
  }
  
  const submitCupResult = async (fixture) => {
    const score1 = prompt('Enter your score (legs won):')
    if (score1 === null) return
    const score2 = prompt('Enter opponent\'s score (legs won):')
    if (score2 === null) return
    
    const results = JSON.parse(localStorage.getItem('eliteArrowsResults') || '[]')
    const resultId = Date.now().toString()
    const newResult = {
      id: resultId,
      firestoreId: resultId,
      player1: getPlayerName(fixture.player1Id),
      player1Id: fixture.player1Id,
      player2: getPlayerName(fixture.player2Id),
      player2Id: fixture.player2Id,
      score1: parseInt(score1),
      score2: parseInt(score2),
      division: user.division,
      gameType: 'Cup',
      season: new Date().getFullYear().toString(),
      date: new Date().toISOString().split('T')[0],
      submittedAt: new Date().toISOString(),
      status: 'pending',
      cupId: fixture.cupId,
      matchId: fixture.matchId,
      startScore: fixture.startScore,
      bestOf: fixture.bestOf
    }
    
    results.push(newResult)
    localStorage.setItem('eliteArrowsResults', JSON.stringify(results))
    
    try {
      await setDoc(doc(db, 'results', resultId), newResult, { merge: true })
    } catch (e) {
      console.log('Error saving to Firebase:', e)
    }
    
    const allFixtures = getFixtures()
    const index = allFixtures.findIndex(f => f.id === fixture.id)
    if (index !== -1) {
      allFixtures[index].status = 'result_submitted'
      saveFixtures(allFixtures)
      
      try {
        await persistFixture(allFixtures[index])
      } catch (e) {
        console.log('Error saving to Firebase:', e)
      }
    }
    
    alert('Result submitted!')
    triggerDataRefresh('results')
    triggerDataRefresh('fixtures')
    setRefreshKey(prev => prev + 1)
  }

  const getFilteredOpponents = (gameType) => {
    let opponents = availablePlayers
    if (gameType === 'League') {
      opponents = opponents.filter(p => p.division === user.division)
    }
    const existingOpponentIds = regularFixtures
      .filter(f => (f.player1Id === user.id || f.player2Id === user.id) && f.status !== 'completed')
      .map(f => f.player1Id === user.id ? f.player2Id : f.player1Id)
    opponents = opponents.filter(p => !existingOpponentIds.includes(p.id))
    return opponents
  }

  const getPlayedOpponents = () => {
    const results = JSON.parse(localStorage.getItem('eliteArrowsResults') || '[]')
    const leagueResults = results.filter(r => 
      r.status === 'approved' && 
      r.gameType === 'League' &&
      (r.player1Id === user.id || r.player2Id === user.id)
    )
    return leagueResults.map(r => r.player1Id === user.id ? r.player2Id : r.player1Id)
  }
  
  const playedOpponentIds = getPlayedOpponents()

  const handleDeclineFixture = async (fixtureId) => {
    if (!confirm('Decline this fixture?')) return
    
    const fixture = getFixtures().find(f => f.id === fixtureId)
    const updatedFixtures = getFixtures().filter(f => f.id !== fixtureId)
    saveFixtures(updatedFixtures)
    try {
      await deleteDoc(doc(db, 'fixtures', fixtureId.toString()))
      if (fixture?.createdBy) {
        await notifyUser(
          fixture.createdBy,
          'Fixture Declined',
          `${user.username} declined your ${fixture.gameType || 'league'} fixture challenge.`,
          'fixture_declined',
          { fixtureKind: 'league', fixtureId }
        )
      }
      await notifyUser(
        user.id,
        'Fixture Declined',
        `You declined the ${fixture?.gameType || 'league'} fixture request.`,
        'fixture_declined',
        { fixtureKind: 'league', fixtureId }
      )
      if (fixture) {
        await sendFixtureActivityToAdmins('declined', fixture)
      }
    } catch (e) {
      console.log('Error declining fixture:', e)
    }
    triggerDataRefresh('fixtures')
    alert('Fixture declined')
  }

  const handleCancelFixture = async (fixtureId) => {
    if (!confirm('Cancel this fixture?')) return
    const fixture = getFixtures().find(f => f.id === fixtureId)
    const updatedFixtures = getFixtures().filter(f => f.id !== fixtureId)
    saveFixtures(updatedFixtures)
    try {
      await deleteDoc(doc(db, 'fixtures', fixtureId.toString()))
      const recipientId = fixture?.player2Id
      if (recipientId) {
        await notifyUser(
          recipientId,
          'Fixture Cancelled',
          `${user.username} cancelled a ${fixture.gameType || 'league'} fixture request.`,
          'fixture_cancelled',
          { fixtureKind: 'league', fixtureId }
        )
      }
      if (fixture) {
        await sendFixtureActivityToAdmins('cancelled', fixture)
      }
    } catch (e) {
      console.log('Error cancelling fixture:', e)
    }
    triggerDataRefresh('fixtures')
    alert('Fixture cancelled')
  }

  const handleScheduleCupMatch = (fixtureId, date, time) => {
    const allFixtures = JSON.parse(localStorage.getItem('eliteArrowsFixtures') || '[]')
    const index = allFixtures.findIndex(f => f.id === fixtureId)
    if (index !== -1) {
      allFixtures[index].date = date
      allFixtures[index].time = time
      allFixtures[index].scheduledBy = user.id
      allFixtures[index].status = 'accepted'
      saveFixtures(allFixtures)
      alert('Match scheduled!')
    }
  }

  const handleAcceptFixture = async (fixtureId) => {
    const allFixtures = getFixtures()
    const index = allFixtures.findIndex(f => f.id === fixtureId)
    if (index !== -1) {
      allFixtures[index].status = 'accepted'
      allFixtures[index].proposalStatus = 'accepted'
      saveFixtures(allFixtures)
      try {
        await persistFixture(allFixtures[index])
        const creatorId = allFixtures[index].createdBy || getOtherPlayerId(allFixtures[index])
        await notifyUser(
          creatorId,
          'Fixture Accepted',
          `${user.username} accepted your ${allFixtures[index].gameType || 'league'} fixture challenge.`,
          'fixture_accepted',
          { fixtureKind: 'league', fixtureId }
        )
        await notifyUser(
          user.id,
          'Fixture Confirmed',
          `You accepted the ${allFixtures[index].gameType || 'league'} fixture. It is now confirmed.`,
          'fixture_accepted',
          { fixtureKind: 'league', fixtureId }
        )
        await sendFixtureActivityToAdmins('accepted', allFixtures[index])
      } catch (e) {
        console.log('Error accepting fixture:', e)
      }
      triggerDataRefresh('fixtures')
      alert('Fixture accepted!')
    }
  }

  if (!isSubscribed && !isAdmin) {
    return (
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Fixtures</h1>
        </div>
        <div className="card">
          <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
            Subscribe to access Fixtures.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-header" style={{ textAlign: 'center', paddingBottom: '20px' }}>
        <h1 className="page-title" style={{ marginBottom: '15px' }}>Fixtures</h1>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          + Create Fixture
        </button>
        {currentSeason && !seasonHasStarted && (
          <p style={{ marginTop: '10px', fontSize: '0.85rem', color: 'var(--accent-cyan)' }}>
            League fixtures can be created when the season starts ({new Date(currentSeason.startDate).toLocaleDateString()})
          </p>
        )}
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button
          className={`btn ${activeTab === 'my' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('my')}
        >
          My Fixtures
        </button>
        <button
          className={`btn ${activeTab === 'upcoming' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('upcoming')}
        >
          Upcoming ({upcomingCount})
        </button>
        <button
          className={`btn ${activeTab === 'completed' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('completed')}
        >
          Completed ({completedResults.length})
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
        <button
          className={`btn ${activeTab === 'cup' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('cup')}
        >
          Cup Fixtures
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
                ? `${user.username} vs ${allUsers.find(u => u.id === createForm.opponent)?.username}` 
                : `${user.username} vs Select Opponent`}
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
                {!canCreateLeagueFixtures ? (
                  <option value="League" disabled>League (Season not started)</option>
                ) : (
                  <option value="League">League</option>
                )}
              </select>
              {createForm.gameType === 'League' && (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '5px' }}>
                  Only players in your division ({user.division}) are shown
                </p>
              )}
              {!canCreateLeagueFixtures && (
                <p style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', marginTop: '5px' }}>
                  League fixtures can be created when the season starts ({currentSeason ? new Date(currentSeason.startDate).toLocaleDateString() : 'TBA'})
                </p>
              )}
            </div>

            <div className="form-group">
              <UserSearchSelect
                users={getFilteredOpponents(createForm.gameType)}
                selectedId={createForm.opponent}
                onSelect={(id) => setCreateForm({...createForm, opponent: id})}
                placeholder="Search for opponent..."
                excludeIds={[user.id, ...playedOpponentIds]}
                label="Select Opponent"
              />
              {playedOpponentIds.length > 0 && (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {playedOpponentIds.length} opponent(s) already played this season
                </p>
              )}
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
                onClick={async () => {
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
                    status: 'pending',
                    proposalStatus: 'sent'
                  }
                  fixtures.push(newFixture)
                  saveFixtures(fixtures)
                  
                  await persistFixture(newFixture)
                  await notifyUser(
                    opponentUser.id,
                    'Fixture Time Proposal',
                    `${user.username} proposed a ${createForm.gameType} fixture for ${createForm.fixtureDate} at ${createForm.fixtureTime}.`,
                    'proposal_pending',
                    { fixtureKind: 'league', fixtureId: newFixture.id }
                  )
                  await sendFixtureActivityToAdmins('sent', newFixture, {
                    fixtureDate: createForm.fixtureDate,
                    fixtureTime: createForm.fixtureTime
                  })
                  
                  setShowCreateModal(false)
                  setCreateForm({ opponent: '', gameType: 'Friendly', fixtureDate: '', fixtureTime: '' })
                  triggerDataRefresh('fixtures')
                  alert('Fixture challenge sent!')
                }}
              >
                Send Challenge
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'my' && (
        <div className="card">
          <h3 className="card-title">My Fixtures</h3>
          {regularFixtures.length === 0 ? (
            <div className="empty-state">
              <p>No fixtures yet</p>
            </div>
          ) : (
            regularFixtures
              .filter(f => f.player1Id === user.id || f.player2Id === user.id)
              .sort((a, b) => new Date(a.fixtureDate) - new Date(b.fixtureDate))
              .map(fixture => (
                <div key={fixture.id} style={{ 
                  padding: '15px', 
                  background: 'var(--bg-secondary)', 
                  borderRadius: '8px',
                  marginBottom: '10px',
                  borderLeft: `3px solid ${fixture.status === 'accepted' ? 'var(--success)' : 'var(--warning)'}`
                }}>
                  <div style={{ fontWeight: '600', marginBottom: '5px' }}>
                    {fixture.player1Id === user.id ? 'You' : fixture.player1Name} vs {fixture.player2Id === user.id ? 'You' : fixture.player2Name}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {fixture.gameType} • {fixture.fixtureDate} at {fixture.fixtureTime}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', marginTop: '5px' }}>
                    Status: {fixture.status}
                  </div>
                </div>
              ))
          )}
        </div>
      )}

      {activeTab === 'upcoming' && (
        <div className="card">
          <h3 className="card-title">Upcoming Fixtures</h3>
          {upcomingFixtures.length === 0 && cupAccepted.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <p style={{ color: 'var(--text-muted)', marginBottom: '15px' }}>
                No upcoming fixtures
              </p>
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
                <button
                  className="btn btn-primary"
                  style={{ marginTop: '12px' }}
                  onClick={() => navigate(`/submit-result?fixtureId=${fixture.id}`)}
                >
                  Submit Result
                </button>
              </div>
            ))
          )}
          {cupAccepted.length > 0 && (
            <div style={{ marginTop: upcomingFixtures.length > 0 ? '20px' : 0 }}>
              {upcomingFixtures.length > 0 && (
                <h4 style={{ color: 'var(--accent-cyan)', marginBottom: '12px' }}>Cup Fixtures</h4>
              )}
              {cupAccepted.map(fixture => (
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
                        <strong>{getPlayerName(fixture.player1Id)}</strong>
                        <span style={{ margin: '0 10px', color: 'var(--text-muted)' }}>vs</span>
                        <strong>{getPlayerName(fixture.player2Id)}</strong>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)' }}>
                        {getCupName(fixture.cupId)} | {getRoundName(fixture.round, fixture.cupId)}
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
                      <div style={{ fontWeight: '600' }}>{fixture.date || fixture.proposedDate || 'TBC'}</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px' }}>TIME</div>
                      <div style={{ fontWeight: '600' }}>{fixture.time || fixture.proposedTime || 'TBC'}</div>
                    </div>
                  </div>
                  <button
                    className="btn btn-primary"
                    style={{ marginTop: '12px' }}
                    onClick={() => navigate(`/submit-result?fixtureId=${fixture.id}`)}
                  >
                    Submit Result
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'completed' && (
        <div className="card">
          <h3 className="card-title">Completed Games</h3>
          {completedResults.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 20px' }}>
              No completed games yet
            </p>
          ) : (
            completedResults
              .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
              .map(result => {
                const isPlayer1 = result.player1Id === user.id
                const userScore = isPlayer1 ? result.score1 : result.score2
                const opponentScore = isPlayer1 ? result.score2 : result.score1
                const opponentName = isPlayer1 ? result.player2 : result.player1
                const didWin = Number(userScore) > Number(opponentScore)

                return (
                  <div key={result.id} style={{
                    padding: '20px',
                    background: 'var(--bg-secondary)',
                    border: `1px solid ${didWin ? 'var(--success)' : 'var(--border)'}`,
                    borderRadius: '12px',
                    marginBottom: '15px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div>
                        <div style={{ fontSize: '1.1rem', marginBottom: '5px' }}>
                          You vs <strong>{opponentName}</strong>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)' }}>
                          {result.division} | {result.gameType}
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
                        COMPLETED
                      </span>
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: '15px',
                      padding: '15px',
                      background: 'var(--bg-primary)',
                      borderRadius: '8px'
                    }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px' }}>SCORE</div>
                        <div style={{ fontWeight: '700' }}>{userScore} - {opponentScore}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '3px' }}>DATE</div>
                        <div style={{ fontWeight: '600' }}>{result.date || 'N/A'}</div>
                      </div>
                    </div>
                  </div>
                )
              })
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

      {activeTab === 'cup' && (
        <div>
          {cupNeedsScheduling.length > 0 && (
            <div className="card" style={{ marginBottom: '20px', borderLeft: '4px solid var(--accent-cyan)' }}>
              <h3 style={{ color: 'var(--accent-cyan)', marginBottom: '15px' }}>Schedule Your Match ({cupNeedsScheduling.length})</h3>
              {cupNeedsScheduling.map(fixture => (
                <div key={fixture.id} style={{ 
                  padding: '15px', 
                  background: 'var(--bg-secondary)', 
                  borderRadius: '8px',
                  marginBottom: '10px'
                }}>
                  <div style={{ marginBottom: '10px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>
                      {getCupName(fixture.cupId)} - {getRoundName(fixture.round, fixture.cupId)}
                    </span>
                    <div style={{ fontSize: '1rem', marginTop: '5px' }}>
                      <strong>{getPlayerName(fixture.player1Id)}</strong>
                      <span style={{ color: 'var(--text-muted)', margin: '0 10px' }}>vs</span>
                      <strong>{getPlayerName(fixture.player2Id)}</strong>
                    </div>
                    <p style={{ margin: '5px 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      {fixture.startScore || 501} / Best of {fixture.bestOf || 3}
                    </p>
                  </div>
                  <button 
                    className="btn btn-primary" 
                    onClick={() => {
                      setSelectedCupFixture(fixture)
                      setScheduleDate('')
                      setScheduleTime('')
                    }}
                  >
                    Propose Date & Time
                  </button>
                </div>
              ))}
            </div>
          )}

          {cupAwaitingResponse.length > 0 && (
            <div className="card" style={{ marginBottom: '20px', borderLeft: '4px solid var(--warning)' }}>
              <h3 style={{ color: 'var(--warning)', marginBottom: '15px' }}>⏳ Awaiting Your Response ({cupAwaitingResponse.length})</h3>
              {cupAwaitingResponse.map(fixture => (
                <div key={fixture.id} style={{ 
                  padding: '15px', 
                  background: 'var(--bg-secondary)', 
                  borderRadius: '8px',
                  marginBottom: '10px'
                }}>
                  <div style={{ marginBottom: '10px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>
                      {getCupName(fixture.cupId)} - {getRoundName(fixture.round, fixture.cupId)}
                    </span>
                    <div style={{ fontSize: '1rem', marginTop: '5px' }}>
                      <strong>{getPlayerName(fixture.player1Id)}</strong>
                      <span style={{ color: 'var(--text-muted)', margin: '0 10px' }}>vs</span>
                      <strong>{getPlayerName(fixture.player2Id)}</strong>
                    </div>
                  </div>
                  <div style={{ padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', marginBottom: '10px' }}>
                    <p style={{ margin: '0', color: 'var(--accent-cyan)', fontSize: '0.85rem' }}>
                      Proposed: {fixture.proposedDate} {fixture.proposedTime} (by {getPlayerName(fixture.proposedBy)})
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn btn-success btn-sm" onClick={() => acceptCupProposal(fixture)}>Accept</button>
                    <button className="btn btn-danger btn-sm" onClick={() => rejectCupProposal(fixture)}>Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {cupAwaitingOpponent.length > 0 && (
            <div className="card" style={{ marginBottom: '20px' }}>
              <h3 style={{ marginBottom: '15px' }}>Your Proposals ({cupAwaitingOpponent.length})</h3>
              {cupAwaitingOpponent.map(fixture => (
                <div key={fixture.id} style={{ 
                  padding: '15px', 
                  background: 'var(--bg-secondary)', 
                  borderRadius: '8px',
                  marginBottom: '10px'
                }}>
                  <div style={{ marginBottom: '10px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>
                      {getCupName(fixture.cupId)} - {getRoundName(fixture.round, fixture.cupId)}
                    </span>
                    <div style={{ fontSize: '1rem', marginTop: '5px' }}>
                      <strong>{getPlayerName(fixture.player1Id)}</strong>
                      <span style={{ color: 'var(--text-muted)', margin: '0 10px' }}>vs</span>
                      <strong>{getPlayerName(fixture.player2Id)}</strong>
                    </div>
                  </div>
                  <p style={{ margin: '0', color: 'var(--warning)', fontSize: '0.85rem' }}>
                    Awaiting response... {fixture.proposedDate} {fixture.proposedTime}
                  </p>
                </div>
              ))}
            </div>
          )}

          {cupAccepted.length > 0 && (
            <div className="card" style={{ marginBottom: '20px', borderLeft: '4px solid var(--success)' }}>
              <h3 style={{ color: 'var(--success)', marginBottom: '15px' }}>Confirmed Fixtures</h3>
              {cupAccepted.map(fixture => (
                <div key={fixture.id} style={{ 
                  padding: '15px', 
                  background: 'var(--bg-secondary)', 
                  borderRadius: '8px',
                  marginBottom: '10px'
                }}>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>
                      {getCupName(fixture.cupId)} - {getRoundName(fixture.round, fixture.cupId)}
                    </span>
                    <div style={{ fontSize: '1rem', marginTop: '5px' }}>
                      <strong>{getPlayerName(fixture.player1Id)}</strong>
                      <span style={{ color: 'var(--text-muted)', margin: '0 10px' }}>vs</span>
                      <strong>{getPlayerName(fixture.player2Id)}</strong>
                    </div>
                    <p style={{ margin: '5px 0 0 0', fontSize: '0.85rem' }}>
                      Scheduled: {fixture.date} at {fixture.time}
                    </p>
                    <p style={{ margin: '3px 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      Format: {fixture.startScore || 501} / Best of {fixture.bestOf || 3}
                    </p>
                  </div>
                  <button
                    className="btn btn-primary"
                    style={{ marginTop: '10px' }}
                    onClick={() => navigate(`/submit-result?fixtureId=${fixture.id}`)}
                  >
                    Submit Result
                  </button>
                </div>
              ))}
            </div>
          )}

          {selectedCupFixture && (
            <div className="card" style={{ marginBottom: '20px', border: '2px solid var(--accent-cyan)' }}>
              <h3 style={{ marginBottom: '15px' }}>Propose Date & Time</h3>
              <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
                <div style={{ flex: 1 }}>
                  <label>Date</label>
                  <input 
                    type="date" 
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label>Time</label>
                  <input 
                    type="time" 
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-primary" onClick={proposeCupSchedule}>Send Proposal</button>
                <button className="btn btn-secondary" onClick={() => {
                  setSelectedCupFixture(null)
                  setScheduleDate('')
                  setScheduleTime('')
                }}>Cancel</button>
              </div>
            </div>
          )}

          {cupFixturesData.length === 0 && (
            <div className="card">
              <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
                No cup fixtures yet. Create a cup to get started!
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
