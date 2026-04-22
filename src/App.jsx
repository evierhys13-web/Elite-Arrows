import { Suspense, lazy, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import Sidebar from './components/Sidebar'
import InstallPrompt from './components/InstallPrompt'
import DataRefreshToast from './components/DataRefreshToast'
import BackgroundDecor from './components/BackgroundDecor'
import NotificationPermissionPrompt from './components/NotificationPermissionPrompt'
import OnboardingTour, { useOnboarding } from './components/OnboardingTour'
import WhatsNewPopup, { useWhatsNew } from './components/WhatsNewPopup'
import { Skeleton } from './components/Skeleton'

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
const Games = lazy(() => import('./pages/Games'))
const Leaderboards = lazy(() => import('./pages/Leaderboards'))
const Rewards = lazy(() => import('./pages/Rewards'))
const Fixtures = lazy(() => import('./pages/Fixtures'))
const CupFixtures = lazy(() => import('./pages/CupFixtures'))
const Calendar = lazy(() => import('./pages/Calendar'))
const Guide = lazy(() => import('./pages/Guide'))
const Install = lazy(() => import('./pages/Install'))
const Analytics = lazy(() => import('./pages/Analytics'))
const SeedData = lazy(() => import('./pages/SeedData'))

function PageLoader() {
  return (
    <div className="loading" style={{ padding: '40px', textAlign: 'center' }}>
      <Skeleton height="200px" />
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  const navigate = useNavigate()
  
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
  const ADMIN_EMAILS = ['rhyshowe2023@outlook.com', 'dhineberry@yahoo.com']
  const isEmailAdmin = ADMIN_EMAILS.includes(user?.email?.toLowerCase())
  const isDbAdmin = user?.isAdmin === true
  const isAdmin = isEmailAdmin || isDbAdmin
  const isSubscribed = user?.isSubscribed === true
  
  if (!isAdmin && !isSubscribed && isFreeTier) {
    return (
      <div style={{ 
        padding: '40px', 
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh'
      }}>
        <div style={{ 
          background: 'var(--bg-secondary)', 
          padding: '30px', 
          borderRadius: '12px',
          maxWidth: '400px'
        }}>
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
  
  const ADMIN_EMAILS = ['rhyshowe2023@outlook.com', 'dhineberry@yahoo.com']
  const isEmailAdmin = ADMIN_EMAILS.includes(user?.email?.toLowerCase())
  const isDbAdmin = user?.isAdmin === true
  const isTournamentAdmin = user?.isTournamentAdmin === true
  const isAdmin = isEmailAdmin || isDbAdmin || isTournamentAdmin
  
  if (!isAdmin) {
    return (
      <div style={{ 
        padding: '40px', 
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh'
      }}>
        <div style={{ 
          background: 'var(--bg-secondary)', 
          padding: '30px', 
          borderRadius: '12px',
          maxWidth: '400px'
        }}>
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
  const { dataRefreshTrigger } = useAuth()
  const { showOnboarding, completeOnboarding } = useOnboarding()
  const { showWhatsNew } = useWhatsNew()
  const [whatsNewOpen, setWhatsNewOpen] = useState(showWhatsNew)
  
  return (
    <>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <div className="app-layout">
        <Sidebar />
        <main id="main-content" className="main-content" tabIndex={-1}>
          <Suspense fallback={<PageLoader />}>
            {children}
          </Suspense>
        </main>
        <InstallPrompt />
        <DataRefreshToast refreshTrigger={dataRefreshTrigger} />
        <NotificationPermissionPrompt />
        {showOnboarding && (
          <OnboardingTour onComplete={completeOnboarding} />
        )}
        <WhatsNewPopup isOpen={whatsNewOpen} onClose={() => setWhatsNewOpen(false)} />
      </div>
    </>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth" element={<Suspense fallback={<PageLoader />}><Auth /></Suspense>} />
      <Route path="/home" element={
        <ProtectedRoute>
          <AppLayout><Home /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/subscription" element={
        <ProtectedRoute>
          <AppLayout><Subscription /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/table" element={
        <ProtectedRoute>
          <AppLayout><Table /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/match-log" element={
        <SubscribedRoute>
          <AppLayout><MatchLog /></AppLayout>
        </SubscribedRoute>
      } />
      <Route path="/results" element={
        <SubscribedRoute>
          <AppLayout><Results /></AppLayout>
        </SubscribedRoute>
      } />
      <Route path="/players" element={
        <ProtectedRoute>
          <AppLayout><Players /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/submit-result" element={
        <SubscribedRoute>
          <AppLayout><SubmitResult /></AppLayout>
        </SubscribedRoute>
      } />
      <Route path="/chat" element={
        <SubscribedRoute>
          <AppLayout><Chat /></AppLayout>
        </SubscribedRoute>
      } />
      <Route path="/profile" element={
        <ProtectedRoute>
          <AppLayout><Profile /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/profile/:id" element={
        <ProtectedRoute>
          <AppLayout><Profile /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute>
          <AppLayout><Settings /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/contact" element={
        <ProtectedRoute>
          <AppLayout><Contact /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/support" element={
        <ProtectedRoute>
          <AppLayout><Support /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/tournaments" element={
        <SubscribedRoute>
          <AppLayout><Tournaments /></AppLayout>
        </SubscribedRoute>
      } />
      <Route path="/leaderboards" element={
        <ProtectedRoute>
          <AppLayout><Leaderboards /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/guide" element={
        <ProtectedRoute>
          <AppLayout><Guide /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/install" element={
        <ProtectedRoute>
          <AppLayout><Install /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/rewards" element={
        <SubscribedRoute>
          <AppLayout><Rewards /></AppLayout>
        </SubscribedRoute>
      } />
      <Route path="/fixtures" element={
        <SubscribedRoute>
          <AppLayout><Fixtures /></AppLayout>
        </SubscribedRoute>
      } />
      <Route path="/calendar" element={
        <SubscribedRoute>
          <AppLayout><Calendar /></AppLayout>
        </SubscribedRoute>
      } />
      <Route path="/cup-fixtures" element={
        <SubscribedRoute>
          <AppLayout><CupFixtures /></AppLayout>
        </SubscribedRoute>
      } />
      <Route path="/cups" element={
        <SubscribedRoute>
          <AppLayout><Cups /></AppLayout>
        </SubscribedRoute>
      } />
      <Route path="/cups/:cupId" element={
        <SubscribedRoute>
          <AppLayout><CupBracket /></AppLayout>
        </SubscribedRoute>
      } />
      <Route path="/games" element={
        <SubscribedRoute>
          <AppLayout><Games /></AppLayout>
        </SubscribedRoute>
      } />
      <Route path="/analytics" element={
        <SubscribedRoute>
          <AppLayout><Analytics /></AppLayout>
        </SubscribedRoute>
      } />
      <Route path="/season-management" element={
        <AdminRoute>
          <AppLayout><SeedData /></AppLayout>
        </AdminRoute>
      } />
      <Route path="/seed-data" element={
        <AdminRoute>
          <AppLayout><SeedData /></AppLayout>
        </AdminRoute>
      } />
      <Route path="/admin" element={
        <AdminRoute>
          <AppLayout><Admin /></AppLayout>
        </AdminRoute>
      } />
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <BackgroundDecor />
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}