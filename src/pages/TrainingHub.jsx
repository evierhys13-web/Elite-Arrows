import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContextInternal'
import Breadcrumbs from '../components/Breadcrumbs'
import { COURSES } from '../training/courses'
import { COACHES, getCoach } from '../training/coaches'
import { DRILLS } from '../training/drills'
import { TIPS } from '../training/tips'
import { courseCompletion } from '../training/progress'
import {
  LEVEL_BANDS,
  getPlayerLevel,
  buildRecommendations,
  getEffectiveAvg,
  courseFitLabel
} from '../training/recommend'
import { derivePlayerStatsFromResults } from '../utils/playerStats'
import { getResultPlayerId } from '../utils/leagueResults'
import { ADMIN_EMAILS } from '../config'

const ACTIVE_SEASON = { name: 'Elite Arrows Season 5' }

export default function TrainingHub() {
  const navigate = useNavigate()
  const { user, getAllUsers, getFixtures, getResults, loading, adminData, fetchResultsBySeason, fetchUsersByDivision } = useAuth()

  const allUsers = getAllUsers()
  const fixtures = getFixtures()
  const allResults = getResults()

  useEffect(() => {
    if (loading || !user?.id) return
    const division = user.division && user.division !== 'Unassigned' && user.division !== 'Admin' ? user.division : 'Overall'
    Promise.all([
      fetchResultsBySeason(ACTIVE_SEASON.name),
      fetchUsersByDivision(division),
    ]).catch(() => {})
  }, [loading, user?.id, user?.division, fetchResultsBySeason, fetchUsersByDivision])

  const userResults = useMemo(() => {
    if (!user?.id) return []
    const approved = allResults.filter(r => String(r.status).toLowerCase() === 'approved')
    return approved.filter(r => (
      String(getResultPlayerId(r, 1, allUsers)) === String(user.id) ||
      String(getResultPlayerId(r, 2, allUsers)) === String(user.id)
    ))
  }, [allResults, allUsers, user?.id])

  const stats = useMemo(() => {
    if (!user?.id) return {}
    const map = derivePlayerStatsFromResults([user], userResults, {
      fixtures,
      adminData,
      leagueOnly: true,
      currentSeason: ACTIVE_SEASON.name,
      includePlayoffs: false,
    })
    return map[String(user.id)] || {}
  }, [user, userResults, fixtures, adminData])

  const recs = useMemo(() => buildRecommendations({
    stats,
    declaredAvg: user?.threeDartAverage || 0
  }), [stats, user?.threeDartAverage])

  const isAdmin = user?.isAdmin === true || (user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase()))
  const hasAccess = user?.trainingPassActive === true || isAdmin

  if (loading) return <div className="page glass"><div style={{ padding: '60px', textAlign: 'center' }}><div className="spinner"></div></div></div>

  const effectiveAvg = getEffectiveAvg(stats, user?.threeDartAverage || 0)
  const band = getPlayerLevel(effectiveAvg || 40)
  const markerPct = effectiveAvg > 0 ? Math.min(100, (effectiveAvg / 76) * 100) : null
  const games = Number(stats?.played) || 0
  const doublesPct = (Number.isFinite(Number(stats?.doubleSuccess)) && stats?.doubleSuccess !== null) ? Number(stats.doubleSuccess) : null
  const statChips = [
    { label: 'Games', value: games || '0' },
    { label: 'Season Avg', value: effectiveAvg > 0 ? effectiveAvg.toFixed(1) : '—' },
    { label: 'Doubles', value: doublesPct !== null ? `${doublesPct.toFixed(0)}%` : '—' },
    { label: 'Best Checkout', value: Number(stats?.highestCheckout) > 0 ? stats.highestCheckout : '—' },
    { label: '180s', value: Number(stats?.['180s']) || 0 },
    { label: 'W-L', value: `${Number(stats?.wins) || 0}-${Number(stats?.losses) || 0}` }
  ]

  const openCourse = (course) => hasAccess
    ? navigate(`/training/course/${course.id}`)
    : navigate('/subscription?tab=training')

  return (
    <div className="page animate-fade-in" style={{ maxWidth: '1140px', margin: '0 auto' }}>
      <Breadcrumbs items={[{ label: 'Home', path: '/home' }, { label: 'Darts Academy' }]} />

      {/* HERO */}
      <div className="card glass" style={{ padding: '0', overflow: 'hidden', marginBottom: '28px', background: 'linear-gradient(135deg, rgba(77,168,218,0.15), rgba(0,212,255,0.05))', border: '1px solid rgba(0,212,255,0.25)' }}>
        <div style={{ padding: '36px 32px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: '2.6rem', marginBottom: '6px' }}>🎯</div>
          <h1 className="page-title text-gradient" style={{ fontSize: '2.2rem', marginBottom: '8px' }}>Elite Arrows Academy</h1>
          <p style={{ color: 'var(--text-muted)', maxWidth: '640px', margin: '0 auto', lineHeight: '1.6', fontSize: '0.95rem' }}>
            Live training powered by your real season — we read your league stats, place your level, and point you at the
            courses that will move your 3-dart average fastest.
          </p>
        </div>
        {!hasAccess && (
          <div className="card glass animate-fade-in" style={{ maxWidth: '480px', margin: '0 auto 28px', padding: '20px', border: '1px solid rgba(251,191,36,0.4)', background: 'rgba(251,191,36,0.06)' }}>
            <h3 style={{ marginBottom: '6px', fontSize: '1.05rem' }}>🔒 Training Pass</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: '1.6' }}>
              Unlock every course, the drill library and coach tips for <strong style={{ color: 'var(--warning)' }}>£2.99/month</strong> — your personal plan and progress included.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={() => navigate('/subscription?tab=training')}>Get Training Pass</button>
              <button className="btn btn-secondary" onClick={() => navigate('/subscription')}>See Elite Pass</button>
            </div>
          </div>
        )}
      </div>

      {/* VERIFIED STRIP */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '32px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '99px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>✅ Attributed to named coaches</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '99px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>📚 Sourced from published material</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '99px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>🛡️ Season 5 live stats powering your plan</span>
      </div>

      {/* YOUR LEVEL */}
      <div className="card glass" style={{ padding: '28px', marginBottom: '28px', border: `1px solid ${band.color}55`, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: `linear-gradient(90deg, ${LEVEL_BANDS.map(b => b.color).join(', ')})` }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '18px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h2 className="page-title" style={{ fontSize: '1.4rem', margin: 0 }}>Your Current Level</h2>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '4px 12px', borderRadius: '99px', color: '#0b051d', background: band.color }}>
                {band.label.toUpperCase()}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>based on {ACTIVE_SEASON.name}</span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '8px', maxWidth: '560px', lineHeight: '1.55' }}>{band.blurb}</p>
          </div>
          <div style={{ textAlign: 'center', minWidth: '120px' }}>
            <div style={{ fontSize: '2.6rem', fontWeight: 900, color: band.color, lineHeight: 1 }}>{effectiveAvg > 0 ? effectiveAvg.toFixed(1) : '—'}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>3-DART AVG</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px', marginBottom: '18px' }}>
          {statChips.map(s => (
            <div key={s.label} style={{ padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>{s.value}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative', marginTop: '4px' }}>
          <div style={{ flex: 1, position: 'relative', height: '16px', display: 'flex', borderRadius: '99px', overflow: 'visible' }}>
            {LEVEL_BANDS.map(b => (
              <div key={b.id} style={{ flex: 1, background: `${b.color}33`, borderLeft: '1px solid rgba(0,0,0,0.3)', cursor: 'pointer', position: 'relative' }} title={`${b.label} (${b.min}${b.max === Infinity ? '+' : '–' + b.max} avg)`}>
                <div style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.58rem', fontWeight: 800, color: '#0b051d', whiteSpace: 'nowrap' }}>{b.label}</div>
              </div>
            ))}
            {markerPct !== null && (
              <div style={{ position: 'absolute', left: `calc(${markerPct}% - 8px)`, top: '-7px', width: '16px', height: '30px', borderRadius: '99px', background: '#fff', border: `3px solid ${band.color}`, boxShadow: '0 2px 8px rgba(0,0,0,0.5)', zIndex: 2 }} />
            )}
          </div>
        </div>

        {!recs.hasData && (
          <div style={{ marginTop: '16px', padding: '14px 18px', borderRadius: '12px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
            🗓️ You don't have enough live data yet this season. Play a couple of league games — or add your dart-counter average on your <strong style={{ color: 'var(--accent-cyan)' }}>Profile</strong> — and your plan will tune to your numbers automatically.
          </div>
        )}
        {recs.declaredOnly && recs.hasData && (
          <div style={{ marginTop: '12px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Showing your declared dart-counter average ({effectiveAvg.toFixed(1)}). Live season average will replace it once you have league games recorded.
          </div>
        )}
      </div>

      {/* RECOMMENDED PATH */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px' }}>
        <div>
          <h2 className="page-title" style={{ fontSize: '1.5rem', margin: 0 }}>Recommended For You</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '4px' }}>
            Ranked from your {ACTIVE_SEASON.name} stats — start with the highest and work down.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '18px', marginBottom: '44px' }}>
        {recs.recommendations.slice(0, 3).map(({ course, rank, reason }) => {
          const { done, pct } = courseCompletion(user?.id, course)
          const isTop = rank === 1
          return (
            <div key={course.id} className="card glass glass-hover" style={{ padding: '20px', cursor: 'pointer', border: isTop ? `1px solid ${course.color}88` : '1px solid var(--border)', position: 'relative' }} onClick={() => openCourse(course)}>
              <div style={{ position: 'absolute', top: '14px', right: '14px', fontSize: '0.66rem', fontWeight: 900, padding: '3px 10px', borderRadius: '99px', background: isTop ? course.color : 'rgba(255,255,255,0.08)', color: isTop ? '#0b051d' : 'var(--text-muted)' }}>
                {isTop ? '★ START HERE' : `#${rank} NEXT`}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '1.9rem' }}>{course.icon}</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', color: course.color }}>{course.title}</h3>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>{course.level} • {course.lessons.length} lessons</div>
                </div>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '14px 0 10px', lineHeight: '1.55', minHeight: '40px' }}>
                <span style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>Why: </span>{reason}
              </p>
              <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '99px', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: course.color, borderRadius: '99px', transition: 'width 0.4s' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{pct}% complete</span>
                <button className={`btn ${isTop ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={(e) => { e.stopPropagation(); openCourse(course) }}>
                  {hasAccess ? 'Open Course' : 'Unlock'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* COURSE LIBRARY */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px' }}>
        <div>
          <h2 className="page-title" style={{ fontSize: '1.5rem', margin: 0 }}>Course Library</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '4px' }}>{COURSES.length} structured courses — every one tagged to a level so you always know the best fit.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '22px', marginBottom: '48px' }}>
        {COURSES.map(course => {
          const { done, total, pct } = courseCompletion(user?.id, course)
          const coach = getCoach(course.lessons[0].coachId)
          const fitLabel = courseFitLabel(course, effectiveAvg)
          const isTopPick = recs.recommendations[0]?.course.id === course.id
          return (
            <div key={course.id} className="card glass glass-hover" style={{ padding: '0', overflow: 'hidden', cursor: 'pointer', border: isTopPick ? `1px solid ${course.color}99` : '1px solid rgba(255,255,255,0.08)' }} onClick={() => openCourse(course)}>
              <div style={{ padding: '22px 22px 8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '2rem' }}>{course.icon}</span>
                  {recs.top?.course.id === course.id && (
                    <span style={{ fontSize: '0.62rem', fontWeight: 900, padding: '3px 10px', borderRadius: '99px', background: `${course.color}22`, color: course.color, border: `1px solid ${course.color}66` }}>▲ TOP PICK</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
                  <span style={{ fontSize: '0.62rem', fontWeight: 800, padding: '2px 8px', borderRadius: '99px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>{course.level}</span>
                  <span style={{ fontSize: '0.62rem', fontWeight: 800, padding: '2px 8px', borderRadius: '99px', background: `${course.color}22`, color: course.color, border: `1px solid ${course.color}55` }}>{fitLabel.toUpperCase()}</span>
                  {!hasAccess && <span style={{ fontSize: '0.62rem', fontWeight: 900, padding: '2px 8px', borderRadius: '99px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>🔒 PASS</span>}
                </div>
                <h3 style={{ marginTop: '10px', marginBottom: '6px', color: course.color, fontSize: '1.06rem' }}>{course.title}</h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '8px', lineHeight: '1.5' }}>{course.tagline}</p>
              </div>
              <div style={{ padding: '4px 22px 18px' }}>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '99px', overflow: 'hidden', marginTop: '8px' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: course.color, borderRadius: '99px', transition: 'width 0.4s' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  <span>Taught by: <strong style={{ color: coach.accent }}>{coach.name}</strong></span>
                  <span>{hasAccess ? `${done}/${total} done • ${pct}%` : `${course.lessons.length} lessons`}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* DRILLS + TIPS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '22px', marginBottom: '40px' }} className="training-two-col">
        <div className="card glass glass-hover" style={{ padding: '24px', cursor: 'pointer' }} onClick={() => hasAccess ? navigate('/training/drills') : navigate('/subscription?tab=training')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ fontSize: '2rem' }}>🖥️</div>
            {!hasAccess && <span style={{ fontSize: '0.68rem', fontWeight: 900, padding: '3px 10px', borderRadius: '99px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>🔒 PASS</span>}
          </div>
          <h3 style={{ marginTop: '12px', color: '#22c55e' }}>Drill Library</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5', marginTop: '6px' }}>
            {DRILLS.length} structured drills with targets for beginner, intermediate and advanced — pick the ones your level panel flagged.
          </p>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '12px' }}>Scoring • Consistency • Finishing • Board work</div>
        </div>

        <div className="card glass" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ fontSize: '2rem' }}>💬</div>
            {!hasAccess && <span style={{ fontSize: '0.68rem', fontWeight: 900, padding: '3px 10px', borderRadius: '99px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>🔒 PASS</span>}
          </div>
          <h3 style={{ marginTop: '12px', color: '#a78bfa' }}>Coach Tips</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5', marginTop: '6px' }}>
            {TIPS.length} verified tips, each with a coach's name, credentials and an action step you can take tonight.
          </p>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '12px' }}>
            {Object.values(COACHES).slice(0, 4).map(c => <span key={c.id} style={{ display: 'inline-block', margin: '2px 6px 0 0' }}>{c.name} ✓</span>)}
          </div>
        </div>
      </div>

      {/* THE COACHES */}
      <h2 className="page-title" style={{ fontSize: '1.5rem', marginBottom: '8px' }}>The Coaches</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>Every lesson is attributed to a named coach with verified credentials.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        {Object.values(COACHES).map(c => (
          <div key={c.id} className="card glass" style={{ padding: '20px', borderLeft: `3px solid ${c.accent}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontWeight: 800, color: c.accent }}>{c.name}</div>
              <span style={{ fontSize: '0.62rem', color: 'var(--success)', fontWeight: 800 }}>VERIFIED</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>{c.role}</div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '10px', lineHeight: '1.5' }}>{c.credentials}</p>
          </div>
        ))}
      </div>

      <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem', padding: '8px 0 24px', lineHeight: '1.7' }}>
        <p><strong style={{ color: 'var(--accent-cyan)' }}>Verification policy:</strong> Content in the Academy is attributed to named coaches and professional sources, then reviewed by the Elite Arrows Academy team before publishing. Recommendations are computed from your approved league results this season — the same numbers as your league table average.</p>
      </div>
    </div>
  )
}