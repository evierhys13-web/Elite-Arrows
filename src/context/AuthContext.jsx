import { createContext, useContext, useState, useEffect } from 'react'
import { db, auth, usersCollection, doc, setDoc, getDoc, getDocs, query, where, onSnapshot, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from '../firebase'

const AuthContext = createContext(null)

const ADMIN_EMAIL = 'rhyshowe2023@outlook.com'

function getDivisionFromAverage(average) {
  if (average >= 55) return 'Elite'
  if (average >= 50) return 'Premier'
  if (average >= 45) return 'Champion'
  if (average >= 40) return 'Diamond'
  return 'Gold'
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [allUsers, setAllUsers] = useState([])

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
          if (userDoc.exists()) {
            setUser({ id: userDoc.id, ...userDoc.data() })
          } else {
            await signOut(auth)
            setUser(null)
          }
        } catch (e) {
          console.error('Error fetching user:', e)
          setUser(null)
        }
      } else {
        setUser(null)
      }
      setLoading(false)
    })

    const unsubscribeUsers = onSnapshot(usersCollection, (snapshot) => {
      const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setAllUsers(users)
    }, (error) => {
      console.log('Users snapshot error (may need Firestore rules):', error)
    })

    return () => {
      unsubscribeAuth()
      unsubscribeUsers()
    }
  }, [])

  const signUp = async (userData, rememberMe = false) => {
    const emailLower = userData.email.toLowerCase()
    const isAdmin = emailLower === ADMIN_EMAIL.toLowerCase()
    const division = getDivisionFromAverage(userData.threeDartAverage || 0)

    try {
      console.log('Attempting Firebase sign up...')
      const { user: firebaseUser } = await createUserWithEmailAndPassword(auth, userData.email, userData.password)
      console.log('Firebase auth successful, user ID:', firebaseUser.uid)
      
      const newUser = {
        ...userData,
        threeDartAverage: userData.threeDartAverage || 0,
        division: division,
        isAdmin: isAdmin,
        isTournamentAdmin: false,
        isSubscribed: isAdmin,
        adminRequestPending: false,
        friends: [],
        isOnline: true,
        showOnlineStatus: true,
        doNotDisturb: false,
        dndEndTime: null,
        eliteTokens: isAdmin ? 500 : 0,
        lastSeen: new Date().toISOString(),
        createdAt: new Date().toISOString()
      }

      await setDoc(doc(db, 'users', firebaseUser.uid), newUser)
      setUser({ id: firebaseUser.uid, ...newUser })
      return newUser
    } catch (error) {
      throw new Error(error.message)
    }
  }

  const signIn = async (email, password, rememberMe = false) => {
    try {
      console.log('Attempting Firebase sign in...')
      const { user: firebaseUser } = await signInWithEmailAndPassword(auth, email, password)
      console.log('Firebase auth successful, user ID:', firebaseUser.uid)
      
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
      console.log('User doc exists:', userDoc.exists())
      
      if (!userDoc.exists()) {
        await signOut(auth)
        throw new Error('User data not found')
      }

      const userData = userDoc.data()
      const isAdminEmail = email.toLowerCase() === ADMIN_EMAIL.toLowerCase()
      
      if (isAdminEmail) {
        userData.isAdmin = true
        userData.isSubscribed = true
        await setDoc(doc(db, 'users', firebaseUser.uid), userData, { merge: true })
      }

      userData.isOnline = true
      await setDoc(doc(db, 'users', firebaseUser.uid), { isOnline: true, lastSeen: new Date().toISOString() }, { merge: true })
      
      setUser({ id: firebaseUser.uid, ...userData })
      return userData
    } catch (error) {
      throw new Error(error.message)
    }
  }

  const signOut = async () => {
    if (user) {
      try {
        await setDoc(doc(db, 'users', user.id), { isOnline: false, lastSeen: new Date().toISOString() }, { merge: true })
      } catch (e) {}
    }
    await signOut(auth)
    setUser(null)
  }

  const updateUser = async (updates) => {
    if (!user) return
    try {
      await setDoc(doc(db, 'users', user.id), updates, { merge: true })
      setUser({ ...user, ...updates })
    } catch (error) {
      console.error('Error updating user:', error)
    }
  }

  const addUserManually = async (userData) => {
    const emailLower = userData.email.toLowerCase()
    const isAdmin = emailLower === ADMIN_EMAIL.toLowerCase()
    const division = getDivisionFromAverage(userData.threeDartAverage || 0)

    const newUser = {
      ...userData,
      threeDartAverage: userData.threeDartAverage || 0,
      division: division,
      isAdmin: isAdmin,
      isTournamentAdmin: false,
      isSubscribed: isAdmin || userData.isSubscribed || false,
      adminRequestPending: false,
      friends: [],
      isOnline: false,
      showOnlineStatus: true,
      doNotDisturb: false,
      dndEndTime: null,
      eliteTokens: userData.eliteTokens || 0,
      lastSeen: new Date().toISOString(),
      createdAt: new Date().toISOString()
    }

    const tempId = Date.now().toString()
    await setDoc(doc(db, 'tempUsers', tempId), newUser)
    return { id: tempId, ...newUser }
  }

  const addFriend = async (friendId) => {
    if (!user) return
    const newFriends = [...(user.friends || []), friendId]
    await updateUser({ friends: newFriends })
  }

  const removeFriend = async (friendId) => {
    if (!user) return
    const newFriends = (user.friends || []).filter(id => id !== friendId)
    await updateUser({ friends: newFriends })
  }

  const subscribe = () => {
    updateUser({ isSubscribed: true, paymentDate: new Date().toISOString() })
  }

  const requestAdminRole = () => {
    updateUser({ adminRequestPending: true })
  }

  const getAllUsers = () => allUsers

  const getFriends = () => {
    return allUsers.filter(u => (user?.friends || []).includes(u.id))
  }

  const addTokens = async (amount) => {
    if (!user) return
    const newTokens = (user.eliteTokens || 0) + amount
    await updateUser({ eliteTokens: newTokens })
  }

  const useTokens = async (amount) => {
    if (!user) return false
    if ((user.eliteTokens || 0) < amount) return false
    const newTokens = (user.eliteTokens || 0) - amount
    await updateUser({ eliteTokens: newTokens })
    return true
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      signUp, 
      signIn, 
      signOut, 
      updateUser,
      addUserManually,
      addFriend,
      removeFriend,
      subscribe,
      requestAdminRole,
      getAllUsers,
      getFriends,
      addTokens,
      useTokens,
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