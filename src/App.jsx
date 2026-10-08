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
import ProgressTrackerPopup from './components/ProgressTrackerPopup'
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
const PracticeHub = lazy(() => import('./pages/PracticeHub'))
const PracticeGame = lazy(() => import('./pages/PracticeGame'))
const OpenLeague = lazy(() => import('./pages/OpenLeague'))
const ProgressTracker = lazy(() => import('./pages/ProgressTracker'))
const WeeklyChallenges = lazy(() => import('./pages/WeeklyChallenges'))
const PlayOnline = lazy(() => import('./pages/PlayOnline'))
const HallOfFame = lazy(() => import('./pages/HallOfFame'))
const News = lazy(() => import('./pages/News'))
const Suggestions = lazy(() => import('./pages/Suggestions'))
const TrainingHub = lazy(() => import('./pages/TrainingHub'))
const TrainingCourse = lazy(() => import('./pages/TrainingCourse'))
const TrainingLesson = lazy(() => import('./pages/TrainingLesson'))
const TrainingDrills = lazy(() => import('./pages/TrainingDrills'))
const TrainingTips = lazy(() => import('./pages/TrainingTips'))
const LeaguePage = lazy(() => import('./pages/LeaguePage'))
const PlayerOfMonth = lazy(() => import('./pages/PlayerOfMonth'))

function PageLoader({ label = 'Loading Elite Arrows...' }) {
  const [showRefresh, setShowRefresh] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowRefresh(true)
    }, 8000) // Show refresh after 8s
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="loading" style={{
      padding: '40px',
      textAlign: 'center',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-primary)'
    }}>
      <div className="spinner" style={{ width: '40px', height: '40px', marginBottom: '20px' }}></div>
      <h2 style={{ color: 'white' }}>{label}</h2>

      {showRefresh && (
        <div className="animate-fade-in" style={{ marginTop: '30px' }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: '15px', maxWidth: '300px' }}>
            Taking longer than usual? Stale data might be causing a delay.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => window.location.reload(true)}
          >
            Refresh App
          </button>
        </div>
      )}
    </div>
  )
}

// Shown once on a cold page load so the realtime listeners have a moment to
// hydrate fresh data before content paints (avoids flashing stale cache).
// It never blocks longer than MAX_SPLASH_MS, so a slow/offline network can't
// trap the user on the loading screen.
const MIN_SPLASH_MS = 450
const SHOW_HELP_MS = 4000
const MAX_SPLASH_MS = 7000

function StartupSplash({ children }) {
  const { loading, isAuthenticated, allUsers, results, seasons, fixtures, adminData, cups, newsLoaded } = useAuth()
  const [minElapsed, setMinElapsed] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [maxElapsed, setMaxElapsed] = useState(false)

  useEffect(() => {
    const minTimer = setTimeout(() => setMinElapsed(true), MIN_SPLASH_MS)
    const helpTimer = setTimeout(() => setShowHelp(true), SHOW_HELP_MS)
    const maxTimer = setTimeout(() => setMaxElapsed(true), MAX_SPLASH_MS)
    return () => {
      clearTimeout(minTimer)
      clearTimeout(helpTimer)
      clearTimeout(maxTimer)
    }
  }, [])

  // Wait for each collection rather than "any data at all". Previously this
  // only checked users OR results, so the splash cleared while seasons,
  // fixtures and adminData were still in flight and pages popped in blank.
  const checks = [
    { id: 'account', label: 'Your account', ready: !loading },
    { id: 'roster', label: 'Player roster', ready: (allUsers?.length || 0) > 0 },
    { id: 'results', label: 'Match results', ready: (results?.length || 0) > 0 },
    { id: 'seasons', label: 'Season & divisions', ready: (seasons?.length || 0) > 0 },
    { id: 'fixtures', label: 'Fixtures', ready: (fixtures?.length || 0) > 0 },
    { id: 'settings', label: 'Season settings', ready: Boolean(adminData?.currentSeason) },
    { id: 'news', label: 'News & updates', ready: newsLoaded === true },
    { id: 'cups', label: 'Cups', ready: (cups?.length || 0) > 0 }
  ]

  // News is an explicit hard gate: its loaded flag flips on snapshot arrival
  // (including an empty collection), so it can never block on length alone.
  const required = isAuthenticated
    ? ['account', 'roster', 'seasons', 'settings', 'news']
    : ['account', 'news']
  const resolved = checks.filter(c => c.ready).length
  // Only the auth handshake gates a guest. Roster/seasons/settings are
  // meaningless until someone signs in, so applying those gates to a guest
  // always stalls them out at the timeout.
  const coreReady = required.every(id => checks.find(c => c.id === id)?.ready)
  const progress = Math.round((resolved / checks.length) * 100)

  // Core gates first (account, roster, seasons, settings), then require at
  // least one content collection to have arrived. A blanket "6 of 8" rule
  // stalls accounts that legitimately have no news or cups yet.
  const contentReady = ['results', 'fixtures', 'news', 'cups'].some(id => checks.find(c => c.id === id)?.ready)
  const ready = maxElapsed || (minElapsed && coreReady && (!isAuthenticated || contentReady))

  if (ready) return children

  return (
    <div
      className="loading"
      data-testid="startup-splash"
      style={{
        padding: '40px 24px',
        textAlign: 'center',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)'
      }}
    >
      <div className="auth-logo" style={{ marginBottom: '8px' }}>
        <h1 className="text-gradient" style={{ letterSpacing: '-0.02em' }}>Elite Arrows</h1>
        <p>Everything loaded. Nothing skipped.</p>
      </div>

      <div
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Loading app data"
        style={{
          width: '240px',
          height: '6px',
          borderRadius: '999px',
          background: 'rgba(255,255,255,0.08)',
          overflow: 'hidden',
          margin: '24px 0 6px'
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: '100%',
            borderRadius: '999px',
            background: 'linear-gradient(to right, var(--accent-primary), var(--accent-cyan))',
            transition: 'width 300ms ease'
          }}
        />
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
        {progress}% • {resolved} of {checks.length}
      </div>

      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'left', minWidth: '240px' }}>
        {checks.map(c => (
          <li key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', color: c.ready ? 'var(--success)' : 'var(--text-muted)', opacity: c.ready ? 1 : 0.6 }}>
            <span aria-hidden="true" style={{ width: '14px', display: 'inline-block' }}>
              {c.ready ? '✓' : ''}
            </span>
            <span className="spinner" style={{ width: '10px', height: '10px', display: c.ready ? 'none' : 'inline-block', border: '1.5px solid rgba(255,255,255,0.25)', borderTopColor: 'var(--accent-cyan)' }} />
            {c.label}
          </li>
        ))}
      </ul>

      {showHelp && !ready && (
        <div className="animate-fade-in" style={{ marginTop: '30px' }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: '15px', maxWidth: '300px' }}>
            Taking longer than usual? Stale data might be causing a delay.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => window.location.reload(true)}
          >
            Refresh App
          </button>
        </div>
      )}
    </div>
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

