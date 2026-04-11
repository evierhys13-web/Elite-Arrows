import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Home() {
  const { user, getAllUsers } = useAuth()
  const [seasonInfo, setSeasonInfo] = useState(() => {
    const seasons = JSON.parse(localStorage.getItem('eliteArrowsSeasons') || '[]')
    const currentSeasonName = localStorage.getItem('eliteArrowsCurrentSeason')
    const currentSeason = seasons.find(s => s.name === currentSeasonName)
    if (currentSeason) {
      return currentSeason
    }
    return { name: 'Season 1', startDate: '2025-05-01', endDate: '2025-06-01' }
  })
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })

  useEffect(() => {
    const calculateTimeLeft = () => {
      const end = new Date(seasonInfo.endDate)
      const now = new Date()
      const diff = end - now
      
      if (diff > 0) {
        setTimeLeft({
          days: Math.floor(diff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((diff / (1000 * 60)) % 60),
          seconds: Math.floor((diff / 1000) % 60)
        })
      }
    }
    
    calculateTimeLeft()
    const timer = setInterval(calculateTimeLeft, 1000)
    return () => clearInterval(timer)
  }, [seasonInfo.endDate])

  const allUsers = getAllUsers()
  const results = JSON.parse(localStorage.getItem('eliteArrowsResults') || '[]')
  const approvedResults = results.filter(r => r.status === 'approved')
  const userResults = approvedResults.filter(r => r.player1Id === user.id || r.player2Id === user.id)
  const tournaments = JSON.parse(localStorage.getItem('eliteArrowsTournaments') || '[]')
  
  const stats = userResults.reduce((acc, r) => {
    acc.played++
    const isPlayer1 = r.player1Id === user.id
    if (isPlayer1) {
      if (r.score1 > r.score2) acc.wins++
      else if (r.score1 < r.score2) acc.losses++
      else acc.draws++
    } else {
      if (r.score2 > r.score1) acc.wins++
      else if (r.score2 < r.score1) acc.losses++
      else acc.draws++
    }
    acc.points += (isPlayer1 ? (r.score1 > r.score2 ? 3 : r.score1 === r.score2 ? 1 : 0) : (r.score2 > r.score1 ? 3 : r.score2 === r.score1 ? 1 : 0))
    return acc
  }, { played: 0, wins: 0, losses: 0, draws: 0, points: 0 })

  return (
    <div className="page">
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <img src="/logo.jpg" alt="Elite Arrows" style={{ width: '80px', height: '80px', borderRadius: '12px', objectFit: 'cover', marginBottom: '15px' }} />
        <h1 style={{ color: 'var(--accent-cyan)', fontSize: '1.8rem' }}>Welcome back, {user.username}!</h1>
        <p style={{ color: 'var(--text-muted)' }}>Here's your darts overview</p>
      </div>

      <div className="card" style={{ marginBottom: '20px', border: '2px solid var(--accent-cyan)' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ color: 'var(--accent-cyan)', marginBottom: '10px' }}>{seasonInfo.name}</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '15px' }}>
            {new Date(seasonInfo.startDate).toLocaleDateString()} - {new Date(seasonInfo.endDate).toLocaleDateString()}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px' }}>
            <div className="stat-card" style={{ padding: '15px' }}>
              <div className="stat-value" style={{ fontSize: '1.5rem' }}>{timeLeft.days}</div>
              <div className="stat-label">Days</div>
            </div>
            <div className="stat-card" style={{ padding: '15px' }}>
              <div className="stat-value" style={{ fontSize: '1.5rem' }}>{timeLeft.hours}</div>
              <div className="stat-label">Hours</div>
            </div>
            <div className="stat-card" style={{ padding: '15px' }}>
              <div className="stat-value" style={{ fontSize: '1.5rem' }}>{timeLeft.minutes}</div>
              <div className="stat-label">Mins</div>
            </div>
            <div className="stat-card" style={{ padding: '15px' }}>
              <div className="stat-value" style={{ fontSize: '1.5rem' }}>{timeLeft.seconds}</div>
              <div className="stat-label">Secs</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '20px', background: 'var(--bg-secondary)' }}>
        <h3 className="card-title" style={{ color: 'var(--accent-cyan)' }}>League Game Rules</h3>
        <div style={{ display: 'grid', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: 'var(--bg-primary)', borderRadius: '8px' }}>
            <span>Format</span>
            <span style={{ fontWeight: 'bold' }}>Best of 8 legs (First to 5)</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: 'var(--bg-primary)', borderRadius: '8px' }}>
            <span>CAM On</span>
            <span style={{ fontWeight: 'bold' }}>In use</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: 'var(--bg-primary)', borderRadius: '8px' }}>
            <span>Platform</span>
            <span style={{ fontWeight: 'bold' }}>DartCounter</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: 'var(--bg-primary)', borderRadius: '8px' }}>
            <span>Tokens</span>
            <span style={{ fontWeight: 'bold', color: 'var(--success)' }}>+50 for win</span>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <h2 className="card-title">Season Review</h2>
        <div className="home-stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.played}</div>
            <div className="stat-label">Matches Played</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.wins}</div>
            <div className="stat-label">Wins</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.losses}</div>
            <div className="stat-label">Losses</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.points}</div>
            <div className="stat-label">Points</div>
          </div>
        </div>
      </div>

      {tournaments.length > 0 && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <h2 className="card-title">Tournaments</h2>
          {tournaments.map(t => (
            <div key={t.id} style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontWeight: '600' }}>{t.name}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {t.type} • {t.divisions?.join(', ') || 'All divisions'}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h2 className="card-title">Recent Activity</h2>
        {userResults.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
            No recent matches. Submit a result to get started!
          </p>
        ) : (
          <div>
            {userResults.slice(-5).reverse().map(r => {
              const isPlayer1 = r.player1Id === user.id
              const result = isPlayer1 ? (r.score1 > r.score2 ? 'Win' : r.score1 < r.score2 ? 'Loss' : 'Draw') : (r.score2 > r.score1 ? 'Win' : r.score2 < r.score1 ? 'Loss' : 'Draw')
              const score = isPlayer1 ? `${r.score1}-${r.score2}` : `${r.score2}-${r.score1}`
              const opponent = isPlayer1 ? r.player2 : r.player1
              return (
                <div key={r.id} style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>vs {opponent}</span>
                    <span style={{ color: result === 'Win' ? 'var(--success)' : result === 'Loss' ? 'var(--error)' : 'var(--warning)' }}>{result}</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {score} • {r.date}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <a 
          href="https://chat.whatsapp.com/GNaYyJDxzMADbA1ARI1kne" 
          target="_blank" 
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 24px',
            background: '#25D366',
            color: 'white',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: '600'
          }}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="white">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          Join Elite Arrows WhatsApp Community
        </a>
      </div>
    </div>
  )
}