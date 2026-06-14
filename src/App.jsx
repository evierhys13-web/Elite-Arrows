import { Suspense, lazy, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
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
const Fixtures = lazy(() => import('./pages/Fixtures'))
const CupFixtures = lazy(() => import('./pages/CupFixtures'))
const Calendar = lazy(() => import('./pages/Calendar'))
const Guide = lazy(() => import('./pages/Guide'))
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'))
const DeleteAccount = lazy(() => import('./pages/DeleteAccount'))
const Donations = lazy(() => import('./pages/Donations'))
const Install = lazy(() => import('./pages/Install'))
const Analytics = lazy(() => import('./pages/Analytics'))
const SeedData = lazy(() => import('./pages/SeedData'))
const SeasonManagement = lazy(() => import('./pages/SeasonManagement'))
const SuperLeague = lazy(() => import('./pages/SuperLeague'))
const Notifications = lazy(() => import('./pages/Notifications'))
const Challenges = lazy(() => import('./pages/Challenges'))
const Giveaways = lazy(() => import('./pages/Giveaways'))
const LiveMatch = lazy(() => import('./pages/LiveMatch'))
const PracticeHub = lazy(() => import('./pages/PracticeHub'))
const PracticeGame = lazy(() => import('./pages/PracticeGame'))

function PageLoader() {
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

function AppLayout({ children }) {
  const { dataRefreshTrigger, adminData, forceFetchResults } = useAuth()
  const { showOnboarding, completeOnboarding } = useOnboarding()
  const { showWhatsNew } = useWhatsNew()
  const [whatsNewOpen, setWhatsNewOpen] = useState(showWhatsNew)
  const hasMaintenance = adminData?.isMaintenanceMode && adminData?.maintenanceMessage

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
          {adminData.maintenanceMessage}
        </div>
      )}

      <BottomNav />
      <InstallPrompt />
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
      <Route path="/home" element={<ProtectedRoute><AppLayout><Home /></AppLayout></ProtectedRoute>} />
      <Route path="/subscription" element={<ProtectedRoute><AppLayout><Subscription /></AppLayout></ProtectedRoute>} />
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
      <Route path="/rewards" element={<ProtectedRoute><AppLayout><Rewards /></AppLayout></ProtectedRoute>} />
      <Route path="/fixtures" element={<ProtectedRoute><AppLayout><Fixtures /></AppLayout></ProtectedRoute>} />
      <Route path="/cup-fixtures" element={<ProtectedRoute><AppLayout><CupFixtures /></AppLayout></ProtectedRoute>} />
      <Route path="/calendar" element={<ProtectedRoute><AppLayout><Calendar /></AppLayout></ProtectedRoute>} />
      <Route path="/guide" element={<ProtectedRoute><AppLayout><Guide /></AppLayout></ProtectedRoute>} />
      <Route path="/privacy-policy" element={<ProtectedRoute><AppLayout><PrivacyPolicy /></AppLayout></ProtectedRoute>} />
      <Route path="/delete-account" element={<ProtectedRoute><AppLayout><DeleteAccount /></AppLayout></ProtectedRoute>} />
      <Route path="/donations" element={<ProtectedRoute><AppLayout><Donations /></AppLayout></ProtectedRoute>} />
      <Route path="/install" element={<ProtectedRoute><AppLayout><Install /></AppLayout></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute><AppLayout><Analytics /></AppLayout></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><AppLayout><Notifications /></AppLayout></ProtectedRoute>} />
      <Route path="/live-match" element={<SubscribedRoute><AppLayout><LiveMatch /></AppLayout></SubscribedRoute>} />
      <Route path="/practice" element={<ProtectedRoute><AppLayout><PracticeHub /></AppLayout></ProtectedRoute>} />
      <Route path="/practice/:modeId" element={<ProtectedRoute><AppLayout><PracticeGame /></AppLayout></ProtectedRoute>} />
      <Route path="/challenges" element={<ProtectedRoute><AppLayout><Challenges /></AppLayout></ProtectedRoute>} />
      <Route path="/giveaways" element={<ProtectedRoute><AppLayout><Giveaways /></AppLayout></ProtectedRoute>} />
      <Route path="/super-league" element={<SubscribedRoute><AppLayout><SuperLeague /></AppLayout></SubscribedRoute>} />
      <Route path="/season-management" element={<AdminRoute><AppLayout><SeasonManagement /></AppLayout></AdminRoute>} />
      <Route path="/seed-data" element={<AdminRoute><AppLayout><SeedData /></AppLayout></AdminRoute>} />
      <Route path="/admin" element={<AdminRoute><AppLayout><Admin /></AppLayout></AdminRoute>} />
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  )
}

function AppShell() {
  const { navMode } = useTheme()

  useEffect(() => {
    document.body.classList.remove('nav-mode-bottom', 'nav-mode-sidebar')
    document.body.classList.add(`nav-mode-${navMode}`)
  }, [navMode])

  return (
    <>
      <BackgroundDecor />
      <AppRoutes />
    </>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <ErrorBoundary>
              <AppShell />
            </ErrorBoundary>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
