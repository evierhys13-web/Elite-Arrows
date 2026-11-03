import { Suspense, lazy, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/AuthContextInternal'
import { ThemeProvider, useTheme } from './context/ThemeContext'
import { ToastProvider } from './context/ToastContext'
import { BackgroundProvider } from './context/BackgroundContext'
import { SponsorshipProvider } from './context/SponsorshipContext'
import Sidebar from './components/Sidebar'
import BottomNav from './components/BottomNav'
import InstallPrompt from './components/InstallPrompt'
import DataRefreshToast from './components/DataRefreshToast'
import BackgroundDecor from './components/BackgroundDecor'
import NotificationPermissionPrompt from './components/NotificationPermissionPrompt'
import CookieConsentBanner from './components/CookieConsentBanner'
import { logPageView } from './utils/analytics'
import OnboardingTour, { useOnboarding } from './components/OnboardingTour'
import WhatsNewPopup, { useWhatsNew } from './components/WhatsNewPopup'
import SurveyPopup from './components/SurveyPopup'
import PullToRefresh from './components/PullToRefresh'
import ErrorBoundary from './components/ErrorBoundary'
import { Skeleton } from './components/Skeleton'
import { Capacitor } from '@capacitor/core'
import { ADMIN_EMAILS } from './config'

const Auth = lazy(() => import('./pages/Auth'))
const Welcome = lazy(() => import('./pages/Welcome'))
const Home = lazy(() => import('./pages/Home'))
const Subscription = lazy(() => import('./pages/Subscription'))
const Table = lazy(() => import('./pages/Table'))
const Results = lazy(() => import('./pages/Results'))
const MatchLog = lazy(() => import('./pages/MatchLog'))
const Players = lazy(() => import('./pages/Players'))
const SubmitResult = lazy(() => import('./pages/SubmitResult'))
const Chat = lazy(() => import('./pages/Chat'))
const Profile = lazy(() => import('./pages/Profile'))
const Settings = lazy(() => import('./pages/Settings'))
const Admin = lazy(() => import('./pages/Admin'))
const Contact = lazy(() => import('./pages/Contact'))
const Support = lazy(() => import('./pages/Support'))
const Tournaments = lazy(() => import('./pages/Tournaments'))
const Cups = lazy(() => import('./pages/Cups'))
const CupBracket = lazy(() => import('./pages/CupBrackets'))
const Leaderboards = lazy(() => import('./pages/Leaderboards'))
const Rewards = lazy(() => import('./pages/Rewards'))
const CupFixtures = lazy(() => import('./pages/CupFixtures'))
const Guide = lazy(() => import('./pages/Guide'))
const Rules = lazy(() => import('./pages/Rules'))
const Conduct = lazy(() => import('./pages/Conduct'))
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'))
const DeleteAccount = lazy(() => import('./pages/DeleteAccount'))
const Donations = lazy(() => import('./pages/Donations'))
const Install = lazy(() => import('./pages/Install'))
const Statistics = lazy(() => import('./pages/Statistics'))
const SeedData = lazy(() => import('./pages/SeedData'))
const SeasonManagement = lazy(() => import('./pages/SeasonManagement'))
const Notifications = lazy(() => import('./pages/Notifications'))
const Challenges = lazy(() => import('./pages/Challenges'))
const Giveaways = lazy(() => import('./pages/Giveaways'))
const LiveMatch = lazy(() => import('./pages/LiveMatch'))
const OpenLeague = lazy(() => import('./pages/OpenLeague'))
const DoublesLeague = lazy(() => import('./pages/DoublesLeague'))
const WeeklyChallenges = lazy(() => import('./pages/WeeklyChallenges'))
const PlayOnline = lazy(() => import('./pages/PlayOnline'))
const HallOfFame = lazy(() => import('./pages/HallOfFame'))
const News = lazy(() => import('./pages/News'))
const Suggestions = lazy(() => import('./pages/Suggestions'))
const LeaguePage = lazy(() => import('./pages/LeaguePage'))
const PlayerOfMonth = lazy(() => import('./pages/PlayerOfMonth'))

const SPLASH_STATUS = {
  account: 'Signing you in',
  roster: 'Loading player roster',
  results: 'Loading match results',
  seasons: 'Loading season data',
  fixtures: 'Loading fixtures',
  settings: 'Loading league settings',
  news: 'Loading league news',
  cups: 'Loading cup data'
}

function DartboardMark() {
  const ticks = Array.from({ length: 20 }, (_, i) => {
    const angle = (i * 18 * Math.PI) / 180
    const x1 = 60 + Math.cos(angle) * 45
    const y1 = 60 + Math.sin(angle) * 45
    const x2 = 60 + Math.cos(angle) * 56
    const y2 = 60 + Math.sin(angle) * 56
    return (
      <line
        key={i}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="rgba(226,232,240,0.32)"
        strokeWidth="1"
      />
    )
  })

  return (
    <div className="splash-board" aria-hidden="true">
      <span className="splash-board-glow" />
      <svg viewBox="0 0 120 120" width="132" height="132">
        <defs>
          <radialGradient id="splash-board-face" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#111827" />
            <stop offset="100%" stopColor="#05070d" />
          </radialGradient>
          <linearGradient id="splash-dart-shaft" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#f8fafc" />
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r="58" fill="url(#splash-board-face)" stroke="#fbbf24" strokeWidth="1.5" />
        <circle cx="60" cy="60" r="50" fill="none" stroke="#38bdf8" strokeWidth="2" opacity="0.45" />
        <circle cx="60" cy="60" r="38" fill="none" stroke="rgba(226,232,240,0.25)" strokeWidth="1" />
        <g>{ticks}</g>
        <circle cx="60" cy="60" r="31" fill="none" stroke="#22c55e" strokeWidth="4" opacity="0.55" />
        <circle cx="60" cy="60" r="18" fill="none" stroke="#ef4444" strokeWidth="5" opacity="0.75" />
        <circle cx="60" cy="60" r="10" fill="#dc2626" />
        <circle cx="60" cy="60" r="3.5" fill="#fbbf24" />
        <g transform="rotate(-38 60 60)">
          <rect x="63" y="58.3" width="34" height="3.4" rx="1.7" fill="url(#splash-dart-shaft)" />
          <rect x="66" y="57.4" width="12" height="5.2" rx="2" fill="#e2e8f0" />
          <path d="M63 56.5 L60 60 L63 63.5 Z" fill="#fbbf24" />
          <path d="M97 55.5 L108 60 L97 64.5 Z" fill="#38bdf8" />
        </g>
      </svg>
    </div>
  )
}

function LoadingScreen({ progress, label = 'Loading league data', showRefresh = false, testID }) {
  const isDeterminate = typeof progress === 'number'
  const value = Math.max(0, Math.min(100, isDeterminate ? progress : 0))

  return (
    <div
      className="splash-screen"
      data-testid={testID}
      role="status"
      aria-live="polite"
    >
      <div className="splash-grid" />
      <div className="splash-inner">
        <DartboardMark />
        <div className="splash-brand">
          <h1 className="splash-title">Elite Arrows</h1>
          <p className="splash-subtitle">Darts League</p>
        </div>
        <div
          className="splash-track"
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={isDeterminate ? value : undefined}
        >
          <div
            className={`splash-fill${isDeterminate ? '' : ' splash-fill-indeterminate'}`}
            style={isDeterminate ? { width: `${value}%` } : undefined}
          />
        </div>
        <div className="splash-meta">
          <span>{label}</span>
          {isDeterminate && <span className="splash-pct">{value}%</span>}
        </div>
        {showRefresh && (
          <div className="splash-help animate-fade-in">
            <span>Still loading?</span>
            <button className="splash-help-btn" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function PageLoader({ label = 'Loading league data' }) {
  const [showRefresh, setShowRefresh] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowRefresh(true)
    }, 8000)
    return () => clearTimeout(timer)
  }, [])

  return <LoadingScreen label={label} showRefresh={showRefresh} />
}

// Shown once on a cold page load so the realtime listeners have a moment to
// hydrate fresh data before content paints (avoids flashing stale cache).
// It never blocks longer than MAX_SPLASH_MS, so a slow/offline network can't
// trap the user on the loading screen.
const MIN_SPLASH_MS = 450
const SHOW_HELP_MS = 5000
const MAX_SPLASH_MS = 9000

function StartupSplash({ children }) {
  const {
    user,
    loading,
    isAuthenticated,
    newsLoaded,
    usersLoaded,
    resultsLoaded,
    fixturesLoaded,
    seasonsLoaded,
    cupsLoaded,
    adminDataLoaded
  } = useAuth()
  const [minElapsed, setMinElapsed] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [maxElapsed, setMaxElapsed] = useState(false)

  useEffect(() => {
    setMinElapsed(false)
    setShowHelp(false)
    setMaxElapsed(false)
    const minTimer = setTimeout(() => setMinElapsed(true), MIN_SPLASH_MS)
    const helpTimer = setTimeout(() => setShowHelp(true), SHOW_HELP_MS)
    const maxTimer = setTimeout(() => setMaxElapsed(true), MAX_SPLASH_MS)
    return () => {
      clearTimeout(minTimer)
      clearTimeout(helpTimer)
      clearTimeout(maxTimer)
    }
  }, [isAuthenticated, user?.id])

  // Each flag flips when its Firestore listener responds, including for empty
  // collections and permission errors. That means the splash no longer ends
  // while results, fixtures, cups or settings are still arriving.
  const checks = [
    { id: 'account', ready: !loading },
    { id: 'roster', ready: usersLoaded },
    { id: 'results', ready: resultsLoaded },
    { id: 'seasons', ready: seasonsLoaded },
    { id: 'fixtures', ready: fixturesLoaded },
    { id: 'settings', ready: adminDataLoaded },
    { id: 'news', ready: newsLoaded },
    { id: 'cups', ready: cupsLoaded }
  ]

  // An unauthenticated visitor only needs the auth handshake and news; the
  // league collections do not exist for them until they sign in.
  const required = isAuthenticated
    ? ['account', 'roster', 'results', 'seasons', 'fixtures', 'settings', 'news', 'cups']
    : ['account', 'news']
  const activeChecks = checks.filter(c => required.includes(c.id))
  const resolved = activeChecks.filter(c => c.ready).length
  const progress = Math.round((resolved / activeChecks.length) * 100)
  const pending = activeChecks.find(c => !c.ready)
  const statusLabel = pending ? SPLASH_STATUS[pending.id] : 'Finalising the lineup'
  const ready = maxElapsed || (minElapsed && resolved === activeChecks.length)

  if (ready) return children

  return (
    <LoadingScreen
      testID="startup-splash"
      progress={progress}
      label={statusLabel}
      showRefresh={showHelp && !ready}
    />
  )
}

function isOnboardingPending(user) {
  const isEmailAdmin = user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase())
  const isAdmin = isEmailAdmin || user?.isAdmin === true || user?.isTournamentAdmin === true || user?.isCupAdmin === true
  if (isAdmin) return false
  return user?.onboardingComplete === false
}

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading, user } = useAuth()
  const location = useLocation()

  if (loading) {
    return <PageLoader />
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />
  }

  const needsOnboarding = user?.isGuest ? false : isOnboardingPending(user)
  const isOnWelcome = location.pathname === '/welcome'

  if (needsOnboarding && !isOnWelcome) {
    return <Navigate to="/welcome" replace />
  }

  if (!needsOnboarding && isOnWelcome) {
    return <Navigate to="/home" replace />
  }

  return children
}

