import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

export default function CupFixtures() {
  const { user, getAllUsers } = useAuth()
  const [fixtures, setFixtures] = useState([])
  const [selectedFixture, setSelectedFixture] = useState(null)
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const allUsers = getAllUsers()

  useEffect(() => {
    loadFixtures()
  }, [])

  const loadFixtures = () => {
    const allFixtures = JSON.parse(localStorage.getItem('eliteArrowsFixtures') || '[]')
    const cupFixtures = allFixtures.filter(f => f.cupId)
    console.log('All fixtures:', allFixtures)
    console.log('Cup fixtures:', cupFixtures)
    console.log('Current user id:', user.id)
    setFixtures(cupFixtures)
  }

  const getPlayerName = (id) => allUsers.find(u => u.id === id)?.username || 'Unknown'

  const getRoundName = (round, totalRounds) => {
    if (round === totalRounds) return 'Final'
    if (round === totalRounds - 1) return 'Semi-Final'
    if (round === totalRounds - 2) return 'Quarter-Final'
    return `Round ${round}`
  }

  const getCupName = (cupId) => {
    const cups = JSON.parse(localStorage.getItem('eliteArrowsCups') || '[]')
    return cups.find(c => c.id === cupId)?.name || 'Unknown Cup'
  }

  const getTotalRounds = (cupId) => {
    const cups = JSON.parse(localStorage.getItem('eliteArrowsCups') || '[]')
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

  const proposeSchedule = () => {
    if (!scheduleDate || !scheduleTime) {
      alert('Please select a date and time')
      return
    }
    const allFixtures = JSON.parse(localStorage.getItem('eliteArrowsFixtures') || '[]')
    const index = allFixtures.findIndex(f => f.id === selectedFixture.id)
    if (index !== -1) {
      allFixtures[index].proposedDate = scheduleDate
      allFixtures[index].proposedTime = scheduleTime
      allFixtures[index].proposedBy = user.id
      localStorage.setItem('eliteArrowsFixtures', JSON.stringify(allFixtures))
      loadFixtures()
      setSelectedFixture(null)
      setScheduleDate('')
      setScheduleTime('')
      alert('Schedule proposal sent!')
    }
  }

  const acceptProposal = (fixture) => {
    const allFixtures = JSON.parse(localStorage.getItem('eliteArrowsFixtures') || '[]')
    const index = allFixtures.findIndex(f => f.id === fixture.id)
    if (index !== -1) {
      allFixtures[index].status = 'accepted'
      allFixtures[index].date = fixture.proposedDate
      allFixtures[index].time = fixture.proposedTime
      localStorage.setItem('eliteArrowsFixtures', JSON.stringify(allFixtures))
      loadFixtures()
      alert('Fixture accepted!')
    }
  }

  const counterProposal = (fixture) => {
    setSelectedFixture(fixture)
    setScheduleDate('')
    setScheduleTime('')
  }

  const sendCounter = () => {
    if (!scheduleDate || !scheduleTime) {
      alert('Please select a date and time for your counter proposal')
      return
    }
    const allFixtures = JSON.parse(localStorage.getItem('eliteArrowsFixtures') || '[]')
    const index = allFixtures.findIndex(f => f.id === selectedFixture.id)
    if (index !== -1) {
      allFixtures[index].status = 'countered'
      allFixtures[index].counterDate = scheduleDate
      allFixtures[index].counterTime = scheduleTime
      allFixtures[index].counterBy = user.id
      localStorage.setItem('eliteArrowsFixtures', JSON.stringify(allFixtures))
      loadFixtures()
      setSelectedFixture(null)
      setScheduleDate('')
      setScheduleTime('')
      alert('Counter proposal sent!')
    }
  }

  const rejectProposal = (fixture) => {
    if (!confirm('Are you sure you want to reject this fixture?')) return
    const allFixtures = JSON.parse(localStorage.getItem('eliteArrowsFixtures') || '[]')
    const updatedFixtures = allFixtures.filter(f => f.id !== fixture.id)
    localStorage.setItem('eliteArrowsFixtures', JSON.stringify(updatedFixtures))
    loadFixtures()
    alert('Fixture rejected.')
  }

  const cancelProposal = (fixture) => {
    if (!confirm('Cancel this fixture?')) return
    const allFixtures = JSON.parse(localStorage.getItem('eliteArrowsFixtures') || '[]')
    const updatedFixtures = allFixtures.filter(f => f.id !== fixture.id)
    localStorage.setItem('eliteArrowsFixtures', JSON.stringify(updatedFixtures))
    loadFixtures()
    alert('Fixture cancelled.')
  }

  const submitResult = (fixture) => {
    const score1 = prompt('Enter your score (legs won):')
    if (score1 === null) return
    const score2 = prompt('Enter opponent\'s score (legs won):')
    if (score2 === null) return

    const results = JSON.parse(localStorage.getItem('eliteArrowsResults') || '[]')
    const newResult = {
      id: Date.now(),
      player1: getPlayerName(fixture.player1),
      player1Id: fixture.player1,
      player2: getPlayerName(fixture.player2),
      player2Id: fixture.player2,
      score1: parseInt(score1),
      score2: parseInt(score2),
      division: user.division,
      gameType: 'Cup',
      season: new Date().getFullYear().toString(),
      date: new Date().toISOString().split('T')[0],
      status: 'pending',
      cupId: fixture.cupId,
      matchId: fixture.matchId,
      startScore: fixture.startScore,
      bestOf: fixture.bestOf
    }
    
    results.push(newResult)
    localStorage.setItem('eliteArrowsResults', JSON.stringify(results))
    
    const allFixtures = JSON.parse(localStorage.getItem('eliteArrowsFixtures') || '[]')
    const index = allFixtures.findIndex(f => f.id === fixture.id)
    if (index !== -1) {
      allFixtures[index].status = 'result_submitted'
      localStorage.setItem('eliteArrowsFixtures', JSON.stringify(allFixtures))
    }
    
    loadFixtures()
    alert('Result submitted for approval!')
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
                onClick={() => submitResult(fixture)}
              >
                Submit Result
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedFixture && (
        <div className="card" style={{ marginBottom: '20px', border: '2px solid var(--accent-cyan)' }}>
          <h3 style={{ marginBottom: '15px' }}>Propose Date & Time</h3>
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
            <button className="btn btn-primary" onClick={proposeSchedule}>Send Proposal</button>
            <button className="btn btn-secondary" onClick={() => {
              setSelectedFixture(null)
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
