import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const HomeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9,22 9,12 15,12 15,22" />
  </svg>
)

const TableIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="9" y1="21" x2="9" y2="9" />
  </svg>
)

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="16" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
)

const TrophyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </svg>
)

const UserIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)

const BellIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
)

export default function BottomNav() {
  const { user } = useAuth()
  const isSubscribed = user?.isSubscribed || user?.isAdmin || user?.isTournamentAdmin

  return (
    <nav className="mobile-bottom-nav">
      <NavLink to="/home" className={({ isActive }) => `mobile-bottom-nav-item ${isActive ? 'active' : ''}`}>
        <HomeIcon />
        <span>Home</span>
      </NavLink>

      <NavLink to="/table" className={({ isActive }) => `mobile-bottom-nav-item ${isActive ? 'active' : ''}`}>
        <TableIcon />
        <span>Table</span>
      </NavLink>

      {isSubscribed && (
        <NavLink to="/submit-result" className={({ isActive }) => `mobile-bottom-nav-item ${isActive ? 'active' : ''}`}>
          <PlusIcon />
          <span>Submit</span>
        </NavLink>
      )}

      <NavLink to="/notifications" className={({ isActive }) => `mobile-bottom-nav-item ${isActive ? 'active' : ''}`}>
        <BellIcon />
        <span>Activity</span>
      </NavLink>

      <NavLink to="/profile" className={({ isActive }) => `mobile-bottom-nav-item ${isActive ? 'active' : ''}`}>
        <UserIcon />
        <span>Profile</span>
      </NavLink>
    </nav>
  )
}