function MemberOnlyRoute({ children }) {
  return children
}

function SubscribedRoute({ children }) {
  const { user, isAuthenticated, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  if (loading) {
    return <PageLoader />
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />
  }

  if (user?.isGuest) {
    return children
  }

  if (isOnboardingPending(user) && location.pathname !== '/welcome') {
    return <Navigate to="/welcome" replace />
  }

  const isFreeTier = !user?.division || user?.division === 'Unassigned'
  const isEmailAdmin = ADMIN_EMAILS.includes(user?.email?.toLowerCase())
  const isDbAdmin = user?.isAdmin === true
  const isAdmin = isEmailAdmin || isDbAdmin
  const isSubscribed = user?.isSubscribed === true

  if (!isAdmin && !isSubscribed && isFreeTier) {
    return (
      <div
        style={{
          padding: '40px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '50vh'
        }}
      >
        <div
          style={{
            background: 'var(--bg-secondary)',
            padding: '30px',
            borderRadius: '12px',
            maxWidth: '400px'
          }}
        >
          <h2 style={{ color: 'var(--accent-cyan)', marginBottom: '15px' }}>Full Access Required</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
            You need an Elite Arrows Pass subscription to access this feature.
          </p>
          <button
            className="btn btn-primary btn-block"
            onClick={() => navigate('/subscription')}
            style={{ marginBottom: '10px' }}
          >
            Get Full Access - Subscribe Now
          </button>
          <button
            className="btn btn-secondary btn-block"
            onClick={() => navigate('/home')}
          >
            Go Home
          </button>
        </div>
      </div>
    )
  }

  return children
}

function AdminRoute({ children }) {
  const { user, isAuthenticated, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  if (loading) {
    return <PageLoader />
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />
  }

  if (isOnboardingPending(user) && location.pathname !== '/welcome') {
    return <Navigate to="/welcome" replace />
  }

  const isEmailAdmin = user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase())
  const isAdmin = isEmailAdmin || user?.isAdmin || user?.isTournamentAdmin || user?.isCupAdmin

  if (!isAdmin) {
    return (
      <div
        style={{
          padding: '40px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '50vh'
        }}
      >
        <div
          style={{
            background: 'var(--bg-secondary)',
            padding: '30px',
            borderRadius: '12px',
            maxWidth: '400px'
          }}
        >
          <h2 style={{ color: 'var(--accent-cyan)', marginBottom: '15px' }}>Admin Access Required</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
            You need admin permissions to access this feature.
          </p>
          <button
            className="btn btn-secondary btn-block"
            onClick={() => navigate('/home')}
          >
            Go Home
          </button>
        </div>
      </div>
    )
  }

  return children
}

function AppLayout({ children }) {
  const { user, dataRefreshTrigger, adminData, forceFetchResults } = useAuth()
  const { showOnboarding, completeOnboarding } = useOnboarding()
  const { showWhatsNew } = useWhatsNew()
  const [whatsNewOpen, setWhatsNewOpen] = useState(showWhatsNew)
  const hasMaintenance = adminData?.isMaintenanceMode

  // Full reload rather than a data-only refresh: it pulls the latest build
  // from the service worker/network so stale bundles and stale data both go.
  const handleRefresh = () => window.location.reload()

  const isEmailAdmin = user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase())
  const isDbAdmin = user?.isAdmin || user?.isTournamentAdmin || user?.isCupAdmin
  const isAdmin = isEmailAdmin || isDbAdmin

  if (hasMaintenance && !isAdmin) {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '40px' }}>
        <div className="card glass" style={{ maxWidth: '480px', width: '100%', textAlign: 'center', padding: '40px 32px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔧</div>
          <h1 style={{ color: 'var(--accent-cyan)', fontSize: '1.5rem', marginBottom: '12px' }}>Under Maintenance</h1>
          <p style={{ color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '24px' }}>
            {adminData?.maintenanceMessage || 'The site is currently undergoing maintenance. Please check back soon.'}
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Follow our WhatsApp community for updates.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main id="main-content" className="main-content" tabIndex={-1}>
        <PullToRefresh onRefresh={async () => {
          if (forceFetchResults) await forceFetchResults()
        }}>
          <Suspense fallback={<PageLoader />}>
            {children}
          </Suspense>
        </PullToRefresh>
      </main>

      {hasMaintenance && (
        <div style={{
          background: 'var(--warning)',
          color: '#000',
          padding: '10px 16px',
          textAlign: 'center',
          fontSize: '0.75rem',
          fontWeight: 900,
          position: 'fixed',
          bottom: 'calc(var(--bottom-nav-height) + var(--safe-bottom))',
          left: 0,
          right: 0,
          zIndex: 1003,
          boxShadow: '0 -4px 15px rgba(0,0,0,0.3)',
          textTransform: 'uppercase',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}>
          <span>⚠️</span>
          {adminData.maintenanceMessage || 'Maintenance mode is active — players are locked out.'}
        </div>
      )}

      <BottomNav />
      <InstallPrompt />
      <button
        onClick={handleRefresh}
        title="Reload page"
        aria-label="Reload page"
        style={{
          position: 'fixed',
          top: '76px',
          right: '16px',
          zIndex: 9999,
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid var(--accent-cyan)',
          background: 'rgba(0,0,0,0.55)',
          color: 'var(--accent-cyan)',
          cursor: 'pointer',
          fontSize: '20px',
          boxShadow: '0 4px 15px rgba(0,212,255,0.25)'
        }}
      >
        <span style={{ display: 'inline-block' }}>⟳</span>
      </button>
      <DataRefreshToast refreshTrigger={dataRefreshTrigger} />
      <NotificationPermissionPrompt />
      {showOnboarding && <OnboardingTour onComplete={completeOnboarding} />}
      <WhatsNewPopup isOpen={whatsNewOpen} onClose={() => setWhatsNewOpen(false)} />
      <SurveyPopup />
    </div>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth" element={<Suspense fallback={<PageLoader />}><Auth /></Suspense>} />
      <Route path="/league/:leagueId" element={<Suspense fallback={<PageLoader />}><LeaguePage /></Suspense>} />
      <Route path="/welcome" element={<ProtectedRoute><Suspense fallback={<PageLoader />}><Welcome /></Suspense></ProtectedRoute>} />
      <Route path="/home" element={<ProtectedRoute><AppLayout><Home /></AppLayout></ProtectedRoute>} />
      <Route path="/subscription" element={<ProtectedRoute><AppLayout><Subscription /></AppLayout></ProtectedRoute>} />
      <Route path="/open-league" element={<ProtectedRoute><AppLayout><OpenLeague /></AppLayout></ProtectedRoute>} />
      <Route path="/doubles-league" element={<ProtectedRoute><AppLayout><DoublesLeague /></AppLayout></ProtectedRoute>} />
      <Route path="/table" element={<ProtectedRoute><AppLayout><Table /></AppLayout></ProtectedRoute>} />
      <Route path="/match-log" element={<ProtectedRoute><AppLayout><MatchLog /></AppLayout></ProtectedRoute>} />
      <Route path="/results" element={<ProtectedRoute><AppLayout><Results /></AppLayout></ProtectedRoute>} />
      <Route path="/players" element={<ProtectedRoute><AppLayout><Players /></AppLayout></ProtectedRoute>} />
      <Route path="/submit-result" element={<ProtectedRoute><MemberOnlyRoute><AppLayout><SubmitResult /></AppLayout></MemberOnlyRoute></ProtectedRoute>} />
      <Route path="/chat" element={<ProtectedRoute><MemberOnlyRoute><AppLayout><Chat /></AppLayout></MemberOnlyRoute></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><MemberOnlyRoute><AppLayout><Profile /></AppLayout></MemberOnlyRoute></ProtectedRoute>} />
      <Route path="/profile/:id" element={<ProtectedRoute><MemberOnlyRoute><AppLayout><Profile /></AppLayout></MemberOnlyRoute></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><MemberOnlyRoute><AppLayout><Settings /></AppLayout></MemberOnlyRoute></ProtectedRoute>} />
      <Route path="/contact" element={<ProtectedRoute><AppLayout><Contact /></AppLayout></ProtectedRoute>} />
      <Route path="/support" element={<ProtectedRoute><AppLayout><Support /></AppLayout></ProtectedRoute>} />
      <Route path="/tournaments" element={<ProtectedRoute><AppLayout><Tournaments /></AppLayout></ProtectedRoute>} />
      <Route path="/cups" element={<ProtectedRoute><AppLayout><Cups /></AppLayout></ProtectedRoute>} />
      <Route path="/cups/:cupId" element={<ProtectedRoute><AppLayout><CupBracket /></AppLayout></ProtectedRoute>} />
      <Route path="/leaderboards" element={<ProtectedRoute><AppLayout><Leaderboards /></AppLayout></ProtectedRoute>} />
      <Route path="/hall-of-fame" element={<ProtectedRoute><AppLayout><HallOfFame /></AppLayout></ProtectedRoute>} />
      <Route path="/player-of-month" element={<ProtectedRoute><AppLayout><PlayerOfMonth /></AppLayout></ProtectedRoute>} />
      <Route path="/news" element={<ProtectedRoute><AppLayout><News /></AppLayout></ProtectedRoute>} />
      <Route path="/suggestions" element={<ProtectedRoute><AppLayout><Suggestions /></AppLayout></ProtectedRoute>} />
      <Route path="/rewards" element={<ProtectedRoute><AppLayout><Rewards /></AppLayout></ProtectedRoute>} />
      <Route path="/cup-fixtures" element={<ProtectedRoute><AppLayout><CupFixtures /></AppLayout></ProtectedRoute>} />
      <Route path="/guide" element={<ProtectedRoute><AppLayout><Guide /></AppLayout></ProtectedRoute>} />
      <Route path="/rules" element={<ProtectedRoute><AppLayout><Rules /></AppLayout></ProtectedRoute>} />
      <Route path="/conduct" element={<ProtectedRoute><AppLayout><Conduct /></AppLayout></ProtectedRoute>} />
      <Route path="/privacy-policy" element={<ProtectedRoute><AppLayout><PrivacyPolicy /></AppLayout></ProtectedRoute>} />
      <Route path="/delete-account" element={<ProtectedRoute><AppLayout><DeleteAccount /></AppLayout></ProtectedRoute>} />
      <Route path="/donations" element={<ProtectedRoute><AppLayout><Donations /></AppLayout></ProtectedRoute>} />
      <Route path="/install" element={<ProtectedRoute><AppLayout><Install /></AppLayout></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute><AppLayout><Statistics /></AppLayout></ProtectedRoute>} />
      <Route path="/statistics" element={<ProtectedRoute><AppLayout><Statistics /></AppLayout></ProtectedRoute>} />
      <Route path="/statistics/:id" element={<ProtectedRoute><AppLayout><Statistics /></AppLayout></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><MemberOnlyRoute><AppLayout><Notifications /></AppLayout></MemberOnlyRoute></ProtectedRoute>} />
      <Route path="/live-match" element={<SubscribedRoute><AppLayout><LiveMatch /></AppLayout></SubscribedRoute>} />
      <Route path="/play-online" element={<SubscribedRoute><AppLayout><PlayOnline /></AppLayout></SubscribedRoute>} />
      <Route path="/challenges" element={<ProtectedRoute><MemberOnlyRoute><AppLayout><Challenges /></AppLayout></MemberOnlyRoute></ProtectedRoute>} />
      <Route path="/weekly-challenges" element={<ProtectedRoute><MemberOnlyRoute><AppLayout><WeeklyChallenges /></AppLayout></MemberOnlyRoute></ProtectedRoute>} />
      <Route path="/giveaways" element={<ProtectedRoute><MemberOnlyRoute><AppLayout><Giveaways /></AppLayout></MemberOnlyRoute></ProtectedRoute>} />
      <Route path="/season-management" element={<AdminRoute><AppLayout><SeasonManagement /></AppLayout></AdminRoute>} />
      <Route path="/seed-data" element={<AdminRoute><AppLayout><SeedData /></AppLayout></AdminRoute>} />
      <Route path="/admin" element={<AdminRoute><AppLayout><Admin /></AppLayout></AdminRoute>} />
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  )
}

function AppShell() {
  const { user } = useAuth()
  const { navMode } = useTheme()
  const location = useLocation()

  useEffect(() => {
    document.body.classList.remove('nav-mode-bottom', 'nav-mode-sidebar')
    document.body.classList.add(`nav-mode-${navMode}`)
  }, [navMode])

  useEffect(() => {
    logPageView(location.pathname)
  }, [location.pathname])

  return (
    <>
      <BackgroundDecor division={user?.division} />
      <StartupSplash>
        <AppRoutes />
      </StartupSplash>
      <CookieConsentBanner />
    </>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <BrowserRouter>
              <BackgroundProvider>
                <SponsorshipProvider>
                  <AppShell />
                </SponsorshipProvider>
              </BackgroundProvider>
            </BrowserRouter>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
