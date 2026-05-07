import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import NotificationBell from './NotificationBell'
import RefreshButton from './RefreshButton'

const HomeIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9,22 9,12 15,12 15,22" /></svg>
const TableIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" /><line x1="9" y1="3" x2="9" y2="21" /></svg>
const TrophyIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></svg>
const UsersIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
const PlusCircleIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
const MessageIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
const ShieldIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
const SettingsIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
const LogOutIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16,17 21,12 16,7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
const MenuIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
const BarChartIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" /></svg>

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const { signOut, user } = useAuth()
  const navigate = useNavigate()
  const { navMode } = useTheme()

  const handleSignOut = () => {
    signOut()
    navigate('/auth')
  }

  const ADMIN_EMAILS = ['rhyshowe2023@outlook.com', 'dhineberry@yahoo.com']
  const isAdmin = user?.isAdmin || user?.isTournamentAdmin || ADMIN_EMAILS.includes(user?.email?.toLowerCase())
  const isSubscribed = user?.isSubscribed === true || isAdmin
  
  const navigationGroups = [
    {
      title: 'League',
      items: [
        { path: '/home', label: 'Home', icon: HomeIcon },
        { path: '/table', label: 'Standings', icon: TableIcon },
        { path: '/players', label: 'Players', icon: UsersIcon },
        { path: '/results', label: 'Results', icon: TrophyIcon },
      ]
    },
    ...(isSubscribed ? [{
      title: 'Compete',
      items: [
        { path: '/submit-result', label: 'Submit Score', icon: PlusCircleIcon },
        { path: '/fixtures', label: 'Fixtures', icon: TrophyIcon },
        { path: '/cups', label: 'Cups', icon: TrophyIcon },
        { path: '/chat', label: 'Chat', icon: MessageIcon },
        { path: '/analytics', label: 'Analytics', icon: BarChartIcon },
      ]
    }] : []),
    ...(isAdmin ? [{
      title: 'Admin',
      items: [
        { path: '/admin', label: 'Admin Panel', icon: ShieldIcon },
      ]
    }] : []),
    {
      title: 'Account',
      items: [
        { path: '/profile', label: 'My Profile', icon: UsersIcon },
        { path: '/settings', label: 'Settings', icon: SettingsIcon },
      ]
    },
  ]

  return (
    <>
      <div className="mobile-header">
        <button className="btn btn-secondary btn-sm" style={{ padding: '8px', minWidth: '44px' }} onClick={() => setIsOpen(true)}>
          <MenuIcon />
        </button>
        <span className="sidebar-logo text-gradient" style={{ fontSize: '1.25rem', fontWeight: 900 }}>Elite Arrows</span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <NotificationBell />
          <RefreshButton size={20} />
        </div>
      </div>

      <div className={`mobile-sidebar-overlay ${isOpen ? 'open' : ''}`} onClick={() => setIsOpen(false)} />

      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <img src="/elite arrows.jpg" alt="EA" style={{ width: '32px', height: '32px', borderRadius: '8px', marginRight: '10px' }} />
            <span className="text-gradient" style={{ fontWeight: 900 }}>Elite Arrows</span>
          </div>
        </div>

        <div className="sidebar-profile">
          <div className="avatar-ring">
            <div className="avatar-inner">
              {user?.profilePicture ? (
                <img src={user.profilePicture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontWeight: 800 }}>{(user?.username || '?').charAt(0).toUpperCase()}</span>
              )}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.username}</div>
            <div style={{ color: 'var(--accent-cyan)', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{user?.division || 'Member'}</div>
          </div>
          <NotificationBell />
        </div>

        <nav className="sidebar-nav">
          {navigationGroups.map((group) => (
            <div key={group.title} style={{ marginBottom: '24px' }}>
              <div style={{ padding: '0 16px', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-muted)', marginBottom: '8px' }}>
                {group.title}
              </div>
              {group.items.map((item) => {
                const isActive = window.location.pathname === item.path
                return (
                  <button key={item.path} className={`nav-item ${isActive ? 'active' : ''}`} onClick={() => { navigate(item.path); setIsOpen(false); }}>
                    <item.icon />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </div>
          ))}

          <button className="nav-item nav-item-signout" onClick={handleSignOut} style={{ marginTop: 'auto' }}>
            <LogOutIcon />
            <span>Sign Out</span>
          </button>
        </nav>
      </aside>
    </>
  )
}
