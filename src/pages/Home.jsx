import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { db, doc, setDoc } from '../firebase'
import NewsFeed from '../components/NewsFeed'
import { SkeletonList } from '../components/Skeleton'
import Tooltip from '../components/Tooltip'
import Breadcrumbs from '../components/Breadcrumbs'
import { getLeaguePoints } from '../utils/leagueScoring'
import { getResultEffectiveTime, getResultPlayerId, isLeagueResult } from '../utils/leagueResults'
import GlobalHighlightReel from '../components/GlobalHighlightReel'


const DEFAULT_LEAGUE_TABLE_RESET_AT = '2026-04-29T16:14:21.338+01:00'

export default function Home() {
  const { user, getAllUsers, getFixtures, getResults, loading, adminData, updateUser, getSeasons } = useAuth()
  
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  const [seasonPhase, setSeasonPhase] = useState('upcoming')
  const [visible, setVisible] = useState(false)
  const [surveyAnswers, setSurveyAnswers] = useState({})
  const [submittingSurvey, setSubmittingSurvey] = useState(null)


  const activeSeason = useMemo(() => {
    const seasons = typeof getSeasons === 'function' ? getSeasons() : []

    // 1. Force Season 4 dates as requested: Aug 1st to Sept 1st
    return {
      name: 'Season 4',
      startDate: '2026-08-01T00:00:00',
      endDate: '2026-09-01T00:00:00'
    }
  }, [getSeasons])

  useEffect(() => {
    setVisible(true)
  }, [])


  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date()
      const startDate = new Date(activeSeason.startDate)
      const endDate = new Date(activeSeason.endDate)

      const nextPhase = now < startDate ? 'upcoming' : now < endDate ? 'active' : 'ended'
      const targetDate = nextPhase === 'upcoming' ? startDate : nextPhase === 'active' ? endDate : null
      const diff = targetDate ? targetDate - now : 0

      setSeasonPhase(nextPhase)
      
      if (diff > 0) {
        setTimeLeft({
          days: Math.floor(diff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((diff / (1000 * 60)) % 60),
          seconds: Math.floor((diff / 1000) % 60)
        })
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 })
      }
    }
    
    calculateTimeLeft()
    const timer = setInterval(calculateTimeLeft, 1000)
    return () => clearInterval(timer)
  }, [activeSeason])

  const allUsers = getAllUsers()
  const fixtures = getFixtures()
  const allResults = getResults()

  const tournaments = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('eliteArrowsTournaments') || '[]')
    } catch (e) { return [] }
  }, [])

  const fixturesById = useMemo(() =>
    Object.fromEntries(fixtures.map(fixture => [String(fixture.id), fixture])),
  [fixtures])

  const approvedResults = useMemo(() =>
    allResults.filter(r => String(r.status).toLowerCase() === 'approved'),
  [allResults])

  const userResults = useMemo(() =>
    approvedResults.filter(r => (
      String(getResultPlayerId(r, 1, allUsers)) === String(user?.id) ||
      String(getResultPlayerId(r, 2, allUsers)) === String(user?.id)
    )),
  [approvedResults, allUsers, user?.id])

  const resetTimes = useMemo(() =>
    [DEFAULT_LEAGUE_TABLE_RESET_AT, adminData?.leagueTableResetAt]
      .map(value => value ? new Date(value).getTime() : 0)
      .filter(value => Number.isFinite(value) && value > 0),
  [adminData?.leagueTableResetAt])

  const leagueTableResetTime = useMemo(() =>
    resetTimes.length ? Math.max(...resetTimes) : 0,
  [resetTimes])
  
  const stats = useMemo(() => userResults.reduce((acc, r) => {
    const isLeague = isLeagueResult(r, fixturesById)
    if (!isLeague) return acc

    acc.played++
    const isPlayer1 = String(getResultPlayerId(r, 1, allUsers)) === String(user?.id)
    const score1 = Number(r.score1) || 0
    const score2 = Number(r.score2) || 0
    if (isPlayer1) {
      if (score1 > score2) acc.wins++
      else if (score1 < score2) acc.losses++
      else acc.draws++
    } else {
      if (score2 > score1) acc.wins++
      else if (score2 < score1) acc.losses++
      else acc.draws++
    }

    const countsForLeaguePoints = !leagueTableResetTime || getResultEffectiveTime(r) > leagueTableResetTime
    if (countsForLeaguePoints) {
      const myScore = isPlayer1 ? score1 : score2
      const opponentScore = isPlayer1 ? score2 : score1
      acc.points += getLeaguePoints(myScore, opponentScore)
    }
    return acc
  }, { played: 0, wins: 0, losses: 0, draws: 0, points: 0 }), [userResults, fixturesById, allUsers, user?.id, leagueTableResetTime])

  const champions = useMemo(() => {
    const list = []
    allUsers.forEach(u => {
      if (u.trophies && Array.isArray(u.trophies)) {
        u.trophies.forEach(t => {
          if (t.name?.toLowerCase().includes('champion') || t.name?.toLowerCase().includes('winner')) {
            list.push({
              ...t,
              username: u.username,
              userId: u.id,
              profilePicture: u.profilePicture
            })
          }
        })
      }
    })
    return list.sort((a, b) => new Date(b.awardedAt || 0) - new Date(a.awardedAt || 0)).slice(0, 12)
  }, [allUsers])

  const isSeasonActive = seasonPhase === 'active'
  const seasonTimerTitle = seasonPhase === 'active' ? 'Season 4 Ends In:' : seasonPhase === 'ended' ? 'Season 4 Ended' : 'Season 4 Starts In'

  return (
    <>
    <div className="page">
      <Breadcrumbs items={[{ label: 'Home', path: '/home' }]} />

      <div style={{ marginBottom: '20px', textAlign: 'center' }}>
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
            fontWeight: '600',
            width: '100%',
            justifyContent: 'center',
            boxSizing: 'border-box'
          }}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="white">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          Join Elite Arrows WhatsApp Community
        </a>
      </div>

      <div className={`animate-fade-in-up ${visible ? '' : 'opacity-0'}`}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <img src="/elite arrows.jpg" alt="Elite Arrows" style={{ width: '80px', height: '80px', borderRadius: '12px', objectFit: 'cover', marginBottom: '15px' }} />
          <h1 style={{ color: 'var(--accent-cyan)', fontSize: '1.8rem' }}>Welcome back, {user.username}!</h1>
          <p style={{ color: 'var(--text-muted)' }}>Here's your darts overview</p>
        </div>
      </div>

      <div className={`animate-fade-in-up stagger-item`}>
        <NewsFeed />
      </div>

      <GlobalHighlightReel />

      {/* Surveys */}
      {(() => {
        const allSurveys = adminData?.surveys || []
        const pendingSurveys = allSurveys.filter(s => {
          if (!s.active) return false
          if (s.targetType === 'all') return true
          return (s.targetUserIds || []).includes(user.id)
        }).filter(s => {
          const responses = s.responses || []
          return !responses.find(r => r.userId === user.id)
        })

        if (pendingSurveys.length === 0) return null

        return pendingSurveys.map(survey => (
          <div key={survey.id} className="card animate-fade-in-up stagger-item" style={{ marginBottom: '20px', border: '2px solid var(--accent-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ color: 'var(--accent-primary)', margin: 0 }}>📋 {survey.title}</h3>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: '20px' }}>Survey</span>
            </div>
            {survey.description && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>{survey.description}</p>}

            {survey.questions.map((q, qi) => (
              <div key={q.id} className="form-group" style={{ marginBottom: '12px' }}>
                <label>{q.text}</label>
                {q.type === 'text' && (
                  <input value={surveyAnswers[`${survey.id}_${q.id}`] || ''} onChange={e => setSurveyAnswers({...surveyAnswers, [`${survey.id}_${q.id}`]: e.target.value})} placeholder="Your answer..." />
                )}
                {q.type === 'radio' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {(q.options || []).map(opt => (
                      <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', cursor: 'pointer' }}>
                        <input type="radio" name={`${survey.id}_${q.id}`} value={opt} checked={surveyAnswers[`${survey.id}_${q.id}`] === opt} onChange={e => setSurveyAnswers({...surveyAnswers, [`${survey.id}_${q.id}`]: e.target.value})} />
                        {opt}
                      </label>
                    ))}
                  </div>
                )}
                {q.type === 'checkbox' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {(q.options || []).map(opt => (
                      <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', cursor: 'pointer' }}>
                        <input type="checkbox" value={opt} checked={(surveyAnswers[`${survey.id}_${q.id}`] || []).includes(opt)} onChange={e => {
                          const current = surveyAnswers[`${survey.id}_${q.id}`] || []
                          const next = e.target.checked ? [...current, opt] : current.filter(x => x !== opt)
                          setSurveyAnswers({...surveyAnswers, [`${survey.id}_${q.id}`]: next})
                        }} />
                        {opt}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <button className="btn btn-primary btn-block" disabled={submittingSurvey === survey.id} onClick={async () => {
              setSubmittingSurvey(survey.id)
              const answers = survey.questions.map(q => ({
                questionId: q.id,
                question: q.text,
                answer: q.type === 'checkbox' ? (surveyAnswers[`${survey.id}_${q.id}`] || []).join(', ') : (surveyAnswers[`${survey.id}_${q.id}`] || '')
              }))
              const response = { userId: user.id, username: user.username, answers, submittedAt: new Date().toISOString() }
              const surveys = [...(adminData?.surveys || [])]
              const idx = surveys.findIndex(s => s.id === survey.id)
              if (idx !== -1) {
                surveys[idx] = { ...surveys[idx], responses: [...(surveys[idx].responses || []), response] }
                try {
                  await setDoc(doc(db, 'admin', 'data'), { surveys }, { merge: true })
                  setSurveyAnswers({})
                  setSubmittingSurvey(null)
                  window.location.reload()
                } catch (e) { alert('Error: ' + e.message); setSubmittingSurvey(null) }
              } else { setSubmittingSurvey(null) }
            }}>{submittingSurvey === survey.id ? 'Submitting...' : 'Submit Answers'}</button>
          </div>
        ))
      })()}

      <div className={`card animate-fade-in-up stagger-item`} style={{ marginBottom: '20px', border: '2px solid var(--accent-cyan)' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ color: 'var(--accent-cyan)', marginBottom: '10px' }}>
            {seasonTimerTitle}
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '15px' }}>
            {isSeasonActive 
              ? `${new Date(activeSeason.startDate).toLocaleString()} - ${new Date(activeSeason.endDate).toLocaleString()}`
              : `${activeSeason.name}: ${new Date(activeSeason.startDate).toLocaleString()} - ${new Date(activeSeason.endDate).toLocaleString()}`
            }
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

      {champions.length > 0 && (
        <div className="card animate-fade-in-up stagger-item" style={{ marginBottom: '20px', background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.1), rgba(245, 158, 11, 0.1))', border: '1px solid #fbbf24' }}>
          <h2 className="card-title" style={{ color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>🏆</span> Hall of Fame
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
            gap: '10px',
            marginTop: '10px'
          }}>
            {champions.map((champ, i) => (
              <Link key={i} to={`/profile/${champ.userId}`} style={{ textDecoration: 'none' }}>
                <div className="glass" style={{
                  padding: '12px 8px',
                  textAlign: 'center',
                  borderRadius: '12px',
                  border: '1px solid rgba(251, 191, 36, 0.2)',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center'
                }}>
                  <div style={{ fontSize: '1.4rem', marginBottom: '4px' }}>{champ.icon || '🏆'}</div>
                  <div style={{ fontWeight: 800, fontSize: '0.8rem', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{champ.username}</div>
                  <div style={{ fontSize: '0.65rem', color: '#fbbf24', fontWeight: 700, lineHeight: 1.2, margin: '2px 0' }}>{champ.name}</div>
                  <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>{champ.season}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: '20px', background: 'var(--bg-secondary)' }}>
        <h3 className="card-title" style={{ color: 'var(--accent-cyan)' }}>League Game Rules</h3>
        <div style={{ display: 'grid', gap: '10px' }}>
          <Tooltip content="Standard league format: First to win 5 legs wins the match. If the score is 4-4, the match is a draw.">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'var(--bg-primary)', borderRadius: '8px', cursor: 'help', gap: '16px' }}>
              <span>Format</span>
              <span style={{ fontWeight: 'bold', textAlign: 'right' }}>Best of 8 legs</span>
            </div>
          </Tooltip>
          <Tooltip content="Computer Aided Marking - scores are automatically calculated">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'var(--bg-primary)', borderRadius: '8px', cursor: 'help', gap: '16px' }}>
              <span>CAM</span>
              <span style={{ fontWeight: 'bold', textAlign: 'right' }}>Must be on</span>
            </div>
          </Tooltip>
          <Tooltip content="Play online using DartCounter app">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'var(--bg-primary)', borderRadius: '8px', cursor: 'help', gap: '16px' }}>
              <span>Platform</span>
              <span style={{ fontWeight: 'bold', textAlign: 'right' }}>DartCounter</span>
            </div>
          </Tooltip>
          <Tooltip content="Earn Elite Tokens for winning league games">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'var(--bg-primary)', borderRadius: '8px', cursor: 'help', gap: '16px' }}>
              <span>Tokens</span>
              <span style={{ fontWeight: 'bold', color: 'var(--success)', textAlign: 'right' }}>+100 for win</span>
            </div>
          </Tooltip>
          <Tooltip content="League table scoring: legs won plus win/draw/loss bonus. A 5-3 win is 5 legs + 3 win points = 8.">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'var(--bg-primary)', borderRadius: '8px', cursor: 'help', gap: '16px' }}>
              <span>Points</span>
              <span style={{ fontWeight: 'bold', textAlign: 'right' }}>Legs + W/D/L</span>
            </div>
          </Tooltip>
          <Tooltip content="Zero tolerance for cheating or toxic behavior. Breaking rules results in a one-time final warning followed by an immediate season ban for any subsequent offense.">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', cursor: 'help', gap: '16px' }}>
              <span style={{ color: 'var(--error)', fontWeight: 'bold' }}>Strict Policy</span>
              <span style={{ fontWeight: 'bold', color: 'var(--error)', textAlign: 'right' }}>Warning & Ban</span>
            </div>
          </Tooltip>
          <Tooltip content="Elite Pass subscriptions are eligible for a full refund within 14 days of purchase, provided no tournament prizes have been won.">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'var(--bg-primary)', borderRadius: '8px', cursor: 'help', gap: '16px' }}>
              <span>Refunds</span>
              <span style={{ fontWeight: 'bold', textAlign: 'right' }}>14-Day Window</span>
            </div>
          </Tooltip>
        </div>
        <p style={{ marginTop: '16px', fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
          By playing, you agree to the Elite Arrows Code of Conduct. Play fair, or don't play.
        </p>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2 className="card-title" style={{ margin: 0 }}>Pro Overview</h2>
          <Link to="/analytics" style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', fontWeight: 700, textDecoration: 'none' }}>Full Analytics ➔</Link>
        </div>
        <div className="home-stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.played}</div>
            <div className="stat-label">Played</div>
          </div>
          <div className="stat-card" style={{ borderBottom: '2px solid var(--success)' }}>
            <div className="stat-value" style={{ color: 'var(--success)' }}>{stats.wins}</div>
            <div className="stat-label">Wins</div>
          </div>
          <div className="stat-card" style={{ borderBottom: '2px solid #fbbf24' }}>
            <div className="stat-value" style={{ color: '#fbbf24' }}>{user.threeDartAverage?.toFixed(1) || '0.0'}</div>
            <div className="stat-label">Avg</div>
          </div>
          <div className="stat-card" style={{ borderBottom: '2px solid var(--accent-cyan)' }}>
            <div className="stat-value" style={{ color: 'var(--accent-cyan)' }}>{stats.points}</div>
            <div className="stat-label">Pts</div>
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
              const isPlayer1 = String(getResultPlayerId(r, 1, allUsers)) === String(user.id)
              const score1 = Number(r.score1) || 0
              const score2 = Number(r.score2) || 0
              const result = isPlayer1 ? (score1 > score2 ? 'Win' : score1 < score2 ? 'Loss' : 'Draw') : (score2 > score1 ? 'Win' : score2 < score1 ? 'Loss' : 'Draw')
              const score = isPlayer1 ? `${score1}-${score2}` : `${score2}-${score1}`
              const opponent = isPlayer1 ? r.player2 : r.player1
              const opponentId = isPlayer1 ? r.player2Id : r.player1Id
              return (
                <Link key={r.id} to={`/profile/${opponentId}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>vs {opponent}</span>
                      <span style={{ color: result === 'Win' ? 'var(--success)' : result === 'Loss' ? 'var(--error)' : 'var(--warning)' }}>{result}</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {score} • {r.date}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

    </div>
    </>
  )
}
