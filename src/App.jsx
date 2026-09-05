import { Suspense, lazy, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/AuthContextInternal'
import { ThemeProvider, useTheme } from './context/ThemeContext'
import { ToastProvider } from './context/ToastContext'
import Sidebar from './components/Sidebar'
import BottomNav from './components/BottomNav'
import InstallPrompt from './components/InstallPrompt'
import DataRefreshToast from './components/DataRefreshToast'
import BackgroundDecor from './components/BackgroundDecor'
import NotificationPermissionPrompt from './components/NotificationPermissionPrompt'
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
const DailyChallenges = lazy(() => import('./pages/DailyChallenges'))
const PlayOnline = lazy(() => import('./pages/PlayOnline'))
const HallOfFame = lazy(() => import('./pages/HallOfFame'))
const News = lazy(() => import('./pages/News'))
const Suggestions = lazy(() => import('./pages/Suggestions'))
const TrainingHub = lazy(() => import('./pages/TrainingHub'))
const TrainingCourse = lazy(() => import('./pages/TrainingCourse'))
const TrainingLesson = lazy(() => import('./pages/TrainingLesson'))
const TrainingDrills = lazy(() => import('./pages/TrainingDrills'))
const TrainingTips = lazy(() => import('./pages/TrainingTips'))

function PageLoader() {
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
      <h2 style={{ color: 'white' }}>Loading Elite Arrows...</h2>

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

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return <PageLoader />
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />
  }

  return children
}

function SubscribedRoute({ children }) {
  const { user, isAuthenticated, loading } = useAuth()
  const navigate = useNavigate()

  if (loading) {
    return <PageLoader />
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />
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

  if (loading) {
    return <PageLoader />
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />
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

  if (loading) {
    return <PageLoader />
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />
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
  const { user, dataRefreshTrigger, adminData, forceFetchResults } = useAuth()
  const { showOnboarding, completeOnboarding } = useOnboarding()
  const { showWhatsNew } = useWhatsNew()
  const [whatsNewOpen, setWhatsNewOpen] = useState(showWhatsNew)
  const hasMaintenance = adminData?.isMaintenanceMode

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
      <Route path="/home" element={<ProtectedRoute><AppLayout><Home /></AppLayout></ProtectedRoute>} />
      <Route path="/subscription" element={<ProtectedRoute><AppLayout><Subscription /></AppLayout></ProtectedRoute>} />
      <Route path="/open-league" element={<ProtectedRoute><AppLayout><OpenLeague /></AppLayout></ProtectedRoute>} />
      <Route path="/table" element={<ProtectedRoute><AppLayout><Table /></AppLayout></ProtectedRoute>} />
      <Route path="/match-log" element={<ProtectedRoute><AppLayout><MatchLog /></AppLayout></ProtectedRoute>} />
      <Route path="/results" element={<ProtectedRoute><AppLayout><Results /></AppLayout></ProtectedRoute>} />
      <Route path="/players" element={<ProtectedRoute><AppLayout><Players /></AppLayout></ProtectedRoute>} />
      <Route path="/submit-result" element={<ProtectedRoute><AppLayout><SubmitResult /></AppLayout></ProtectedRoute>} />
      <Route path="/chat" element={<ProtectedRoute><AppLayout><Chat /></AppLayout></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><AppLayout><Profile /></AppLayout></ProtectedRoute>} />
      <Route path="/profile/:id" element={<ProtectedRoute><AppLayout><Profile /></AppLayout></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><AppLayout><Settings /></AppLayout></ProtectedRoute>} />
      <Route path="/contact" element={<ProtectedRoute><AppLayout><Contact /></AppLayout></ProtectedRoute>} />
      <Route path="/support" element={<ProtectedRoute><AppLayout><Support /></AppLayout></ProtectedRoute>} />
      <Route path="/tournaments" element={<ProtectedRoute><AppLayout><Tournaments /></AppLayout></ProtectedRoute>} />
      <Route path="/cups" element={<ProtectedRoute><AppLayout><Cups /></AppLayout></ProtectedRoute>} />
      <Route path="/cups/:cupId" element={<ProtectedRoute><AppLayout><CupBracket /></AppLayout></ProtectedRoute>} />
      <Route path="/leaderboards" element={<ProtectedRoute><AppLayout><Leaderboards /></AppLayout></ProtectedRoute>} />
      <Route path="/hall-of-fame" element={<ProtectedRoute><AppLayout><HallOfFame /></AppLayout></ProtectedRoute>} />
      <Route path="/news" element={<ProtectedRoute><AppLayout><News /></AppLayout></ProtectedRoute>} />
      <Route path="/suggestions" element={<ProtectedRoute><AppLayout><Suggestions /></AppLayout></ProtectedRoute>} />
      <Route path="/rewards" element={<ProtectedRoute><AppLayout><Rewards /></AppLayout></ProtectedRoute>} />
      <Route path="/cup-fixtures" element={<ProtectedRoute><AppLayout><CupFixtures /></AppLayout></ProtectedRoute>} />
      <Route path="/guide" element={<ProtectedRoute><AppLayout><Guide /></AppLayout></ProtectedRoute>} />
      <Route path="/rules" element={<ProtectedRoute><AppLayout><Rules /></AppLayout></ProtectedRoute>} />
      <Route path="/privacy-policy" element={<ProtectedRoute><AppLayout><PrivacyPolicy /></AppLayout></ProtectedRoute>} />
      <Route path="/delete-account" element={<ProtectedRoute><AppLayout><DeleteAccount /></AppLayout></ProtectedRoute>} />
      <Route path="/donations" element={<ProtectedRoute><AppLayout><Donations /></AppLayout></ProtectedRoute>} />
      <Route path="/install" element={<ProtectedRoute><AppLayout><Install /></AppLayout></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute><AppLayout><Statistics /></AppLayout></ProtectedRoute>} />
      <Route path="/statistics" element={<ProtectedRoute><AppLayout><Statistics /></AppLayout></ProtectedRoute>} />
      <Route path="/statistics/:id" element={<ProtectedRoute><AppLayout><Statistics /></AppLayout></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><AppLayout><Notifications /></AppLayout></ProtectedRoute>} />
      <Route path="/live-match" element={<SubscribedRoute><AppLayout><LiveMatch /></AppLayout></SubscribedRoute>} />
      <Route path="/play-online" element={<SubscribedRoute><AppLayout><PlayOnline /></AppLayout></SubscribedRoute>} />
      <Route path="/practice" element={<ProtectedRoute><AppLayout><PracticeHub /></AppLayout></ProtectedRoute>} />
      <Route path="/progress-tracker" element={<ProtectedRoute><AppLayout><ProgressTracker /></AppLayout></ProtectedRoute>} />
      <Route path="/practice/:modeId" element={<ProtectedRoute><AppLayout><PracticeGame /></AppLayout></ProtectedRoute>} />
      <Route path="/challenges" element={<ProtectedRoute><AppLayout><Challenges /></AppLayout></ProtectedRoute>} />
      <Route path="/daily-challenges" element={<ProtectedRoute><AppLayout><DailyChallenges /></AppLayout></ProtectedRoute>} />
      <Route path="/giveaways" element={<ProtectedRoute><AppLayout><Giveaways /></AppLayout></ProtectedRoute>} />
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

  useEffect(() => {
    document.body.classList.remove('nav-mode-bottom', 'nav-mode-sidebar')
    document.body.classList.add(`nav-mode-${navMode}`)
  }, [navMode])

  return (
    <>
      <BackgroundDecor division={user?.division} />
      <AppRoutes />
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
              <AppShell />
            </BrowserRouter>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
