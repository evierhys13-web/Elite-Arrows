import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContextInternal'
import { db, doc, setDoc } from '../firebase'
import NewsFeed from '../components/NewsFeed'
import Breadcrumbs from '../components/Breadcrumbs'
import { getResultPlayerId, isLeagueResult } from '../utils/leagueResults'
import { derivePlayerStatsFromResults } from '../utils/playerStats'
import GlobalHighlightReel from '../components/GlobalHighlightReel'
import { collection, getDocs } from '../firebase'

export default function Home() {
  const { user, getAllUsers, getFixtures, getResults, loading, adminData, getSeasons, fetchResultsBySeason, fetchUsersByDivision } = useAuth()
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
  const [hallOfFame, setHallOfFame] = useState([])
  const [tournaments, setTournaments] = useState([])

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
    const fetchHallOfFame = async () => {
      try {
        const snap = await getDocs(collection(db, 'hallOfFame'))
        setHallOfFame(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(e => e.visible !== false))
      } catch (e) { console.error(e) }
    }
    fetchHallOfFame()
    const fetchTournaments = async () => {
      try {
        const snap = await getDocs(collection(db, 'homeTournaments'))
        setTournaments(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.visible !== false))
      } catch (e) { console.error(e) }
    }
    fetchTournaments()
  }, [])

  const activeSeason = useMemo(() => {
    return {
      name: 'Elite Arrows Season 5',
      startDate: '2026-09-01T00:00:00',
      endDate: '2026-10-01T00:00:00'
    }
  }, [])

  useEffect(() => {
    setVisible(true)
  }, [])

  useEffect(() => {
    if (loading || !user?.id) return
    const division = user.division && user.division !== 'Unassigned' && user.division !== 'Admin' ? user.division : 'Overall'
    Promise.all([
      fetchResultsBySeason(activeSeason.name),
      fetchUsersByDivision(division),
    ]).catch((e) => {
      console.error('Home live data sync failed:', e)
    })
  }, [loading, user?.id, user?.division, activeSeason.name, fetchResultsBySeason, fetchUsersByDivision])

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
        const isNotRejected = String(r.status || '').toLowerCase() !== 'rejected'
        const resSeason = String(r.season || '').trim()
        const isSeasonMatch = resSeason === currentSeasonName || (!resSeason && currentSeasonName === 'Season 1')
        return isNotRejected && isSeasonMatch
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

  const stats = useMemo(() => {
    const playerStatsMap = derivePlayerStatsFromResults(
      user ? [user] : [],
      userResults,
      {
        fixtures,
        adminData,
        leagueOnly: true,
        currentSeason: activeSeason.name,
        includePlayoffs: false,
      },
    );
    return playerStatsMap[String(user?.id)] || {
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      points: 0,
      average: 0,
    };
  }, [user, userResults, fixtures, adminData, activeSeason.name])

  if (loading) return <div className="page glass"><div style={{ padding: '60px', textAlign: 'center' }}><div className="spinner"></div></div></div>
  if (!user) return <div className="page glass"><div style={{ padding: '60px', textAlign: 'center' }}>Please sign in.</div></div>

  const isSeasonActive = seasonPhase === 'active'
  const seasonTimerTitle = seasonPhase === 'active' ? 'Season 5 Ends In:' : seasonPhase === 'ended' ? 'Season 5 Ended' : 'Season 5 Starts In'

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

      {/* 2b. Upcoming Tournaments */}
      {tournaments.length > 0 && (
        <div className="card animate-fade-in-up" style={{ marginBottom: '20px' }}>
          <h2 style={{ margin: 0, marginBottom: '15px', color: 'var(--accent-cyan)' }}>🎯 Upcoming Tournaments</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
            {tournaments.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0)).map(t => (
              <div key={t.id} className="glass" style={{ padding: '16px', borderRadius: '14px', border: '1px solid rgba(0,212,255,0.15)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '10px' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{t.title}</div>
                  {t.date && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>📅 {new Date(t.date).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</div>}
                  {t.password && (
                    <div style={{ marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 10px', borderRadius: '999px', background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.35)', fontSize: '0.7rem', color: '#fbbf24', fontWeight: 700 }}>
                      🔑 Password: {t.password}
                    </div>
                  )}
                </div>
                {t.linkUrl && (
                  <a href={t.linkUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }}>View ➔</a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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

      {/* 4b. Hall of Fame */}
      {hallOfFame.length > 0 && (
        <div className="card animate-fade-in-up" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h2 className="card-title" style={{ margin: 0, color: '#fbbf24' }}>🏆 Hall of Fame</h2>
            <Link to="/hall-of-fame" style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', fontWeight: 700, textDecoration: 'none' }}>View All ➔</Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
            {hallOfFame.slice(0, 6).map(entry => (
              <Link key={entry.id} to={`/profile/${entry.userId}`} style={{ textDecoration: 'none' }}>
                <div className="glass" style={{
                  padding: '14px 8px', textAlign: 'center', borderRadius: '14px',
                  border: '1px solid rgba(251, 191, 36, 0.25)', height: '100%',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '5px'
                }}>
                  {entry.profilePicture ? (
                    <img src={entry.profilePicture} alt="" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ fontSize: '1.6rem' }}>{entry.icon || '🏆'}</div>
                  )}
                  <div style={{ fontWeight: 800, fontSize: '0.8rem', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                    {entry.username}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#fbbf24', fontWeight: 700, lineHeight: 1.3 }}>{entry.name}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 5. News Feed */}
      <NewsFeed showViewAll={true} limit={3} />

      {/* 7. Pro Overview */}
      <div className="card" style={{ marginBottom: '20px', marginTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2 className="card-title" style={{ margin: 0 }}>Pro Overview</h2>
          <Link to="/statistics" style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', fontWeight: 700, textDecoration: 'none' }}>Full Statistics ➔</Link>
        </div>
        <div className="home-stats-grid">
          {[{l: 'Played', v: stats.played}, {l: 'Wins', v: stats.wins, c: 'var(--success)'}, {l: 'Avg', v: stats.average ? stats.average.toFixed(1) : '0.0', c: '#fbbf24'}, {l: 'Pts', v: stats.points, c: 'var(--accent-cyan)'}].map(s => (
            <div key={s.l} className="stat-card" style={s.c ? { borderBottom: `2px solid ${s.c}` } : {}}>
              <div className="stat-value" style={s.c ? { color: s.c } : {}}>{s.v}</div>
              <div className="stat-label">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 8. Recent Activity (Standard League) */}
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
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{r.forfeit ? '🏳️ Forfeit' : isPlayer1 ? `${score1}-${score2}` : `${score2}-${score1}`} • {r.date}</div>
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

      {/* WhatsApp Community Link */}
      <div style={{ marginTop: '40px', textAlign: 'center', paddingBottom: '20px' }}>
        <a
          href="https://chat.whatsapp.com/GNaYyJDxzMADbA1ARI1kne"
          target="_blank"
          rel="noopener noreferrer"
          className="glass"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 24px',
            borderRadius: '99px',
            textDecoration: 'none',
            color: '#25D366',
            fontWeight: 800,
            fontSize: '0.9rem',
            border: '1px solid rgba(37, 211, 102, 0.3)',
            background: 'rgba(37, 211, 102, 0.05)',
            boxShadow: '0 4px 15px rgba(37, 211, 102, 0.1)'
          }}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.353-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.123.57-.081 1.758-.466 2.006-1.166.248-.698.248-1.296.173-1.418-.074-.122-.272-.196-.57-.346m-5.446 7.41h-.01c-1.791 0-3.551-.482-5.101-1.391l-.367-.217-3.793.993 1.012-3.693-.238-.379c-.997-1.587-1.524-3.428-1.524-5.321 0-5.601 4.558-10.158 10.162-10.158 2.712 0 5.26 1.056 7.177 2.974 1.917 1.918 2.971 4.465 2.971 7.177 0 5.604-4.56 10.161-10.165 10.161m10.392-18.49c-2.73-2.73-6.36-4.233-10.222-4.233-7.95 0-14.422 6.471-14.426 14.42 0 2.54.662 5.02 1.921 7.21L0 24l7.355-1.928c2.11 1.149 4.492 1.755 6.91 1.755h.005c7.95 0 14.423-6.471 14.428-14.42 0-3.856-1.503-7.485-4.234-10.215"/>
          </svg>
          Join Official WhatsApp
        </a>
      </div>
    </div>
  )
}
