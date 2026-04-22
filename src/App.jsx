import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import Auth from './pages/Auth'
import Home from './pages/Home'
import Subscription from './pages/Subscription'
import Table from './pages/Table'
import Results from './pages/Results'
import MatchLog from './pages/MatchLog'
import Players from './pages/Players'
import SubmitResult from './pages/SubmitResult'
import Chat from './pages/Chat'
import Profile from './pages/Profile'
import Settings from './pages/Settings'
import Admin from './pages/Admin'
import Contact from './pages/Contact'
import Support from './pages/Support'
import Tournaments from './pages/Tournaments'
import Cups from './pages/Cups'
import CupBracket from './pages/CupBrackets'
import Games from './pages/Games'
import Leaderboards from './pages/Leaderboards'
import Rewards from './pages/Rewards'
import Fixtures from './pages/Fixtures'
import CupFixtures from './pages/CupFixtures'
import Calendar from './pages/Calendar'
import Guide from './pages/Guide'
import Install from './pages/Install'
import Analytics from './pages/Analytics'
import SeedData from './pages/SeedData'
import Sidebar from './components/Sidebar'
import InstallPrompt from './components/InstallPrompt'
import DataRefreshToast from './components/DataRefreshToast'
import BackgroundDecor from './components/BackgroundDecor'
import NotificationPermissionPrompt from './components/NotificationPermissionPrompt'
import OnboardingTour, { useOnboarding } from './components/OnboardingTour'
import WhatsNewPopup, { useWhatsNew } from './components/WhatsNewPopup'

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading, user } = useAuth()
  const navigate = useNavigate()
  
  if (loading) {
    return <div className="loading">Loading...</div>
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />
  }
  
  return children
}

function SubscribedRoute({ children }) {
  const { user, isAuthenticated, loading } = useAuth()
  const navigate = useNavigate()
  const [showPopup, setShowPopup] = useState(false)
  
  if (loading) {
    return <div className="loading">Loading...</div>
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
    return <div className="loading">Loading...</div>
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
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        {children}
      </main>
      <InstallPrompt />
      <DataRefreshToast refreshTrigger={dataRefreshTrigger} />
      <NotificationPermissionPrompt />
      {showOnboarding && (
        <OnboardingTour onComplete={completeOnboarding} />
      )}
      <WhatsNewPopup isOpen={whatsNewOpen} onClose={() => setWhatsNewOpen(false)} />
    </div>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/home" element={
        <ProtectedRoute>
          <AppLayout>
            <Home />
          </AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/subscription" element={
        <ProtectedRoute>
          <AppLayout>
            <Subscription />
          </AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/table" element={
        <ProtectedRoute>
          <AppLayout>
            <Table />
          </AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/match-log" element={
        <SubscribedRoute>
          <AppLayout>
            <MatchLog />
          </AppLayout>
        </SubscribedRoute>
      } />
      <Route path="/results" element={
        <SubscribedRoute>
          <AppLayout>
            <Results />
          </AppLayout>
        </SubscribedRoute>
      } />
      <Route path="/players" element={
        <ProtectedRoute>
          <AppLayout>
            <Players />
          </AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/submit-result" element={
        <SubscribedRoute>
          <AppLayout>
            {(() => {
              const { user } = useAuth();
              if (user?.isTournamentAdmin) {
                return (
                  <div style={{ padding: '40px', textAlign: 'center' }}>
                    <div style={{ background: 'var(--bg-secondary)', padding: '30px', borderRadius: '12px', maxWidth: '400px', margin: '0 auto' }}>
                      <h2 style={{ color: 'var(--accent-cyan)', marginBottom: '15px' }}>Access Restricted</h2>
                      <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
                        Tournament admins cannot submit League/Friendly game results.
                      </p>
                      <button className="btn btn-secondary" onClick={() => navigate('/tournaments')}>
                        Go to Tournaments
                      </button>
                    </div>
                  </div>
                );
              }
              return <SubmitResult />;
            })()}
          </AppLayout>
        </SubscribedRoute>
      } />
      <Route path="/chat" element={
        <SubscribedRoute>
          <AppLayout>
            <Chat />
          </AppLayout>
        </SubscribedRoute>
      } />
      <Route path="/profile" element={
        <ProtectedRoute>
          <AppLayout>
            <Profile />
          </AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/profile/:id" element={
        <ProtectedRoute>
          <AppLayout>
            <Profile />
          </AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute>
          <AppLayout>
            <Settings />
          </AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/contact" element={
        <ProtectedRoute>
          <AppLayout>
            <Contact />
          </AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/support" element={
        <ProtectedRoute>
          <AppLayout>
            <Support />
          </AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/tournaments" element={
        <SubscribedRoute>
          <AppLayout>
            <Tournaments />
          </AppLayout>
        </SubscribedRoute>
      } />
      <Route path="/leaderboards" element={
        <ProtectedRoute>
          <AppLayout>
            <Leaderboards />
          </AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/guide" element={
        <ProtectedRoute>
          <AppLayout>
            <Guide />
          </AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/install" element={
        <ProtectedRoute>
          <AppLayout>
            <Install />
          </AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/rewards" element={
        <SubscribedRoute>
          <AppLayout>
            <Rewards />
          </AppLayout>
        </SubscribedRoute>
      } />
      <Route path="/fixtures" element={
        <SubscribedRoute>
          <AppLayout>
            <Fixtures />
          </AppLayout>
        </SubscribedRoute>
      } />
      <Route path="/calendar" element={
        <SubscribedRoute>
          <AppLayout>
            <Calendar />
          </AppLayout>
        </SubscribedRoute>
      } />
      <Route path="/cup-fixtures" element={
        <SubscribedRoute>
          <AppLayout>
            <CupFixtures />
          </AppLayout>
        </SubscribedRoute>
      } />
      <Route path="/results" element={
        <SubscribedRoute>
          <AppLayout>
            <Results />
          </AppLayout>
        </SubscribedRoute>
      } />
      <Route path="/cups" element={
        <SubscribedRoute>
          <AppLayout>
            <Cups />
          </AppLayout>
        </SubscribedRoute>
      } />
      <Route path="/cups/:cupId" element={
        <SubscribedRoute>
          <AppLayout>
            <CupBracket />
          </AppLayout>
        </SubscribedRoute>
      } />
      <Route path="/games" element={
        <SubscribedRoute>
          <AppLayout>
            <Games />
          </AppLayout>
        </SubscribedRoute>
      } />
      <Route path="/analytics" element={
        <SubscribedRoute>
          <AppLayout>
            <Analytics />
          </AppLayout>
        </SubscribedRoute>
      } />
      <Route path="/season-management" element={
        <AdminRoute>
          <AppLayout>
            <SeedData />
          </AppLayout>
        </AdminRoute>
      } />
      <Route path="/seed-data" element={
        <AdminRoute>
          <AppLayout>
            <SeedData />
          </AppLayout>
        </AdminRoute>
      } />
      <Route path="/admin" element={
        <AdminRoute>
          <AppLayout>
            <Admin />
          </AppLayout>
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