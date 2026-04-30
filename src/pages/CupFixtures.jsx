import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { db, doc, setDoc } from '../firebase'

export default function CupFixtures() {
  const { user, getAllUsers, getFixtures, getCups, updateFixtures, triggerDataRefresh, dataRefreshTrigger, notifyUser, notifyAdmins } = useAuth()
  const navigate = useNavigate()
  const [fixtures, setFixtures] = useState([])
  const [selectedFixture, setSelectedFixture] = useState(null)
  const [scheduleMode, setScheduleMode] = useState('propose')
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const allUsers = getAllUsers()

  useEffect(() => {
    const allFixtures = getFixtures()
    const cupFixtures = allFixtures.filter(f => f.cupId)
    setFixtures(cupFixtures)
  }, [refreshKey, dataRefreshTrigger])

  const getPlayerName = (id) => allUsers.find(u => u.id === id)?.username || 'Unknown'

  const getRoundName = (round, totalRounds) => {
    if (round === totalRounds) return 'Final'
    if (round === totalRounds - 1) return 'Semi-Final'
    if (round === totalRounds - 2) return 'Quarter-Final'
    return `Round ${round}`
  }

  const getCupName = (cupId) => {
    const cups = getCups()
    return cups.find(c => c.id === cupId)?.name || 'Unknown Cup'
  }

  const getTotalRounds = (cupId) => {
    const cups = getCups()
    const cup = cups.find(c => c.id === cupId)
    return cup ? Math.max(...(cup.matches?.map(m => m.round) || [1])) : 1
  }

  const userFixtures = fixtures.filter(f => f.player1 === user.id || f.player2 === user.id || f.player1Id === user.id || f.player2Id === user.id)
  
  console.log('User fixtures:', userFixtures)
  
  const needsScheduling = userFixtures.filter(f => 
    f.status === 'pending' && !f.proposedDate
  )
  
  const awaitingYourResponse = userFixtures.filter(f => {
    if (f.status === 'pending' && f.proposedDate && f.proposedBy !== user.id) return true
    if (f.status === 'countered' && f.counterBy !== user.id) return true
    return false
  })
  
  const awaitingOpponentResponse = userFixtures.filter(f => {
    if (f.status === 'pending' && f.proposedBy === user.id && !f.counterDate) return true
    if (f.status === 'countered' && f.counterBy === user.id) return true
    return false
  })
  
  const acceptedFixtures = userFixtures.filter(f => f.status === 'accepted')

  const saveFixtures = (updatedFixtures) => {
    updateFixtures(updatedFixtures)
    localStorage.setItem('eliteArrowsFixtures', JSON.stringify(updatedFixtures))
  }

  const getFixturePlayerIds = (fixture) => ({
    player1Id: fixture.player1Id || fixture.player1,
    player2Id: fixture.player2Id || fixture.player2
  })

  const getOpponentId = (fixture) => {
    const { player1Id, player2Id } = getFixturePlayerIds(fixture)
    return player1Id === user.id ? player2Id : player1Id
  }

  const getActiveProposalDate = (fixture) => (
    fixture.status === 'countered' && fixture.counterDate
      ? fixture.counterDate
      : fixture.proposedDate
  )

  const getActiveProposalTime = (fixture) => (
    fixture.status === 'countered' && fixture.counterTime
      ? fixture.counterTime
      : fixture.proposedTime
  )

  const sendFixtureActivityToAdmins = async (action, fixture, details = {}) => {
    await notifyAdmins(
      'Fixture Activity',
      `${user.username} ${action} a cup fixture ${getPlayerName(fixture.player1Id || fixture.player1)} vs ${getPlayerName(fixture.player2Id || fixture.player2)}.`,
      {
        type: 'fixture_activity',
        adminLog: true,
        fixtureKind: 'cup',
        action,
        fixtureId: fixture.id,
        ...details
      }
    )
  }

  const proposeSchedule = async () => {
    if (!scheduleDate || !scheduleTime) {
      alert('Please select a date and time')
      return
    }
    const allFixtures = getFixtures()
    const index = allFixtures.findIndex(f => f.id === selectedFixture.id)
    if (index !== -1) {
      const isCounter = scheduleMode === 'counter'
      allFixtures[index] = {
        ...allFixtures[index],
        status: isCounter ? 'countered' : 'pending',
        proposalStatus: isCounter ? 'countered' : 'sent',
        ...(isCounter ? {
          counterDate: scheduleDate,
          counterTime: scheduleTime,
          counterBy: user.id,
          counteredAt: new Date().toISOString()
        } : {
          proposedDate: scheduleDate,
          proposedTime: scheduleTime,
          proposedBy: user.id,
          counterDate: '',
          counterTime: '',
          counterBy: null,
          counteredAt: null
        }),
        updatedAt: new Date().toISOString()
      }
      saveFixtures(allFixtures)
      
      try {
        await setDoc(doc(db, 'fixtures', allFixtures[index].id.toString()), allFixtures[index], { merge: true })
        await notifyUser(
          getOpponentId(allFixtures[index]),
          isCounter ? 'Cup Fixture Counter Proposal' : 'Cup Fixture Proposal',
          `${user.username} ${isCounter ? 'countered with' : 'proposed'} ${scheduleDate} at ${scheduleTime} for your cup fixture.`,
          isCounter ? 'fixture_countered' : 'fixture_proposed',
          { fixtureKind: 'cup', fixtureId: allFixtures[index].id }
        )
        await notifyUser(
          user.id,
          isCounter ? 'Counter Proposal Sent' : 'Cup Fixture Proposal Sent',
          `You ${isCounter ? 'countered with' : 'proposed'} ${scheduleDate} at ${scheduleTime} for the cup fixture.`,
          isCounter ? 'fixture_countered' : 'fixture_proposed',
          { fixtureKind: 'cup', fixtureId: allFixtures[index].id }
        )
        await sendFixtureActivityToAdmins(isCounter ? 'countered' : 'proposed', allFixtures[index], { proposedDate: scheduleDate, proposedTime: scheduleTime })
      } catch (e) {
        console.log('Error saving to Firebase:', e)
      }
      
      triggerDataRefresh('fixtures')
      setRefreshKey(prev => prev + 1)
      setSelectedFixture(null)
      setScheduleMode('propose')
      setScheduleDate('')
      setScheduleTime('')
      alert(scheduleMode === 'counter' ? 'Counter proposal sent!' : 'Schedule proposal sent!')
    }
  }

  const acceptProposal = async (fixture) => {
    const allFixtures = getFixtures()
    const index = allFixtures.findIndex(f => f.id === fixture.id)
    if (index !== -1) {
      const acceptedDate = getActiveProposalDate(fixture)
      const acceptedTime = getActiveProposalTime(fixture)
      allFixtures[index].status = 'accepted'
      allFixtures[index].proposalStatus = 'accepted'
      allFixtures[index].date = acceptedDate
      allFixtures[index].time = acceptedTime
      allFixtures[index].fixtureDate = acceptedDate
      allFixtures[index].fixtureTime = acceptedTime
      allFixtures[index].updatedAt = new Date().toISOString()
      saveFixtures(allFixtures)
      
      try {
        await setDoc(doc(db, 'fixtures', allFixtures[index].id.toString()), allFixtures[index], { merge: true })
        await notifyUser(
          getOpponentId(allFixtures[index]),
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
      
      triggerDataRefresh('fixtures')
      setRefreshKey(prev => prev + 1)
      alert('Fixture accepted!')
    }
  }

  const counterProposal = (fixture) => {
    setSelectedFixture(fixture)
    setScheduleMode('counter')
    setScheduleDate(getActiveProposalDate(fixture) || '')
    setScheduleTime(getActiveProposalTime(fixture) || '')
  }

  const rejectProposal = async (fixture) => {
    if (!confirm('Are you sure you want to reject this fixture?')) return
    const allFixtures = getFixtures()
    const index = allFixtures.findIndex(f => f.id === fixture.id)
    if (index === -1) {
      alert('Could not find that fixture. Please refresh and try again.')
      return
    }
    allFixtures[index] = {
      ...allFixtures[index],
      status: 'pending',
      proposalStatus: 'needs_scheduling',
      proposedDate: '',
      proposedTime: '',
      proposedBy: null,
      counterDate: '',
      counterTime: '',
      counterBy: null,
      counteredAt: null,
      date: '',
      time: '',
      fixtureDate: '',
      fixtureTime: '',
      updatedAt: new Date().toISOString()
    }
    saveFixtures(allFixtures)
    
    try {
      await setDoc(doc(db, 'fixtures', fixture.id.toString()), allFixtures[index], { merge: true })
      await notifyUser(
        getOpponentId(fixture),
        'Cup Fixture Rejected',
        `${user.username} rejected your cup fixture proposal. The match is back in cup fixtures for a new date and time.`,
        'fixture_declined',
        { fixtureKind: 'cup', fixtureId: fixture.id }
      )
      await notifyUser(
        user.id,
        'Cup Fixture Rejected',
        `You rejected the cup fixture proposal. It is back in cup fixtures for a new proposal.`,
        'fixture_declined',
        { fixtureKind: 'cup', fixtureId: fixture.id }
      )
      await sendFixtureActivityToAdmins('declined', fixture)
    } catch (e) {
      console.log('Error saving to Firebase:', e)
    }
    
    triggerDataRefresh('fixtures')
    setRefreshKey(prev => prev + 1)
    alert('Fixture rejected. It is back in cup fixtures for a new proposal.')
  }

  const cancelProposal = async (fixture) => {
    if (!confirm('Cancel this fixture?')) return
    const allFixtures = getFixtures()
    const index = allFixtures.findIndex(f => f.id === fixture.id)
    if (index === -1) {
      alert('Could not find that fixture. Please refresh and try again.')
      return
    }
    allFixtures[index] = {
      ...allFixtures[index],
      status: 'pending',
      proposalStatus: 'needs_scheduling',
      proposedDate: '',
      proposedTime: '',
      proposedBy: null,
      counterDate: '',
      counterTime: '',
      counterBy: null,
      counteredAt: null,
      date: '',
      time: '',
      fixtureDate: '',
      fixtureTime: '',
      updatedAt: new Date().toISOString()
    }
    saveFixtures(allFixtures)
    
    try {
      await setDoc(doc(db, 'fixtures', fixture.id.toString()), allFixtures[index], { merge: true })
      await notifyUser(
        getOpponentId(fixture),
        'Cup Fixture Cancelled',
        `${user.username} cancelled their cup fixture proposal. The match is back in cup fixtures for a new date and time.`,
        'fixture_cancelled',
        { fixtureKind: 'cup', fixtureId: fixture.id }
      )
      await sendFixtureActivityToAdmins('cancelled', fixture)
    } catch (e) {
      console.log('Error deleting from Firebase:', e)
    }
    
    triggerDataRefresh('fixtures')
    setRefreshKey(prev => prev + 1)
    alert('Proposal cancelled. The match is back in cup fixtures for a new proposal.')
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Cup Fixtures</h1>
      </div>

      {needsScheduling.length > 0 && (
        <div className="card" style={{ marginBottom: '20px', borderLeft: '4px solid var(--accent-cyan)' }}>
          <h3 style={{ color: 'var(--accent-cyan)', marginBottom: '15px' }}>Schedule Your Match ({needsScheduling.length})</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '15px' }}>
            Propose a date and time for your cup match
          </p>
          {needsScheduling.map(fixture => (
            <div key={fixture.id} style={{ 
              padding: '15px', 
              background: 'var(--bg-secondary)', 
              borderRadius: '8px',
              marginBottom: '10px'
            }}>
              <div style={{ marginBottom: '10px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>
                  {getCupName(fixture.cupId)} - {getRoundName(fixture.round, getTotalRounds(fixture.cupId))}
                </span>
                <div style={{ fontSize: '1rem', marginTop: '5px' }}>
                  <strong>{getPlayerName(fixture.player1)}</strong>
                  <span style={{ color: 'var(--text-muted)', margin: '0 10px' }}>vs</span>
                  <strong>{getPlayerName(fixture.player2)}</strong>
                </div>
                <p style={{ margin: '5px 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {fixture.startScore || 501} / Best of {fixture.bestOf || 3}
                </p>
              </div>
              <button 
                className="btn btn-primary" 
                onClick={() => {
                  setSelectedFixture(fixture)
                  setScheduleMode('propose')
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

      {awaitingYourResponse.length > 0 && (
        <div className="card" style={{ marginBottom: '20px', borderLeft: '4px solid var(--warning)' }}>
          <h3 style={{ color: 'var(--warning)', marginBottom: '15px' }}>⏳ Awaiting Your Response ({awaitingYourResponse.length})</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '15px' }}>
            Someone proposed a time - accept, counter, or reject
          </p>
          {awaitingYourResponse.map(fixture => (
            <div key={fixture.id} style={{ 
              padding: '15px', 
              background: 'var(--bg-secondary)', 
              borderRadius: '8px',
              marginBottom: '10px'
            }}>
              <div style={{ marginBottom: '10px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>
                  {getCupName(fixture.cupId)} - {getRoundName(fixture.round, getTotalRounds(fixture.cupId))}
                </span>
                <div style={{ fontSize: '1rem', marginTop: '5px' }}>
                  <strong>{getPlayerName(fixture.player1)}</strong>
                  <span style={{ color: 'var(--text-muted)', margin: '0 10px' }}>vs</span>
                  <strong>{getPlayerName(fixture.player2)}</strong>
                </div>
                <p style={{ margin: '5px 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {fixture.startScore || 501} / Best of {fixture.bestOf || 3}
                </p>
              </div>
              <div style={{ 
                padding: '10px', 
                background: 'rgba(255,255,255,0.05)', 
                borderRadius: '6px',
                marginBottom: '10px'
              }}>
                {fixture.status === 'countered' ? (
                  <>
                    <p style={{ margin: '0', color: 'var(--accent-cyan)', fontSize: '0.85rem' }}>
                      <strong>Proposed:</strong> {fixture.proposedDate} {fixture.proposedTime} (by {getPlayerName(fixture.proposedBy)})
                    </p>
                    <p style={{ margin: '5px 0 0 0', color: 'var(--warning)', fontSize: '0.85rem' }}>
                      <strong>Counter:</strong> {fixture.counterDate} {fixture.counterTime} (by {getPlayerName(fixture.counterBy)})
                    </p>
                  </>
                ) : (
                  <p style={{ margin: '0', color: 'var(--accent-cyan)', fontSize: '0.85rem' }}>
                    <strong>Proposed:</strong> {fixture.proposedDate} {fixture.proposedTime} (by {getPlayerName(fixture.proposedBy)})
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button className="btn btn-success btn-sm" onClick={() => acceptProposal(fixture)}>
                  Accept
                </button>
                <button className="btn btn-warning btn-sm" onClick={() => counterProposal(fixture)}>
                  Counter
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => rejectProposal(fixture)}>
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {awaitingOpponentResponse.length > 0 && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <h3 style={{ marginBottom: '15px' }}>Your Proposals ({awaitingOpponentResponse.length})</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '15px' }}>
            Waiting for opponent to respond
          </p>
          {awaitingOpponentResponse.map(fixture => (
            <div key={fixture.id} style={{ 
              padding: '15px', 
              background: 'var(--bg-secondary)', 
              borderRadius: '8px',
              marginBottom: '10px'
            }}>
              <div style={{ marginBottom: '10px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>
                  {getCupName(fixture.cupId)} - {getRoundName(fixture.round, getTotalRounds(fixture.cupId))}
                </span>
                <div style={{ fontSize: '1rem', marginTop: '5px' }}>
                  <strong>{getPlayerName(fixture.player1)}</strong>
                  <span style={{ color: 'var(--text-muted)', margin: '0 10px' }}>vs</span>
                  <strong>{getPlayerName(fixture.player2)}</strong>
                </div>
              </div>
              <div style={{ 
                padding: '10px', 
                background: 'rgba(255,255,255,0.05)', 
                borderRadius: '6px',
                marginBottom: '10px'
              }}>
                {fixture.status === 'countered' ? (
                  <>
                    <p style={{ margin: '0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      <strong>Your proposal:</strong> {fixture.counterDate} {fixture.counterTime}
                    </p>
                    <p style={{ margin: '5px 0 0 0', color: 'var(--warning)', fontSize: '0.85rem' }}>
                      <strong>Opponent countered:</strong> {fixture.proposedDate} {fixture.proposedTime}
                    </p>
                  </>
                ) : (
                  <p style={{ margin: '0', color: 'var(--warning)', fontSize: '0.85rem' }}>
                    <strong>Awaiting response...</strong> {fixture.proposedDate} {fixture.proposedTime}
                  </p>
                )}
              </div>
              <button className="btn btn-danger btn-sm" onClick={() => cancelProposal(fixture)}>
                Cancel Proposal
              </button>
            </div>
          ))}
        </div>
      )}

      {acceptedFixtures.length > 0 && (
        <div className="card" style={{ marginBottom: '20px', borderLeft: '4px solid var(--success)' }}>
          <h3 style={{ color: 'var(--success)', marginBottom: '15px' }}>Confirmed Fixtures</h3>
          {acceptedFixtures.map(fixture => (
            <div key={fixture.id} style={{ 
              padding: '15px', 
              background: 'var(--bg-secondary)', 
              borderRadius: '8px',
              marginBottom: '10px'
            }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>
                  {getCupName(fixture.cupId)} - {getRoundName(fixture.round, getTotalRounds(fixture.cupId))}
                </span>
                <div style={{ fontSize: '1rem', marginTop: '5px' }}>
                  <strong>{getPlayerName(fixture.player1)}</strong>
                  <span style={{ color: 'var(--text-muted)', margin: '0 10px' }}>vs</span>
                  <strong>{getPlayerName(fixture.player2)}</strong>
                </div>
                <p style={{ margin: '5px 0 0 0', fontSize: '0.85rem' }}>
                  <strong>Scheduled:</strong> {fixture.date} at {fixture.time}
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

      {selectedFixture && (
        <div className="card" style={{ marginBottom: '20px', border: '2px solid var(--accent-cyan)' }}>
          <h3 style={{ marginBottom: '15px' }}>
            {scheduleMode === 'counter' ? 'Counter Date & Time' : 'Propose Date & Time'}
          </h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '15px' }}>
            Proposing a match time against {getPlayerName(selectedFixture.player1 === user.id ? selectedFixture.player2 : selectedFixture.player1)}
          </p>
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
            <button className="btn btn-primary" onClick={proposeSchedule}>
              {scheduleMode === 'counter' ? 'Send Counter' : 'Send Proposal'}
            </button>
            <button className="btn btn-secondary" onClick={() => {
              setSelectedFixture(null)
              setScheduleMode('propose')
              setScheduleDate('')
              setScheduleTime('')
            }}>Cancel</button>
          </div>
        </div>
      )}

      {userFixtures.length === 0 && (
        <div className="card">
          <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
            No cup fixtures yet. Create a cup to get started!
          </p>
        </div>
      )}
    </div>
  )
}
