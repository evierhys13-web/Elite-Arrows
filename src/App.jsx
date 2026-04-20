import { BrowserRouter, Routes, Route, Navigate, useNavigate, Outlet, useLocation } from 'react-router-dom'
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
import Games from './pages/Games'
import Leaderboards from './pages/Leaderboards'
import Rewards from './pages/Rewards'
import Analytics from './pages/Analytics'
import SeedData from './pages/SeedData'
import Sidebar from './components/Sidebar'
import BackgroundDecor from './components/BackgroundDecor'

function AppLayout() {
  const location = useLocation()
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content" key={location.pathname}>
        <Outlet />
      </main>
    </div>
  )
}

function SubscribedLayout() {
  const location = useLocation()
  const { user, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />
  }

  if (!user?.isSubscribed) {
    return (
      <div className="app-layout">
        <Sidebar />
        <main className="main-content" key={location.pathname}>
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
        </main>
      </div>
    )
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content" key={location.pathname}>
        <Outlet />
      </main>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-primary)'
    }}>
      <div className="loading" style={{ fontSize: '1.2rem' }}>Loading...</div>
    </div>
  )
}

function AppRoutes() {
  const { loading } = useAuth()

  if (loading) {
    return <LoadingScreen />
  }

  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />

      <Route element={<AppLayout />}>
        <Route path="/home" element={<Home />} />
        <Route path="/subscription" element={<Subscription />} />
        <Route path="/table" element={<Table />} />
        <Route path="/results" element={<Results />} />
        <Route path="/match-log" element={<MatchLog />} />
        <Route path="/players" element={<Players />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/profile/:id" element={<Profile />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/support" element={<Support />} />
        <Route path="/tournaments" element={<Tournaments />} />
        <Route path="/leaderboards" element={<Leaderboards />} />
        <Route path="/rewards" element={<Rewards />} />
        <Route path="/analytics" element={<Analytics />} />
      </Route>

      <Route element={<SubscribedLayout />}>
        <Route path="/submit-result" element={<SubmitResultWrapper />} />
        <Route path="/games" element={<Games />} />
        <Route path="/admin" element={<Admin />} />
      </Route>

      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  )
}

function SubmitResultWrapper() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
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