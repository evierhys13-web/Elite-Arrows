import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContextInternal'
import { ADMIN_EMAILS } from '../config'

const SECTION_IDS = ['welcome', 'season', 'league', 'responsibilities', 'whatsapp', 'rules', 'next', 'branding', 'final']

const SECTION_LABELS = {
  welcome: 'Welcome',
  season: 'Season dates',
  league: 'How the league works',
  responsibilities: 'Your responsibilities',
  whatsapp: 'WhatsApp group',
  rules: 'League rules',
  next: 'What happens next',
  branding: 'Branding',
  final: 'Final message'
}

const SECTION_ACCEPT_LABELS = {
  welcome: "I've read the welcome message",
  season: "I've read the season start dates",
  league: "I've read how the league works",
  responsibilities: "I've read my responsibilities",
  whatsapp: "I've joined the WhatsApp group",
  rules: "I've read and accept the League Rules & Code of Conduct",
  next: "I've read what happens next",
  branding: "I've read about Elite Arrows",
  final: "I've read the final message"
}

function formatDate(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

export default function Welcome() {
  const { user, adminData, completeOnboarding, getSeasons, signOut } = useAuth()
  const navigate = useNavigate()
  const [read, setRead] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const isStaff = user?.isAdmin || user?.isTournamentAdmin || user?.isCupAdmin ||
    (user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase()))
  const alreadyComplete = user?.onboardingComplete === true

  const content = adminData?.onboardingContent || {}
  const whatsappLink = adminData?.whatsappGroupLink || 'https://chat.whatsapp.com/DcKb9AfesVBGjcFVwErEor?s=cl&p=a&mlu=4&ilr=4'
  const pageBorderEnabled = adminData?.welcomeBorderEnabled === true
  const pageBorderColor = adminData?.welcomeBorderColor || '#00d4ff'

  const activeSeason = (getSeasons() || []).find(s => s.name === adminData?.currentSeason) ||
    (getSeasons() || [])[0]
  const seasonStart = adminData?.seasonStartDate || activeSeason?.startDate || null
  const seasonEnd = adminData?.seasonEndDate || activeSeason?.endDate || null
  const seasonName = adminData?.currentSeason || activeSeason?.name || 'the upcoming season'

  const allRead = SECTION_IDS.every(id => read[id])
  const canComplete = (isStaff || alreadyComplete) || allRead
  const readCount = SECTION_IDS.filter(id => read[id]).length

  const toggleRead = (id) => setRead(prev => ({ ...prev, [id]: !prev[id] }))

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth')
  }

  const handleComplete = async () => {
    if (!canComplete || submitting) return
    setSubmitting(true)
    setError('')
    try {
      await completeOnboarding()
      navigate('/home')
    } catch (e) {
      setError(e.message || 'Something went wrong while completing signup.')
      setSubmitting(false)
    }
  }

  const SectionShell = ({ id, num, children, center }) => (
    <section data-section={id} className={`glass ${read[id] ? 'is-read' : ''}`} style={{ padding: '0', borderRadius: '20px', overflow: 'hidden', marginBottom: '18px' }}>
      <div style={{ padding: '24px', display: 'flex', gap: '18px', alignItems: 'flex-start' }}>
        <div className="section-num">{num}</div>
        <div style={{ flex: 1, textAlign: center ? 'center' : 'left' }}>{children}</div>
      </div>
      <label className={`read-toggle ${read[id] ? 'is-read' : ''}`} style={{ margin: '0 24px 22px' }}>
        <input type="checkbox" checked={!!read[id]} onChange={() => toggleRead(id)} />
        <span className="read-toggle-box">{read[id] ? '✓' : ''}</span>
        <span>{SECTION_ACCEPT_LABELS[id]}</span>
      </label>
    </section>
  )

  if (alreadyComplete) {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="card glass" style={{ maxWidth: '440px', width: '100%', textAlign: 'center', padding: '40px 30px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🎯</div>
          <h1 style={{ color: 'var(--accent-cyan)', marginBottom: '10px' }}>You're all set!</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px', lineHeight: '1.6' }}>
            You've already completed your signup. Welcome to the league.
          </p>
          <button className="btn btn-primary btn-block" onClick={() => navigate('/home')}>Go to the App</button>
        </div>
      </div>
    )
  }

  return (
    <div className="page" style={{ minHeight: '100vh' }}>
      <style>{`
        .welcome-progress-track { position: sticky; top: 0; z-index: 50; padding: 12px 0; background: rgba(10,22,40,0.94); backdrop-filter: blur(8px); border-bottom: 1px solid var(--border); }
        .welcome-chip { display: inline-flex; align-items: center; gap: 6px; padding: 5px 11px; border-radius: 99px; font-size: 0.72rem; font-weight: 800; }
        .section-num {
          width: 36px; height: 36px; flex-shrink: 0; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-weight: 900; font-size: 0.95rem; color: var(--accent-cyan);
          background: rgba(0,212,255,0.12); border: 2px solid var(--accent-cyan);
        }
        section.is-read { border-color: rgba(34,197,94,0.5) !important; }
        section.is-read .section-num { color: var(--success); border-color: var(--success); background: rgba(34,197,94,0.12); }
        .read-toggle { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border: 1px solid var(--border); border-radius: 10px; cursor: pointer; background: rgba(0,0,0,0.15); user-select: none; transition: border-color 0.2s, background 0.2s; }
        .read-toggle input { position: absolute; opacity: 0; pointer-events: none; }
        .read-toggle-box { width: 22px; height: 22px; border-radius: 6px; border: 2px solid var(--border); background: rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: center; font-size: 0.8rem; color: #fff; flex-shrink: 0; transition: all 0.2s; }
        .read-toggle.is-read { border-color: var(--success); background: rgba(34,197,94,0.08); }
        .read-toggle.is-read .read-toggle-box { background: var(--success); border-color: var(--success); }
      `}</style>

      <div className="welcome-progress-track">
        <div style={{ maxWidth: '720px', margin: '0 auto', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700 }}>
            SIGNUP — {readCount}/{SECTION_IDS.length} sections ticked
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            {SECTION_IDS.map(id => (
              <div key={id} style={{
                width: '10px', height: '10px', borderRadius: '50%',
                background: read[id] ? 'var(--success)' : 'rgba(255,255,255,0.15)',
                transition: 'background 0.3s'
              }} />
            ))}
          </div>
        </div>
      </div>

      <div style={{
        maxWidth: '720px',
        margin: '0 auto',
        padding: '24px 16px 60px',
        border: pageBorderEnabled ? `2px solid ${pageBorderColor}` : 'none',
        borderRadius: pageBorderEnabled ? '20px' : '0',
        boxShadow: pageBorderEnabled ? `0 0 30px ${pageBorderColor}22` : 'none'
      }}>
        {/* SECTION 1 — WELCOME */}
        <SectionShell id="welcome" num={1} center>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '84px', height: '84px', margin: '0 auto 16px', borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--accent-cyan)', boxShadow: '0 8px 30px rgba(0,212,255,0.25)' }}>
              <img src="/elite arrows.jpg" alt="Elite Arrows" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <h1 className="text-gradient" style={{ fontSize: '2.1rem', margin: '0 0 8px' }}>{adminData?.welcomeHeader || 'Welcome to Elite Arrows'}</h1>
            <p style={{ color: 'var(--text-muted)', lineHeight: '1.7', maxWidth: '560px', margin: '0 auto' }}>
              {adminData?.welcomeMessage || 'You are one step away from joining the league.'}
            </p>
            {user?.username && <p style={{ color: 'var(--accent-cyan)', fontWeight: 800, marginTop: '14px' }}>Hi, {user.username}! 👋</p>}
          </div>
        </SectionShell>

        {/* SECTION 2 — SEASON DATES */}
        <SectionShell id="season" num={2}>
          <h2 style={{ margin: '0 0 8px', color: 'var(--accent-cyan)', fontSize: '1.15rem' }}>🗓️ Season Start Dates</h2>
          <div style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
            <p style={{ margin: '0 0 12px' }}>
              The league runs in seasons. Here's when <strong style={{ color: '#fff' }}>{seasonName}</strong> starts and ends:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', maxWidth: '400px' }}>
              <div className="glass" style={{ padding: '14px', textAlign: 'center', borderRadius: '12px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 800 }}>SEASON STARTS</div>
                <div style={{ fontWeight: 800, color: 'var(--success)', marginTop: '6px', fontSize: '0.9rem' }}>{formatDate(seasonStart) || 'To be announced'}</div>
              </div>
              <div className="glass" style={{ padding: '14px', textAlign: 'center', borderRadius: '12px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 800 }}>SEASON ENDS</div>
                <div style={{ fontWeight: 800, color: '#fbbf24', marginTop: '6px', fontSize: '0.9rem' }}>{formatDate(seasonEnd) || 'To be announced'}</div>
              </div>
            </div>
            <p style={{ margin: '12px 0 0', fontSize: '0.85rem' }}>
              All fixtures must be played by the season end date. Check the app for your division's schedule.
            </p>
          </div>
        </SectionShell>

        {/* SECTION 3 — HOW THE LEAGUE WORKS */}
        <SectionShell id="league" num={3}>
          <h2 style={{ margin: '0 0 8px', color: 'var(--accent-cyan)', fontSize: '1.15rem' }}>
            {content?.howLeagueWorks?.title || 'How The League Works'}
          </h2>
          <p style={{ color: 'var(--text-muted)', lineHeight: '1.7', fontSize: '0.9rem', margin: 0 }}>
            {content?.howLeagueWorks?.body}
          </p>
        </SectionShell>

        {/* SECTION 4 — PLAYER RESPONSIBILITIES */}
        <SectionShell id="responsibilities" num={4}>
          <h2 style={{ margin: '0 0 8px', color: 'var(--accent-cyan)', fontSize: '1.15rem' }}>
            {content?.responsibilities?.title || 'Your Responsibilities'}
          </h2>
          <p style={{ color: 'var(--text-muted)', lineHeight: '1.7', fontSize: '0.9rem', margin: 0 }}>
            {content?.responsibilities?.body}
          </p>
        </SectionShell>

        {/* SECTION 5 — WHATSAPP */}
        <SectionShell id="whatsapp" num={5}>
          <h2 style={{ margin: '0 0 8px', color: 'var(--accent-cyan)', fontSize: '1.15rem' }}>💬 Join the Official WhatsApp Group</h2>
          <p style={{ color: 'var(--text-muted)', lineHeight: '1.6', fontSize: '0.9rem' }}>
            {adminData?.whatsappText || 'All games are arranged in the official WhatsApp community.'}
          </p>
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-block"
            style={{
              textDecoration: 'none',
              background: '#25D366',
              borderColor: '#25D366', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '8px'
            }}
          >
            <span style={{ fontSize: '1.2rem' }}>💬</span>
            Open & Join the WhatsApp Group
          </a>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '10px 0 0', lineHeight: '1.5' }}>
            Open the link above and join the group, then tick the box below to confirm.
          </p>
        </SectionShell>

        {/* SECTION 6 — LEAGUE RULES */}
        <SectionShell id="rules" num={6}>
          <h2 style={{ margin: '0 0 8px', color: 'var(--accent-cyan)', fontSize: '1.15rem' }}>⚖️ League Rules & Rules In General</h2>
          <h3 style={{ margin: '12px 0 6px', color: 'var(--text-primary)', fontSize: '1rem' }}>
            {content?.leagueRules?.title || 'League Rules'}
          </h3>
          <p style={{ color: 'var(--text-muted)', lineHeight: '1.7', fontSize: '0.9rem', margin: 0 }}>
            {content?.leagueRules?.body}
          </p>
          <h3 style={{ margin: '16px 0 6px', color: 'var(--text-primary)', fontSize: '1rem' }}>
            {content?.generalRules?.title || 'Rules In General'}
          </h3>
          <p style={{ color: 'var(--text-muted)', lineHeight: '1.7', fontSize: '0.9rem', margin: 0 }}>
            {content?.generalRules?.body}
          </p>
          <p style={{ fontSize: '0.85rem', margin: '14px 0 0' }}>
            Read the full official rulebook: <a href="#/rules" onClick={(e) => { e.preventDefault(); navigate('/rules') }} style={{ color: 'var(--accent-cyan)', fontWeight: 800 }}>League Rules →</a>
          </p>
        </SectionShell>

        {/* SECTION 7 — WHAT HAPPENS NEXT */}
        <SectionShell id="next" num={7}>
          <h2 style={{ margin: '0 0 8px', color: 'var(--accent-cyan)', fontSize: '1.15rem' }}>
            {content?.whatHappensNext?.title || 'What Happens Next'}
          </h2>
          <p style={{ color: 'var(--text-muted)', lineHeight: '1.7', fontSize: '0.9rem', margin: 0 }}>
            {content?.whatHappensNext?.body}
          </p>
        </SectionShell>

        {/* SECTION 8 — BRANDING */}
        <SectionShell id="branding" num={8}>
          <h2 style={{ margin: '0 0 8px', color: 'var(--accent-cyan)', fontSize: '1.15rem' }}>
            🏹 About {adminData?.companyName || 'Elite Arrows'}
          </h2>
          <p style={{ color: 'var(--text-muted)', lineHeight: '1.7', fontSize: '0.9rem', margin: 0 }}>
            {adminData?.brandingText || 'Elite Arrows is a competitive online darts league.'}
          </p>
        </SectionShell>

        {/* SECTION 9 — FINAL MESSAGE + COMPLETE */}
        <SectionShell id="final" num={9} center>
          <div style={{ fontSize: '2.4rem', marginBottom: '8px' }}>🎯</div>
          <h2 style={{ margin: '0 0 8px', color: '#fff', fontSize: '1.4rem' }}>Final Message</h2>
          <p style={{ color: 'var(--text-muted)', lineHeight: '1.7', fontSize: '0.9rem', maxWidth: '500px', margin: '0 auto 20px' }}>
            {adminData?.finalMessage || 'You are all set — good luck at the oche!'}
          </p>

          {error && <div className="form-error" style={{ marginBottom: '12px' }}>{error}</div>}

          {!canComplete ? (
            <div style={{ textAlign: 'center' }}>
              <button className="btn btn-primary btn-block" disabled style={{ opacity: 0.55, cursor: 'not-allowed' }}>🔒 Complete Signup</button>
              <div style={{ marginTop: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                {SECTION_IDS.map(id => (
                  <span key={id} className="welcome-chip" style={{
                    background: read[id] ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
                    color: read[id] ? 'var(--success)' : 'var(--text-muted)',
                    border: `1px solid ${read[id] ? 'var(--success)' : 'var(--border)'}`
                  }}>
                    {read[id] ? '✓' : '•'} {SECTION_LABELS[id]}
                  </span>
                ))}
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '16px 0 0' }}>
                Tick the box in all {SECTION_IDS.length} sections above to unlock your account.
              </p>
            </div>
          ) : (
            <>
              <button
                className="btn btn-block"
                onClick={handleComplete}
                disabled={submitting}
                style={{ height: '52px', fontSize: '1rem', background: 'var(--success)', borderColor: 'var(--success)', color: '#fff', boxShadow: '0 4px 14px rgba(34,197,94,0.4)' }}
              >
                {submitting ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                    <span className="spinner" style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></span>
                    Completing Signup...
                  </span>
                ) : isStaff ? (
                  'Enter the App (Staff)'
                ) : (
                  '🚀 Completed Signup — Enter the App'
                )}
              </button>
              <p style={{ color: 'var(--success)', fontSize: '0.8rem', margin: '12px 0 0', fontWeight: 700 }}>
                ✅ You've ticked every section. Click above to finish.
              </p>
            </>
          )}
        </SectionShell>

        <div style={{ textAlign: 'center', padding: '16px 0 40px' }}>
          <button onClick={handleSignOut} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.8rem', textDecoration: 'underline', cursor: 'pointer' }}>
            Sign out instead
          </button>
        </div>
      </div>
    </div>
  )
}