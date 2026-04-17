import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

export default function CupFixtures() {
  const { user, getAllUsers } = useAuth()
  const [fixtures, setFixtures] = useState([])
  const [selectedFixture, setSelectedFixture] = useState(null)
  const [counterDate, setCounterDate] = useState('')
  const [counterTime, setCounterTime] = useState('')
  const allUsers = getAllUsers()

  useEffect(() => {
    loadFixtures()
  }, [])

  const loadFixtures = () => {
    const allFixtures = JSON.parse(localStorage.getItem('eliteArrowsFixtures') || '[]')
    const cupFixtures = allFixtures.filter(f => f.cupId)
    setFixtures(cupFixtures)
  }

  const getPlayerName = (id) => allUsers.find(u => u.id === id)?.username || 'Unknown'

  const userFixtures = fixtures.filter(f => f.player1 === user.id || f.player2 === user.id)
  const pendingReceived = userFixtures.filter(f => {
    if (f.scheduledBy === user.id) return false
    return f.status === 'pending' || f.status === 'countered'
  })
  const pendingSent = userFixtures.filter(f => f.scheduledBy === user.id && f.status === 'pending')
  const acceptedFixtures = userFixtures.filter(f => f.status === 'accepted')

  const acceptFixture = (fixture) => {
    const allFixtures = JSON.parse(localStorage.getItem('eliteArrowsFixtures') || '[]')
    const index = allFixtures.findIndex(f => f.id === fixture.id)
    if (index !== -1) {
      allFixtures[index].status = 'accepted'
      allFixtures[index].date = fixture.proposedDate || new Date().toISOString().split('T')[0]
      allFixtures[index].time = fixture.proposedTime || '19:00'
      localStorage.setItem('eliteArrowsFixtures', JSON.stringify(allFixtures))
      loadFixtures()
      setSelectedFixture(null)
      alert('Fixture accepted!')
    }
  }

  const rejectFixture = (fixture) => {
    if (!confirm('Are you sure you want to reject this fixture?')) return
    const allFixtures = JSON.parse(localStorage.getItem('eliteArrowsFixtures') || '[]')
    const index = allFixtures.findIndex(f => f.id === fixture.id)
    if (index !== -1) {
      allFixtures.splice(index, 1)
      localStorage.setItem('eliteArrowsFixtures', JSON.stringify(allFixtures))
      loadFixtures()
      setSelectedFixture(null)
      alert('Fixture rejected.')
    }
  }

  const counterFixture = () => {
    if (!counterDate || !counterTime) {
      alert('Please select a date and time for your counter proposal')
      return
    }
    const allFixtures = JSON.parse(localStorage.getItem('eliteArrowsFixtures') || '[]')
    const index = allFixtures.findIndex(f => f.id === selectedFixture.id)
    if (index !== -1) {
      allFixtures[index].status = 'countered'
      allFixtures[index].counterDate = counterDate
      allFixtures[index].counterTime = counterTime
      localStorage.setItem('eliteArrowsFixtures', JSON.stringify(allFixtures))
      loadFixtures()
      setSelectedFixture(null)
      setCounterDate('')
      setCounterTime('')
      alert('Counter proposal sent!')
    }
  }

  const submitResult = (fixture) => {
    const score1 = prompt('Enter your score (legs won):')
    const score2 = prompt('Enter opponent\'s score (legs won):')
    if (!score1 || !score2) return

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
      matchId: fixture.matchId
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

      {pendingReceived.length > 0 && (
        <div className="card" style={{ marginBottom: '20px', borderLeft: '4px solid var(--warning)' }}>
          <h3 style={{ color: 'var(--warning)', marginBottom: '15px' }}>⏳ Fixture Requests ({pendingReceived.length})</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '15px' }}>
            Someone wants to schedule a match with you
          </p>
          {pendingReceived.map(fixture => (
            <div key={fixture.id} style={{ 
              padding: '15px', 
              background: 'var(--bg-secondary)', 
              borderRadius: '8px',
              marginBottom: '10px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>{getPlayerName(fixture.player1)}</strong>
                  <span style={{ color: 'var(--text-muted)' }}> vs </span>
                  <strong>{getPlayerName(fixture.player2)}</strong>
                  <p style={{ margin: '5px 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    Proposed: {fixture.proposedDate || 'Not set'} {fixture.proposedTime || ''}
                  </p>
                  {fixture.status === 'countered' && fixture.counterDate && (
                    <p style={{ margin: '5px 0 0 0', color: 'var(--accent-cyan)', fontSize: '0.85rem' }}>
                      Counter: {fixture.counterDate} {fixture.counterTime}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn btn-success btn-sm" onClick={() => acceptFixture(fixture)}>
                    Accept
                  </button>
                  <button className="btn btn-warning btn-sm" onClick={() => setSelectedFixture(fixture)}>
                    Counter
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => rejectFixture(fixture)}>
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedFixture && (
        <div className="card" style={{ marginBottom: '20px', border: '2px solid var(--accent-cyan)' }}>
          <h3 style={{ marginBottom: '15px' }}>Counter Proposal</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '15px' }}>
            Propose a new date/time for your match
          </p>
          <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
            <div style={{ flex: 1 }}>
              <label>Date</label>
              <input 
                type="date" 
                value={counterDate} 
                onChange={(e) => setCounterDate(e.target.value)}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label>Time</label>
              <input 
                type="time" 
                value={counterTime} 
                onChange={(e) => setCounterTime(e.target.value)}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-primary" onClick={counterFixture}>Send Counter</button>
            <button className="btn btn-secondary" onClick={() => setSelectedFixture(null)}>Cancel</button>
          </div>
        </div>
      )}

      {pendingSent.length > 0 && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <h3 style={{ marginBottom: '15px' }}>Your Sent Requests</h3>
          {pendingSent.map(fixture => (
            <div key={fixture.id} style={{ 
              padding: '15px', 
              background: 'var(--bg-secondary)', 
              borderRadius: '8px',
              marginBottom: '10px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <strong>{getPlayerName(fixture.player1)}</strong>
                <span style={{ color: 'var(--text-muted)' }}> vs </span>
                <strong>{getPlayerName(fixture.player2)}</strong>
                <p style={{ margin: '5px 0 0 0', color: 'var(--warning)', fontSize: '0.85rem' }}>
                  Awaiting response...
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {acceptedFixtures.length > 0 && (
        <div className="card" style={{ marginBottom: '20px', borderLeft: '4px solid var(--success)' }}>
          <h3 style={{ color: 'var(--success)', marginBottom: '15px' }}>Accepted Fixtures - Submit Result</h3>
          {acceptedFixtures.map(fixture => (
            <div key={fixture.id} style={{ 
              padding: '15px', 
              background: 'var(--bg-secondary)', 
              borderRadius: '8px',
              marginBottom: '10px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>{getPlayerName(fixture.player1)}</strong>
                  <span style={{ color: 'var(--text-muted)' }}> vs </span>
                  <strong>{getPlayerName(fixture.player2)}</strong>
                  <p style={{ margin: '5px 0 0 0', color: 'var(--success)', fontSize: '0.85rem' }}>
                    Scheduled: {fixture.date} {fixture.time}
                  </p>
                </div>
                <button className="btn btn-primary" onClick={() => submitResult(fixture)}>
                  Submit Result
                </button>
              </div>
            </div>
          ))}
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
