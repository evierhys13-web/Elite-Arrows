import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContextInternal'
import { db, doc, setDoc } from '../firebase'
import NewsFeed from '../components/NewsFeed'
import Breadcrumbs from '../components/Breadcrumbs'
import { getLeaguePoints } from '../utils/leagueScoring'
import { getResultEffectiveTime, getResultPlayerId, isLeagueResult } from '../utils/leagueResults'
import GlobalHighlightReel from '../components/GlobalHighlightReel'
import { collection, getDocs } from '../firebase'

const DEFAULT_LEAGUE_TABLE_RESET_AT = '2026-04-29T16:14:21.338+01:00'

export default function Home() {
  const { user, getAllUsers, getFixtures, getResults, loading, adminData, getSeasons } = useAuth()
  const navigate = useNavigate()
  
  const allUsers = getAllUsers()
  const fixtures = getFixtures()
  const allResults = getResults()

  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  const [seasonPhase, setSeasonPhase] = useState('upcoming')
  const [visible, setVisible] = useState(false)
  const [surveyAnswers, setSurveyAnswers] = useState({})
  const [submittingSurvey, setSubmittingSurvey] = useState(null)
  const [openSinglesEntries, setOpenSinglesEntries] = useState([])

  useEffect(() => {
    const fetchOpenLeagueData = async () => {
      try {
        const [sSnap] = await Promise.all([
          getDocs(collection(db, 'openLeagueSingles'))
        ])
        setOpenSinglesEntries(sSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      } catch (e) { console.error(e) }
    }
    fetchOpenLeagueData()
  }, [])

  const activeSeason = useMemo(() => {
    return {
      name: 'Season 4',
      startDate: '2026-08-01T00:00:00',
      endDate: '2026-09-01T00:00:00'
    }
  }, [])

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

  const currentSeasonName = activeSeason.name

  const opponentsToPlay = useMemo(() => {
    if (!user || !user.id || user.division === 'Unassigned' || user.division === 'Admin') return []

    // Specifically clear "To Play" list for Tom Beaumont in Season 4 as requested
    if (currentSeasonName === "Season 4" && (user.username === "Tom Beaumont" || user.name === "Tom Beaumont")) {
      return []
    }

    // 1. Get competition results for the current season to see who is already played
    const playedOpponentCounts = {}
    allResults
      .filter(r => {
        const isApproved = String(r.status || '').toLowerCase() === 'approved'
        const resSeason = String(r.season || '').trim()
        const isSeasonMatch = resSeason === currentSeasonName || (!resSeason && currentSeasonName === 'Season 1')
        return isApproved && isSeasonMatch
      })
      .forEach(r => {
        const p1Id = String(r.player1Id || '')
        const p2Id = String(r.player2Id || '')
        let opponentId = ''
        if (p1Id === String(user.id)) opponentId = p2Id
        else if (p2Id === String(user.id)) opponentId = p1Id
        if (opponentId) playedOpponentCounts[opponentId] = (playedOpponentCounts[opponentId] || 0) + 1
      })

    const remaining = []

    // Standard League ONLY
    if (user.division && user.division !== 'Unassigned') {
      const divisionOpponents = allUsers
        .map(u => {
          const activeSeasonDoc = (getSeasons ? getSeasons() : []).find(s => s.name === currentSeasonName)
          const stagedDiv = activeSeasonDoc?.stagedDivisions?.[String(u.id)]
          return { ...u, effectiveDiv: stagedDiv || u.division || 'Unassigned' }
        })
        .filter(u => {
          if (String(u.id) === String(user.id)) return false
          if (u.effectiveDiv !== user.division) return false
          if (playedOpponentCounts[String(u.id)]) return false
          if (currentSeasonName === "Season 4" && (u.username === "Tom Beaumont" || u.name === "Tom Beaumont")) return false
          return true
        })

      divisionOpponents.forEach(u => {
        const fixture = fixtures.find(f =>
          !f._deleted &&
          String(f.gameType || '').toLowerCase() === 'league' &&
          ((String(f.player1Id) === String(user.id) && String(f.player2Id) === String(u.id)) ||
           (String(f.player1Id) === String(u.id) && String(f.player2Id) === String(user.id)))
        )
        remaining.push({ ...u, type: 'League', fixture })
      })
    }

    return remaining.sort((a, b) => {
      if (a.fixture && !b.fixture) return -1
      if (!a.fixture && b.fixture) return 1
      return 0
    })
  }, [user, allUsers, allResults, fixtures, getSeasons, currentSeasonName])

  const stats = useMemo(() => userResults.reduce((acc, r) => {
    if (!isLeagueResult(r, fixturesById)) return acc
    acc.played++
    const isPlayer1 = String(getResultPlayerId(r, 1, allUsers)) === String(user?.id)
    const score1 = Number(r.score1) || 0
    const score2 = Number(r.score2) || 0
    const myScore = isPlayer1 ? score1 : score2
    const opponentScore = isPlayer1 ? score2 : score1

    if (myScore > opponentScore) acc.wins++
    else if (myScore < opponentScore) acc.losses++
    else acc.draws++

    if (!leagueTableResetTime || getResultEffectiveTime(r) > leagueTableResetTime) {
      acc.points += getLeaguePoints(myScore, opponentScore)
    }
    return acc
  }, { played: 0, wins: 0, losses: 0, draws: 0, points: 0 }), [userResults, fixturesById, allUsers, user?.id, leagueTableResetTime])

  if (loading) return <div className="page glass"><div style={{ padding: '60px', textAlign: 'center' }}><div className="spinner"></div></div></div>
  if (!user) return <div className="page glass"><div style={{ padding: '60px', textAlign: 'center' }}>Please sign in.</div></div>

  const isSeasonActive = seasonPhase === 'active'
  const seasonTimerTitle = seasonPhase === 'active' ? 'Season 4 Ends In:' : seasonPhase === 'ended' ? 'Season 4 Ended' : 'Season 4 Starts In'

  return (
    <div className="page">
      <Breadcrumbs items={[{ label: 'Home', path: '/home' }]} />

      {/* 1. Welcome Back (Top Header) */}
      <div className={`animate-fade-in-up ${visible ? '' : 'opacity-0'}`} style={{ marginBottom: '24px' }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ color: 'var(--accent-cyan)', fontSize: '2rem', fontWeight: 800, margin: 0 }}>Welcome back, {user.username}!</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>Here's your darts overview</p>
        </div>
      </div>

      {/* 2. Season Ends (Timer) */}
      <div className={`card animate-fade-in-up`} style={{ marginBottom: '20px', border: '2px solid var(--accent-cyan)' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ color: 'var(--accent-cyan)', marginBottom: '10px' }}>{seasonTimerTitle}</h2>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px' }}>
            {Object.entries(timeLeft).map(([label, value]) => (
              <div key={label} className="stat-card" style={{ padding: '15px' }}>
                <div className="stat-value" style={{ fontSize: '1.5rem' }}>{value}</div>
                <div className="stat-label">{label.charAt(0).toUpperCase() + label.slice(1, 4)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Season Schedule (Standard League ONLY) */}
      {opponentsToPlay.length > 0 && (
        <div className="card animate-fade-in-up stagger-item" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h2 className="card-title" style={{ margin: 0, color: 'var(--accent-cyan)' }}>Your Season Schedule</h2>
            <Link to="/match-log" style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', fontWeight: 700, textDecoration: 'none' }}>Full Log ➔</Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {opponentsToPlay.map(player => (
              <div key={`${player.id}_${player.type}_${player.fixture?.id || ''}`} className="glass" style={{
                padding: '12px 16px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(255,255,255,0.05)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="avatar-ring" style={{ width: '36px', height: '36px', padding: '2px' }}>
                    <div className="avatar-inner" style={{ background: '#050816', fontSize: '0.8rem' }}>
                      {player.profilePicture ? <img src={player.profilePicture} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span>{player.username.charAt(0).toUpperCase()}</span>}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {player.username}
                      <span style={{ fontSize: '0.6rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(0, 212, 255, 0.1)', color: 'var(--accent-cyan)', border: '1px solid rgba(0, 212, 255, 0.2)' }}>League</span>
                    </div>
                    <div style={{ color: player.fixture ? 'var(--success)' : 'var(--text-muted)', fontSize: '0.7rem' }}>
                      {player.fixture ? `📅 ${player.fixture.fixtureDate || player.fixture.date} ${player.fixture.fixtureTime || player.fixture.time}` : 'Not scheduled'}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Link to={`/submit-result?opponent=${player.id}&gameType=League&season=${currentSeasonName}`} className="btn btn-primary btn-sm" style={{ padding: '4px 10px', fontSize: '0.7rem' }}>Submit</Link>
                  {!player.fixture && <Link to={`/chat?openChat=friend_${player.id}`} className="btn btn-secondary btn-sm" style={{ padding: '4px 10px', fontSize: '0.7rem' }}>Arrange</Link>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. High Finish Videos */}
      <GlobalHighlightReel />

      {/* 5. News Feed */}
      <NewsFeed />

      {/* 6. Pro Overview */}
      <div className="card" style={{ marginBottom: '20px', marginTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2 className="card-title" style={{ margin: 0 }}>Pro Overview</h2>
          <Link to="/statistics" style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', fontWeight: 700, textDecoration: 'none' }}>Full Statistics ➔</Link>
        </div>
        <div className="home-stats-grid">
          {[{l: 'Played', v: stats.played}, {l: 'Wins', v: stats.wins, c: 'var(--success)'}, {l: 'Avg', v: user.threeDartAverage?.toFixed(1) || '0.0', c: '#fbbf24'}, {l: 'Pts', v: stats.points, c: 'var(--accent-cyan)'}].map(s => (
            <div key={s.l} className="stat-card" style={s.c ? { borderBottom: `2px solid ${s.c}` } : {}}>
              <div className="stat-value" style={s.c ? { color: s.c } : {}}>{s.v}</div>
              <div className="stat-label">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 7. Recent Activity (Standard League) */}
      <div className="card">
        <h2 className="card-title">Recent League Activity</h2>
        {userResults.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No recent league matches.</p>
        ) : (
          <div>
            {userResults.slice(-10).reverse().map(r => {
              if (!isLeagueResult(r, fixturesById)) return null
              const isPlayer1 = String(getResultPlayerId(r, 1, allUsers)) === String(user.id)
              const score1 = Number(r.score1) || 0, score2 = Number(r.score2) || 0
              const result = isPlayer1 ? (score1 > score2 ? 'Win' : score1 < score2 ? 'Loss' : 'Draw') : (score2 > score1 ? 'Win' : score2 < score1 ? 'Loss' : 'Draw')
              const opponent = isPlayer1 ? r.player2 : r.player1
              return (
                <Link key={r.id} to={`/profile/${isPlayer1 ? r.player2Id : r.player1Id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ padding: '12px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <div>vs {opponent}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{isPlayer1 ? `${score1}-${score2}` : `${score2}-${score1}`} • {r.date}</div>
                    </div>
                    <span style={{ color: result === 'Win' ? 'var(--success)' : result === 'Loss' ? 'var(--error)' : 'var(--warning)', fontWeight: 800 }}>{result}</span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Surveys (Bottom) */}
      {(() => {
        const surveys = (adminData?.surveys || []).filter(s => s.active && (s.targetType === 'all' || (s.targetUserIds || []).includes(user.id)) && !(s.responses || []).find(r => r.userId === user.id))
        return surveys.map(s => (
          <div key={s.id} className="card" style={{ marginTop: '20px', border: '1px solid var(--accent-primary)' }}>
            <h3 style={{ color: 'var(--accent-primary)' }}>📋 {s.title}</h3>
            <button className="btn btn-primary btn-block" onClick={() => navigate('/settings')}>Open Surveys in Settings</button>
          </div>
        ))
      })()}
    </div>
  )
}