function TrainingRoute({ children }) {
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

  const isEmailAdmin = user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase())
  const isAdmin = isEmailAdmin || user?.isAdmin === true
  const hasPass = user?.trainingPassActive === true
  const pending = user?.trainingPassPaymentPending === true

  if (!isAdmin && !hasPass) {
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
            maxWidth: '420px'
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🎯</div>
          <h2 style={{ color: 'var(--accent-cyan)', marginBottom: '12px' }}>Training Pass Required</h2>
          {pending ? (
            <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
              Your Training Pass payment is awaiting admin approval. Once verified, the full Academy unlocks automatically.
            </p>
          ) : (
            <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
              Unlock the full Elite Arrows Academy — courses, drill library and coach tips — for £2.99/month with your own Training Pass.
            </p>
          )}
          {!pending && (
            <button
              className="btn btn-primary btn-block"
              onClick={() => navigate('/subscription?tab=training')}
              style={{ marginBottom: '10px' }}
            >
              Get Training Pass
            </button>
          )}
          <button
            className="btn btn-secondary btn-block"
            onClick={() => navigate('/training')}
            style={{ marginBottom: '10px' }}
          >
            Back to Academy
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

function AppLayout({ children }) {
  const { user, dataRefreshTrigger, adminData, forceFetchResults, triggerDataRefresh } = useAuth()
  const { showOnboarding, completeOnboarding } = useOnboarding()
  const { showWhatsNew } = useWhatsNew()
  const [whatsNewOpen, setWhatsNewOpen] = useState(showWhatsNew)
  const [refreshing, setRefreshing] = useState(false)
  const hasMaintenance = adminData?.isMaintenanceMode

  const handleRefresh = () => {
    if (refreshing) return
    setRefreshing(true)
    triggerDataRefresh('all')
    setTimeout(() => setRefreshing(false), 1200)
  }

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
        title="Refresh all data"
        aria-label="Refresh all data"
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
          boxShadow: '0 4px 15px rgba(0,212,255,0.25)',
          opacity: refreshing ? 0.75 : 1
        }}
      >
        <span style={{ display: 'inline-block', animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }}>⟳</span>
      </button>
      <DataRefreshToast refreshTrigger={dataRefreshTrigger} />
      <NotificationPermissionPrompt />
      {showOnboarding && <OnboardingTour onComplete={completeOnboarding} />}
      <WhatsNewPopup isOpen={whatsNewOpen} onClose={() => setWhatsNewOpen(false)} />
      <ProgressTrackerPopup />
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
      <Route path="/practice" element={<ProtectedRoute><MemberOnlyRoute><AppLayout><PracticeHub /></AppLayout></MemberOnlyRoute></ProtectedRoute>} />
      <Route path="/progress-tracker" element={<ProtectedRoute><MemberOnlyRoute><AppLayout><PracticeHub /></AppLayout></MemberOnlyRoute></ProtectedRoute>} />
      <Route path="/practice/:modeId" element={<ProtectedRoute><MemberOnlyRoute><AppLayout><PracticeGame /></AppLayout></MemberOnlyRoute></ProtectedRoute>} />
      <Route path="/challenges" element={<ProtectedRoute><MemberOnlyRoute><AppLayout><Challenges /></AppLayout></MemberOnlyRoute></ProtectedRoute>} />
      <Route path="/weekly-challenges" element={<ProtectedRoute><MemberOnlyRoute><AppLayout><WeeklyChallenges /></AppLayout></MemberOnlyRoute></ProtectedRoute>} />
      <Route path="/giveaways" element={<ProtectedRoute><MemberOnlyRoute><AppLayout><Giveaways /></AppLayout></MemberOnlyRoute></ProtectedRoute>} />
      <Route path="/training" element={<ProtectedRoute><AppLayout><TrainingHub /></AppLayout></ProtectedRoute>} />
      <Route path="/training/course/:courseId" element={<TrainingRoute><AppLayout><TrainingCourse /></AppLayout></TrainingRoute>} />
      <Route path="/training/lesson/:lessonId" element={<TrainingRoute><AppLayout><TrainingLesson /></AppLayout></TrainingRoute>} />
      <Route path="/training/drills" element={<TrainingRoute><AppLayout><TrainingDrills /></AppLayout></TrainingRoute>} />
      <Route path="/training/tips" element={<TrainingRoute><AppLayout><TrainingTips /></AppLayout></TrainingRoute>} />
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
