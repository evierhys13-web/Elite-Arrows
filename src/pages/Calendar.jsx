import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Calendar() {
  const { user, getFixtures, getCups, dataRefreshTrigger } = useAuth()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(null)
  const [fixtures, setFixtures] = useState([])

  useEffect(() => {
    const allFixtures = getFixtures()
    const userFixtures = allFixtures.filter(f =>
      f.player1 === user.id || f.player2 === user.id
    )
    setFixtures(userFixtures)
  }, [dataRefreshTrigger])

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date()

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))

  const getFixturesForDay = (day) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return fixtures.filter(f => f.fixtureDate === dateStr || (f.date && f.date.startsWith(dateStr)))
  }

  const getFixtureType = (fixture) => {
    if (fixture.gameType === 'League') return 'league'
    if (fixture.gameType === 'Cup' || fixture.cupId) return 'cup'
    return 'tournament'
  }

  const getOpponentName = (fixture) => {
    const opponentId = fixture.player1 === user.id ? fixture.player2 : fixture.player1
    const allUsers = JSON.parse(localStorage.getItem('eliteArrowsUsers') || '[]')
    return allUsers.find(u => u.id === opponentId)?.username || 'Unknown'
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'accepted': return 'var(--success)'
      case 'pending': return 'var(--warning)'
      case 'proposed': return 'var(--accent-cyan)'
      case 'completed': return 'var(--text-muted)'
      default: return 'var(--text-muted)'
    }
  }

  const cells = []
  for (let i = 0; i < firstDay; i++) {
    cells.push(<div key={`empty-${i}`} style={{ minHeight: '80px' }} />)
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dayFixtures = getFixturesForDay(day)
    const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
    const isPast = new Date(year, month, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate())

    cells.push(
      <div
        key={day}
        onClick={() => dayFixtures.length > 0 && setSelectedDay(selectedDay === day ? null : day)}
        style={{
          minHeight: '80px',
          padding: '6px',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          cursor: dayFixtures.length > 0 ? 'pointer' : 'default',
          background: isToday ? 'rgba(124, 92, 252, 0.1)' : isPast ? 'rgba(0,0,0,0.15)' : 'transparent',
          transition: 'all 0.2s ease'
        }}
      >
        <div style={{
          fontSize: '0.85rem',
          fontWeight: isToday ? '700' : '500',
          color: isToday ? 'var(--accent-primary)' : isPast ? 'var(--text-muted)' : 'var(--text-primary)',
          marginBottom: '4px'
        }}>
          {day}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {dayFixtures.slice(0, 3).map((f, i) => (
            <div
              key={i}
              style={{
                fontSize: '0.65rem',
                padding: '2px 4px',
                borderRadius: '3px',
                background: getFixtureType(f) === 'league' ? 'rgba(0, 212, 255, 0.2)' :
                  getFixtureType(f) === 'cup' ? 'rgba(124, 92, 252, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                color: getFixtureType(f) === 'league' ? '#00d4ff' :
                  getFixtureType(f) === 'cup' ? '#a78bfa' : '#f59e0b',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              vs {getOpponentName(f)}
            </div>
          ))}
          {dayFixtures.length > 3 && (
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>+{dayFixtures.length - 3} more</div>
          )}
        </div>
      </div>
    )
  }

  const selectedDayFixtures = selectedDay ? getFixturesForDay(selectedDay) : []

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">My Fixtures</h1>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <button className="btn btn-secondary" onClick={prevMonth} style={{ padding: '8px 16px' }}>← Prev</button>
          <h2 style={{ fontSize: '1.2rem', fontWeight: '600' }}>{monthNames[month]} {year}</h2>
          <button className="btn btn-secondary" onClick={nextMonth} style={{ padding: '8px 16px' }}>Next →</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '8px' }}>
          {dayNames.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)', padding: '8px 0' }}>
              {d}
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
          {cells}
        </div>

        <div style={{ display: 'flex', gap: '16px', marginTop: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(0, 212, 255, 0.3)' }} />
            League
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(124, 92, 252, 0.3)' }} />
            Cup
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(245, 158, 11, 0.3)' }} />
            Tournament
          </div>
        </div>
      </div>

      {selectedDay && selectedDayFixtures.length > 0 && (
        <div className="card" style={{ marginTop: '20px' }}>
          <h3 className="card-title">
            {monthNames[month]} {selectedDay}, {year} - Fixtures ({selectedDayFixtures.length})
          </h3>
          {selectedDayFixtures.map((fixture, i) => (
            <div key={i} className="result-item" style={{ marginBottom: '12px' }}>
              <div>
                <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                  vs {getOpponentName(fixture)}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {fixture.gameType || 'Cup'} · {fixture.startScore || 501} · Best of {fixture.bestOf || 3}
                </div>
                <div style={{ fontSize: '0.8rem', color: getStatusColor(fixture.status), marginTop: '4px' }}>
                  Status: {fixture.status || 'pending'}
                </div>
                {fixture.fixtureTime && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Time: {fixture.fixtureTime}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
