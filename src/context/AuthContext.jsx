import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

const ADMIN_EMAIL = 'rhyshowe2023@outlook.com'

export const DIVISIONS = ['Elite', 'Diamond', 'Gold', 'Silver', 'Bronze']

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [allUsers, setAllUsers] = useState([])
  const [notifications, setNotifications] = useState([])

  useEffect(() => {
    const localUsers = JSON.parse(localStorage.getItem('eliteArrowsUsers') || '[]')
    setAllUsers(localUsers)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!user?.id) return
    const storedNotifs = JSON.parse(localStorage.getItem('eliteArrowsNotifications') || '[]')
    setNotifications(storedNotifs.filter(n => n.toUserId === user.id))
  }, [user?.id])

  const signIn = async (identifier, password) => {
    const users = JSON.parse(localStorage.getItem('eliteArrowsUsers') || '[]')
    const foundUser = users.find(u => (u.email?.toLowerCase() === identifier.toLowerCase() || u.username?.toLowerCase() === identifier.toLowerCase()) && u.password === password)
    if (!foundUser) throw new Error('Invalid credentials')
    setUser(foundUser)
    return foundUser
  }

  const signUp = async (userData) => {
    const users = JSON.parse(localStorage.getItem('eliteArrowsUsers') || '[]')
    const emailLower = userData.email.toLowerCase()
    const isAdmin = emailLower === ADMIN_EMAIL.toLowerCase()
    
    const newUser = {
      ...userData,
      id: Date.now().toString(),
      threeDartAverage: userData.threeDartAverage || 0,
      division: null,
      isAdmin: isAdmin,
      isTournamentAdmin: false,
      isSubscribed: isAdmin || userData.isSubscribed || false,
      friends: [],
      showOnlineStatus: true,
      doNotDisturb: false,
      createdAt: new Date().toISOString()
    }
    
    users.push(newUser)
    localStorage.setItem('eliteArrowsUsers', JSON.stringify(users))
    setAllUsers(users)
    setUser(newUser)
    return newUser
  }

  const signOut = () => {
    setUser(null)
  }

  const updateUser = (updates) => {
    if (!user) return
    const updatedUser = { ...user, ...updates }
    setUser(updatedUser)
    const users = JSON.parse(localStorage.getItem('eliteArrowsUsers') || '[]')
    const idx = users.findIndex(u => u.id === user.id)
    if (idx !== -1) {
      users[idx] = updatedUser
      localStorage.setItem('eliteArrowsUsers', JSON.stringify(users))
      setAllUsers(users)
    }
  }

  const getAllUsers = () => {
    return JSON.parse(localStorage.getItem('eliteArrowsUsers') || '[]')
  }

  const subscribe = () => {
    if (!user) return
    updateUser({ isSubscribed: true })
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      notifications,
      signUp, 
      signIn, 
      signOut, 
      updateUser,
      getAllUsers,
      subscribe,
      isAuthenticated: !!user 
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}