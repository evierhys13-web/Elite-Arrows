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
import Games from './pages/Games'
import Leaderboards from './pages/Leaderboards'
import Rewards from './pages/Rewards'
import Fixtures from './pages/Fixtures'
import SeedData from './pages/SeedData'
import Sidebar from './components/Sidebar'
import BackgroundDecor from './components/BackgroundDecor'

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading, user } = useAuth()
  
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
  
  if (!user?.isSubscribed && !user?.isAdmin && !isFreeTier) {
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

function AppLayout({ children }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        {children}
      </main>
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
      <Route path="/results" element={
        <ProtectedRoute>
          <AppLayout>
            <Results />
          </AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/match-log" element={
        <ProtectedRoute>
          <AppLayout>
            <MatchLog />
          </AppLayout>
        </ProtectedRoute>
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
        <ProtectedRoute>
          <AppLayout>
            <Chat />
          </AppLayout>
        </ProtectedRoute>
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
        <ProtectedRoute>
          <AppLayout>
            <Tournaments />
          </AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/games" element={
        <SubscribedRoute>
          <AppLayout>
            <Games />
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
      <Route path="/rewards" element={
        <ProtectedRoute>
          <AppLayout>
            <Rewards />
          </AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/fixtures" element={
        <ProtectedRoute>
          <AppLayout>
            <Fixtures />
          </AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/admin" element={
        <SubscribedRoute>
          <AppLayout>
            <Admin />
          </AppLayout>
        </SubscribedRoute>
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