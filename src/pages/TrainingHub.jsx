import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContextInternal'
import Breadcrumbs from '../components/Breadcrumbs'
import { COURSES } from '../training/courses'
import { COACHES, getCoach } from '../training/coaches'
import { DRILLS } from '../training/drills'
import { TIPS } from '../training/tips'
import { courseCompletion } from '../training/progress'
import { ADMIN_EMAILS } from '../config'

export default function TrainingHub() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.isAdmin === true || (user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase()))
  const hasAccess = user?.trainingPassActive === true || isAdmin

  return (
    <div className="page animate-fade-in" style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <Breadcrumbs items={[{ label: 'Home', path: '/home' }, { label: 'Darts Academy' }]} />

      {/* HERO */}
      <div className="card glass" style={{ padding: '0', overflow: 'hidden', marginBottom: '32px', background: 'linear-gradient(135deg, rgba(77,168,218,0.15), rgba(0,212,255,0.05))', border: '1px solid rgba(0,212,255,0.25)' }}>
        <div style={{ padding: '40px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '8px' }}>🎯</div>
          <h1 className="page-title text-gradient" style={{ fontSize: '2.4rem', marginBottom: '8px' }}>Elite Arrows Academy</h1>
          <p style={{ color: 'var(--text-muted)', maxWidth: '620px', margin: '0 auto 20px', lineHeight: '1.6' }}>
            Structured darts training built to lift your 3-dart average — courses, drills and coach tips
            drawn from published professional coaching material and checked by our Academy team.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: hasAccess ? '0' : '24px' }}>
            {COURSES.map(c => (
              <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', padding: '4px 12px', borderRadius: '99px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)' }}>
                {c.icon} {c.title}
              </span>
            ))}
          </div>

          {!hasAccess ? (
            <div className="card glass animate-fade-in" style={{ maxWidth: '480px', margin: '0 auto', padding: '24px', border: '1px solid rgba(251,191,36,0.4)', background: 'rgba(251,191,36,0.06)' }}>
              <h3 style={{ marginBottom: '8px' }}>🔒 Training Pass</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: '1.6' }}>
                Unlock every course, drill library and coach tip for <strong style={{ color: 'var(--warning)' }}>£2.99/month</strong>.
                Separate from your Elite Pass — no league subscription needed.
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={() => navigate('/subscription?tab=training')}>Get Training Pass</button>
                <button className="btn btn-secondary" onClick={() => navigate('/subscription')}>See Elite Pass</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '99px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.35)', color: 'var(--success)', fontSize: '0.85rem', fontWeight: 800 }}>
              ✓ Training Pass Active — all content unlocked
            </div>
          )}
        </div>
      </div>

      {/* VERIFIED STRIP */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '40px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '99px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>✅ Attributed to named coaches</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '99px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>📚 Sourced from published material</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '99px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>🛡️ Academy-reviewed for accuracy</span>
      </div>

      {/* COURSES */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '20px' }}>
        <div>
          <h2 className="page-title" style={{ fontSize: '1.6rem' }}>Course Library</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Structured lessons — learn a module at a time.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '48px' }}>
        {COURSES.map(course => {
          const { done, total, pct } = courseCompletion(user?.id, course)
          const coach = getCoach(course.lessons[0].coachId)
          return (
            <div key={course.id} className="card glass glass-hover" style={{ padding: '0', overflow: 'hidden', cursor: 'pointer', border: `1px solid rgba(255,255,255,0.08)` }} onClick={() => hasAccess ? navigate(`/training/course/${course.id}`) : navigate('/subscription?tab=training')}>
              <div style={{ padding: '24px 24px 8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '2.2rem' }}>{course.icon}</span>
                  {hasAccess ? (
                    <span style={{ fontSize: '0.68rem', fontWeight: 900, padding: '3px 10px', borderRadius: '99px', background: 'rgba(34,197,94,0.12)', color: 'var(--success)', border: '1px solid rgba(34,197,94,0.3)' }}>{done}/{total} DONE</span>
                  ) : (
                    <span style={{ fontSize: '0.68rem', fontWeight: 900, padding: '3px 10px', borderRadius: '99px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>🔒 PASS</span>
                  )}
                </div>
                <h3 style={{ marginTop: '12px', marginBottom: '6px', color: course.color }}>{course.title}</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px', lineHeight: '1.5' }}>{course.tagline}</p>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{course.level} • {course.lessons.length} lessons</div>
              </div>
              <div style={{ padding: '0 24px 20px' }}>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '99px', overflow: 'hidden', marginTop: '12px' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: course.color, borderRadius: '99px', transition: 'width 0.4s' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  <span>Taught by: <strong style={{ color: coach.accent }}>{coach.name}</strong></span>
                  <span>{pct}% complete</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* DRILLS + TIPS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '40px' }} className="training-two-col">
        <div className="card glass glass-hover" style={{ padding: '24px', cursor: 'pointer' }} onClick={() => hasAccess ? navigate('/training/drills') : navigate('/subscription?tab=training')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ fontSize: '2rem' }}>🖥️</div>
            {!hasAccess && <span style={{ fontSize: '0.68rem', fontWeight: 900, padding: '3px 10px', borderRadius: '99px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>🔒 PASS</span>}
          </div>
          <h3 style={{ marginTop: '12px', color: '#22c55e' }}>Drill Library</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5', marginTop: '6px' }}>
            {DRILLS.length} structured drills with targets for beginner, intermediate and advanced — built around lifting your average.
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
      <h2 className="page-title" style={{ fontSize: '1.6rem', marginBottom: '8px' }}>The Coaches</h2>
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
        <p><strong style={{ color: 'var(--accent-cyan)' }}>Verification policy:</strong> Content in the Academy is attributed to named coaches and professional sources, then reviewed by the Elite Arrows Academy team before publishing. Quotes reflect published coaching material.</p>
      </div>
    </div>
  )
}