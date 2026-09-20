import { useState, useEffect, useRef, useCallback } from 'react'
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

function formatDate(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

export default function Welcome() {
  const { user, adminData, completeOnboarding, getSeasons, signOut } = useAuth()
  const navigate = useNavigate()
  const [viewed, setViewed] = useState({})
  const [whatsappJoined, setWhatsappJoined] = useState(false)
  const [rulesAccepted, setRulesAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const sectionRefs = useRef({})

  const isStaff = user?.isAdmin || user?.isTournamentAdmin || user?.isCupAdmin ||
    (user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase()))
  const alreadyComplete = user?.onboardingComplete === true

  const content = adminData?.onboardingContent || {}
  const whatsappLink = adminData?.whatsappGroupLink || 'https://chat.whatsapp.com/DcKb9AfesVBGjcFVwErEor?s=cl&p=a&mlu=4&ilr=4'

  const activeSeason = (getSeasons() || []).find(s => s.name === adminData?.currentSeason) ||
    (getSeasons() || [])[0]
  const seasonStart = adminData?.seasonStartDate || activeSeason?.startDate || null
  const seasonEnd = adminData?.seasonEndDate || activeSeason?.endDate || null
  const seasonName = adminData?.currentSeason || activeSeason?.name || 'the upcoming season'

  const allViewed = SECTION_IDS.every(id => viewed[id])
  const canComplete = (isStaff || alreadyComplete) || (allViewed && whatsappJoined && rulesAccepted)
  const viewedCount = SECTION_IDS.filter(id => viewed[id]).length

  const setSectionRef = useCallback((id) => (el) => {
    if (el) sectionRefs.current[id] = el
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('data-section')
          setViewed((prev) => (prev[id] ? prev : { ...prev, [id]: true }))
        }
      })
    }, { rootMargin: '0px 0px -20% 0px', threshold: 0 })

    Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el))
    return () => observer.disconnect()
  }, [])

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

  const SectionShell = ({ id, num, children, viewedFlag }) => (
    <section
      data-section={id}
      ref={setSectionRef(id)}
      className={`glass ${viewedFlag ? 'is-viewed' : ''}`}
      style={{ padding: '0', borderRadius: '20px', overflow: 'hidden', marginBottom: '18px' }}
    >
      <div style={{ padding: '24px', display: 'flex', gap: '18px', alignItems: 'flex-start' }}>
        <div className="section-num">{num}</div>
        <div style={{ flex: 1 }}>{children}</div>
      </div>
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
        section.is-viewed { border-color: rgba(34,197,94,0.5) !important; }
        section.is-viewed .section-num { color: var(--success); border-color: var(--success); background: rgba(34,197,94,0.12); }
      `}</style>

      <div className="welcome-progress-track">
        <div style={{ maxWidth: '720px', margin: '0 auto', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700 }}>
            SIGNUP — {viewedCount}/{SECTION_IDS.length} sections read
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            {SECTION_IDS.map(id => (
              <div key={id} style={{
                width: '10px', height: '10px', borderRadius: '50%',
                background: viewed[id] ? 'var(--success)' : 'rgba(255,255,255,0.15)',
                transition: 'background 0.3s'
              }} />
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '24px 16px 60px' }}>
        {/* SECTION 1 — WELCOME */}
        <section data-section="welcome" ref={setSectionRef('welcome')} className={`glass ${viewed.welcome ? 'is-viewed' : ''}`} style={{ padding: '0', borderRadius: '20px', overflow: 'hidden', marginBottom: '18px' }}>
          <div style={{
            padding: '36px 24px', textAlign: 'center',
            background: 'linear-gradient(135deg, rgba(0,212,255,0.18), rgba(251,191,36,0.12))'
          }}>
            <div style={{ width: '84px', height: '84px', margin: '0 auto 16px', borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--accent-cyan)', boxShadow: '0 8px 30px rgba(0,212,255,0.25)' }}>
              <img src="/elite arrows.jpg" alt="Elite Arrows" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <h1 className="text-gradient" style={{ fontSize: '2.1rem', margin: '0 0 8px' }}>{adminData?.welcomeHeader || 'Welcome to Elite Arrows'}</h1>
            <p style={{ color: 'var(--text-muted)', lineHeight: '1.7', maxWidth: '560px', margin: '0 auto' }}>
              {adminData?.welcomeMessage || 'You are one step away from joining the league.'}
            </p>
            {user?.username && <p style={{ color: 'var(--accent-cyan)', fontWeight: 800, marginTop: '14px' }}>Hi, {user.username}! 👋</p>}
          </div>
        </section>

        {/* SECTION 2 — SEASON DATES */}
        <SectionShell id="season" num={2} viewedFlag={viewed.season}>
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
        <SectionShell id="league" num={3} viewedFlag={viewed.league}>
          <h2 style={{ margin: '0 0 8px', color: 'var(--accent-cyan)', fontSize: '1.15rem' }}>
            {content?.howLeagueWorks?.title || 'How The League Works'}
          </h2>
          <p style={{ color: 'var(--text-muted)', lineHeight: '1.7', fontSize: '0.9rem', margin: 0 }}>
            {content?.howLeagueWorks?.body}
          </p>
        </SectionShell>

        {/* SECTION 4 — PLAYER RESPONSIBILITIES */}
        <SectionShell id="responsibilities" num={4} viewedFlag={viewed.responsibilities}>
          <h2 style={{ margin: '0 0 8px', color: 'var(--accent-cyan)', fontSize: '1.15rem' }}>
            {content?.responsibilities?.title || 'Your Responsibilities'}
          </h2>
          <p style={{ color: 'var(--text-muted)', lineHeight: '1.7', fontSize: '0.9rem', margin: 0 }}>
            {content?.responsibilities?.body}
          </p>
        </SectionShell>

        {/* SECTION 5 — WHATSAPP */}
        <SectionShell id="whatsapp" num={5} viewedFlag={viewed.whatsapp}>
          <h2 style={{ margin: '0 0 8px', color: 'var(--accent-cyan)', fontSize: '1.15rem' }}>💬 Join the Official WhatsApp Group</h2>
          <p style={{ color: 'var(--text-muted)', lineHeight: '1.6', fontSize: '0.9rem' }}>
            {adminData?.whatsappText || 'All games are arranged in the official WhatsApp community.'}
          </p>
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setWhatsappJoined(true)}
            className={`btn btn-block ${whatsappJoined ? 'btn-success' : ''}`}
            style={{
              textDecoration: 'none',
              background: whatsappJoined ? 'var(--success)' : '#25D366',
              borderColor: '#25D366', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '8px'
            }}
          >
            <span style={{ fontSize: '1.2rem' }}>💬</span>
            {whatsappJoined ? '✓ Joined WhatsApp' : 'Open & Join the WhatsApp Group'}
          </a>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '10px 0 0', lineHeight: '1.5' }}>
            {whatsappJoined
              ? '✅ Confirmed — you can arrange games with your division here.'
              : '⚠️ Open the link above and join the group to complete this step.'}
          </p>
        </SectionShell>

        {/* SECTION 6 — LEAGUE RULES */}
        <SectionShell id="rules" num={6} viewedFlag={viewed.rules}>
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
          <p style={{ fontSize: '0.85rem', margin: '14px 0 12px' }}>
            Read the full official rulebook: <a href="#/rules" onClick={(e) => { e.preventDefault(); navigate('/rules') }} style={{ color: 'var(--accent-cyan)', fontWeight: 800 }}>League Rules →</a>
          </p>
          <label className="checkbox-group" style={{
            alignItems: 'flex-start', color: 'var(--text-primary)', lineHeight: '1.5',
            border: `1px solid ${rulesAccepted ? 'var(--success)' : 'var(--border)'}`,
            borderRadius: '10px', padding: '12px',
            background: rulesAccepted ? 'rgba(34,197,94,0.08)' : 'rgba(0,0,0,0.15)'
          }}>
            <input
              type="checkbox"
              checked={rulesAccepted}
              onChange={(e) => setRulesAccepted(e.target.checked)}
              style={{ marginTop: '4px' }}
            />
            <span>I have read and accept the <strong>League Rules</strong> and agree to the <strong>Code of Conduct</strong>.</span>
          </label>
        </SectionShell>

        {/* SECTION 7 — WHAT HAPPENS NEXT */}
        <SectionShell id="next" num={7} viewedFlag={viewed.next}>
          <h2 style={{ margin: '0 0 8px', color: 'var(--accent-cyan)', fontSize: '1.15rem' }}>
            {content?.whatHappensNext?.title || 'What Happens Next'}
          </h2>
          <p style={{ color: 'var(--text-muted)', lineHeight: '1.7', fontSize: '0.9rem', margin: 0 }}>
            {content?.whatHappensNext?.body}
          </p>
        </SectionShell>

        {/* SECTION 8 — BRANDING */}
        <SectionShell id="branding" num={8} viewedFlag={viewed.branding}>
          <h2 style={{ margin: '0 0 8px', color: 'var(--accent-cyan)', fontSize: '1.15rem' }}>
            🏹 About {adminData?.companyName || 'Elite Arrows'}
          </h2>
          <p style={{ color: 'var(--text-muted)', lineHeight: '1.7', fontSize: '0.9rem', margin: 0 }}>
            {adminData?.brandingText || 'Elite Arrows is a competitive online darts league.'}
          </p>
        </SectionShell>

        {/* SECTION 9 — FINAL MESSAGE + COMPLETE */}
        <section data-section="final" ref={setSectionRef('final')} style={{ padding: '0', borderRadius: '20px', overflow: 'hidden', marginBottom: '18px' }}>
          <div className={`glass ${viewed.final ? 'is-viewed' : ''}`} style={{
            padding: '28px', textAlign: 'center',
            border: `2px solid ${canComplete ? 'var(--success)' : 'var(--border)'}`,
            background: canComplete ? 'rgba(34,197,94,0.08)' : 'rgba(0,0,0,0.2)'
          }}>
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
                      background: viewed[id] ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
                      color: viewed[id] ? 'var(--success)' : 'var(--text-muted)',
                      border: `1px solid ${viewed[id] ? 'var(--success)' : 'var(--border)'}`
                    }}>
                      {viewed[id] ? '✓' : '•'} {SECTION_LABELS[id]}
                    </span>
                  ))}
                  {!whatsappJoined && <span className="welcome-chip" style={{ background: 'rgba(37,211,102,0.1)', color: '#25D366', border: '1px solid rgba(37,211,102,0.4)' }}>• Join the WhatsApp group</span>}
                  {!rulesAccepted && <span className="welcome-chip" style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.4)' }}>• Accept the rules</span>}
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '16px 0 0' }}>
                  Read through every section above, join the WhatsApp group and accept the rules to unlock your account.
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
                  ✅ You've read everything and accepted the rules. Click above to finish.
                </p>
              </>
            )}
          </div>
        </section>

        <div style={{ textAlign: 'center', padding: '16px 0 40px' }}>
          <button onClick={handleSignOut} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.8rem', textDecoration: 'underline', cursor: 'pointer' }}>
            Sign out instead
          </button>
        </div>
      </div>
    </div>
  )
}