import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

export default function SeedData() {
  const { user, isAuthenticated } = useAuth()

  useEffect(() => {
    if (!isAuthenticated) return

    const existingUsers = JSON.parse(localStorage.getItem('eliteArrowsUsers') || '[]')
    
    if (existingUsers.length === 0) {
      const seedUsers = [
        {
          id: '1',
          username: 'Rhys',
          email: 'rhyshowe2023@outlook.com',
          password: 'admin123',
          threeDartAverage: 58.5,
          division: 'Elite',
          isAdmin: true,
          isTournamentAdmin: false,
          isSubscribed: true,
          eliteTokens: 500,
          friends: [],
          isOnline: false,
          showOnlineStatus: true,
          doNotDisturb: false,
          profilePicture: '',
          bio: '',
          nickname: '',
          dartCounterLink: '',
          createdAt: new Date().toISOString()
        },
        {
          id: '2',
          username: 'TestPlayer',
          email: 'test@demo.com',
          password: 'test123',
          threeDartAverage: 42.5,
          division: 'Diamond',
          isAdmin: false,
          isTournamentAdmin: false,
          isSubscribed: true,
          eliteTokens: 100,
          friends: [],
          isOnline: false,
          showOnlineStatus: true,
          doNotDisturb: false,
          profilePicture: '',
          bio: '',
          nickname: '',
          dartCounterLink: '',
          createdAt: new Date().toISOString()
        },
        {
          id: '3',
          username: 'NewPlayer',
          email: 'new@demo.com',
          password: 'player123',
          threeDartAverage: 35.0,
          division: 'Gold',
          isAdmin: false,
          isTournamentAdmin: false,
          isSubscribed: false,
          eliteTokens: 0,
          friends: [],
          isOnline: false,
          showOnlineStatus: true,
          doNotDisturb: false,
          profilePicture: '',
          bio: '',
          nickname: '',
          dartCounterLink: '',
          createdAt: new Date().toISOString()
        }
      ]

      localStorage.setItem('eliteArrowsUsers', JSON.stringify(seedUsers))
      localStorage.setItem('eliteArrowsSeason', JSON.stringify({
        startDate: '2026-06-01',
        endDate: '2026-07-01',
        name: 'Season 1'
      }))
      localStorage.setItem('eliteArrowsCurrentSeason', '2026')
      localStorage.setItem('eliteArrowsSeasons', JSON.stringify([
        { id: 1, name: '2026', createdAt: new Date().toISOString(), status: 'active', isArchived: false }
      ]))

      console.log('Seed data added!')
      window.location.reload()
    }
  }, [isAuthenticated])

  if (!isAuthenticated || !user?.isAdmin) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <h2>Admin Only</h2>
        <p>Please sign in as admin to access this page.</p>
      </div>
    )
  }

  const users = JSON.parse(localStorage.getItem('eliteArrowsUsers') || '[]')

  const handleSeed = () => {
    const seedUsers = [
      {
        id: '1',
        username: 'Rhys',
        email: 'rhyshowe2023@outlook.com',
        password: 'admin123',
        threeDartAverage: 58.5,
        division: 'Elite',
        isAdmin: true,
        isTournamentAdmin: false,
        isSubscribed: true,
        eliteTokens: 500,
        friends: [],
        isOnline: false,
        showOnlineStatus: true,
        doNotDisturb: false,
        profilePicture: '',
        bio: '',
        nickname: '',
        dartCounterLink: '',
        createdAt: new Date().toISOString()
      },
      {
        id: '2',
        username: 'TestPlayer',
        email: 'test@demo.com',
        password: 'test123',
        threeDartAverage: 42.5,
        division: 'Diamond',
        isAdmin: false,
        isTournamentAdmin: false,
        isSubscribed: true,
        eliteTokens: 100,
        friends: [],
        isOnline: false,
        showOnlineStatus: true,
        doNotDisturb: false,
        profilePicture: '',
        bio: '',
        nickname: '',
        dartCounterLink: '',
        createdAt: new Date().toISOString()
      }
    ]

    localStorage.setItem('eliteArrowsUsers', JSON.stringify(seedUsers))
    localStorage.setItem('eliteArrowsSeason', JSON.stringify({
      startDate: '2026-06-01',
      endDate: '2026-07-01',
      name: 'Season 1'
    }))
    localStorage.setItem('eliteArrowsCurrentSeason', '2026')
    
    alert('Seed data added! Sign out and sign in with: rhyshowe2023@outlook.com / admin123')
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Seed Data</h2>
      <p>Current users: {users.length}</p>
      <button onClick={handleSeed} style={{ padding: 12, margin: 10 }}>
        Add Seed Users
      </button>
      <p><strong>Admin Login:</strong> rhyshowe2023@outlook.com / admin123</p>
    </div>
  )
}