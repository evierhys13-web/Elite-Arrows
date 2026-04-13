import { createContext, useContext, useState, useEffect } from 'react'
import { db, auth, usersCollection, doc, setDoc, getDoc, getDocs, query, collection, onSnapshot, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut as firebaseSignOut, onAuthStateChanged, setPersistence, browserSessionPersistence, browserLocalPersistence, addDoc, FieldValue } from '../firebase'

const AuthContext = createContext(null)

const ADMIN_EMAILS = ['rhyshowe2023@outlook.com', 'dhineberry@yahoo.com']

export const DIVISIONS = ['Elite', 'Diamond', 'Gold', 'Silver', 'Bronze']

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('eliteArrowsCurrentUser')
    return stored ? JSON.parse(stored) : null
  })
  const [loading, setLoading] = useState(true)
  const [allUsers, setAllUsers] = useState([])
  const [notifications, setNotifications] = useState([])
  
  const SENSITIVE_FIELDS = ['password', 'passwordString', 'passwordHash', 'passwordKey', 'passwordStringValue', 'password', 'firebaseId', 'pwd', 'pass', 'passwd']
  
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const users = snapshot.docs.map(doc => {
        const data = doc.data()
        SENSITIVE_FIELDS.forEach(field => delete data[field])
        return { id: doc.id, ...data }
      })
      setAllUsers(users)
      localStorage.setItem('eliteArrowsUsers', JSON.stringify(users))
    })
    return () => unsubscribe()
  }, [])
  
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
          if (userDoc.exists()) {
            let userData = userDoc.data()
            SENSITIVE_FIELDS.forEach(field => delete userData[field])
            const fullUser = { id: userDoc.id, ...userData }
            setUser(fullUser)
            localStorage.setItem('eliteArrowsCurrentUser', JSON.stringify(fullUser))
          } else {
            const newUserData = {
              username: firebaseUser.email?.split('@')[0] || 'User',
              email: firebaseUser.email,
              threeDartAverage: 0,
              division: null,
              isAdmin: false,
              isTournamentAdmin: false,
              isSubscribed: false,
              freeAdminSubscription: false,
              adminRequestPending: false,
              friends: [],
              isOnline: true,
              showOnlineStatus: true,
              doNotDisturb: false,
              dndEndTime: null,
              eliteTokens: 0,
              lastSeen: new Date().toISOString(),
              createdAt: new Date().toISOString()
            }
            await setDoc(doc(db, 'users', firebaseUser.uid), newUserData)
            const fullUser = { id: firebaseUser.uid, ...newUserData }
            setUser(fullUser)
            localStorage.setItem('eliteArrowsCurrentUser', JSON.stringify(fullUser))
          }
        } catch (e) {
          setUser(null)
          localStorage.removeItem('eliteArrowsCurrentUser')
        }
      } else {
        setUser(null)
        localStorage.removeItem('eliteArrowsCurrentUser')
      }
      setLoading(false)
    })
    return () => unsubscribeAuth()
  }, [])
  
const cleanUserData = (users) => {
    return users.map(u => {
      const cleaned = { ...u }
      SENSITIVE_FIELDS.forEach(field => delete cleaned[field])
      return cleaned
    })
  }
  
  const removeSensitiveFieldsFromFirestore = async (users) => {
    // Also handle specific user deletions by email
    const userToDelete = users.find(u => u.email?.toLowerCase() === 'brentedwards87@gmail.com')
    if (userToDelete && userToDelete.id) {
      try {
        await deleteDoc(doc(db, 'users', userToDelete.id))
        console.log('Deleted user document for brentedwards87@gmail.com')
      } catch (e) {
        console.log('Error deleting user:', e)
      }
    }
    
    for (const user of users) {
      if (user.id) {
        const updates = {}
        SENSITIVE_FIELDS.forEach(field => updates[field] = FieldValue.delete())
        try {
          await updateDoc(doc(db, 'users', user.id), updates)
        } catch (e) {
          console.log('Error removing fields for', user.id, e)
        }
      }
    }
  }

  const runCleanup = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'users'))
      const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      
      // Run cleanup multiple times to ensure fields are deleted
      await removeSensitiveFieldsFromFirestore(users)
      await removeSensitiveFieldsFromFirestore(users)
      await removeSensitiveFieldsFromFirestore(users)
      
      const cleanedUsers = cleanUserData(users)
      if (users.length > 0) {
        setAllUsers(cleanedUsers)
        localStorage.setItem('eliteArrowsUsers', JSON.stringify(cleanedUsers))
      }
      console.log('Cleanup complete - password fields removed from Firestore')
    } catch (e) {
      console.log('Cleanup error:', e)
    }
  }

useEffect(() => {
    runCleanup()
    const timer = setTimeout(runCleanup, 2000)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
          if (userDoc.exists()) {
            let userData = userDoc.data()
            SENSITIVE_FIELDS.forEach(field => delete userData[field])
            const fullUser = { id: userDoc.id, ...userData }
            setUser(fullUser)
            localStorage.setItem('eliteArrowsCurrentUser', JSON.stringify(fullUser))
          } else {
            const newUserData = {
              username: firebaseUser.email?.split('@')[0] || 'User',
              email: firebaseUser.email,
              threeDartAverage: 0,
              division: 'Unassigned',
              isAdmin: false,
              isTournamentAdmin: false,
              isSubscribed: false,
              freeAdminSubscription: false,
              adminRequestPending: false,
              friends: [],
              isOnline: true,
              showOnlineStatus: true,
              doNotDisturb: false,
              dndEndTime: null,
              eliteTokens: 0,
              lastSeen: new Date().toISOString(),
              createdAt: new Date().toISOString()
            }
            await setDoc(doc(db, 'users', firebaseUser.uid), newUserData)
            const fullUser = { id: firebaseUser.uid, ...newUserData }
            setUser(fullUser)
            localStorage.setItem('eliteArrowsCurrentUser', JSON.stringify(fullUser))
          }
        } catch (e) {
          setUser(null)
        }
      } else {
        setUser(null)
      }
      setLoading(false)
    })
    return () => unsubscribeAuth()
  }, [])

  const signUp = async (userData, rememberMe = false) => {
    const emailLower = userData.email.toLowerCase()
    const isAdmin = ADMIN_EMAILS.includes(emailLower)

    try {
      const { user: firebaseUser } = await createUserWithEmailAndPassword(auth, userData.email, userData.password)
      
      const { password, threeDartAverage, ...userDataWithoutPassword } = userData
      
      const newUser = {
        ...userDataWithoutPassword,
        threeDartAverage: threeDartAverage || 0,
        division: isAdmin ? 'Admin' : null,
        isAdmin: isAdmin,
        isTournamentAdmin: false,
        isSubscribed: isAdmin || userData.isSubscribed || false,
        freeAdminSubscription: isAdmin || false,
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
      
      const cleanedUser = { ...newUser }
      const fullUser = { id: firebaseUser.uid, ...cleanedUser }
      setUser(fullUser)
      localStorage.setItem('eliteArrowsCurrentUser', JSON.stringify(fullUser))
      
      const updatedUsers = [...allUsers, fullUser]
      const cleanedUpdated = updatedUsers.map(u => {
        const { password, ...rest } = u
        return rest
      })
      setAllUsers(cleanedUpdated)
      localStorage.setItem('eliteArrowsUsers', JSON.stringify(cleanedUpdated))
      
      return newUser
    } catch (error) {
      throw new Error(error.message)
    }
  }

  const signIn = async (email, password, rememberMe = false) => {
    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence)
      await signInWithEmailAndPassword(auth, email, password)
      return
    } catch (error) {
      throw new Error(error.message)
    }
  }

  const handleSignOut = async () => {
    if (user) {
      try {
        await setDoc(doc(db, 'users', user.id), { isOnline: false, lastSeen: new Date().toISOString() }, { merge: true })
      } catch (e) {}
    }
    await firebaseSignOut(auth)
    setUser(null)
  }

  const updateUser = async (updates) => {
    if (!user?.id) return
    try {
      const userRef = doc(db, 'users', user.id)
      await setDoc(userRef, updates, { merge: true })
      
      setTimeout(async () => {
        const freshDoc = await getDoc(userRef)
        if (freshDoc.exists()) {
          const freshData = freshDoc.data()
          SENSITIVE_FIELDS.forEach(field => delete freshData[field])
          const updatedUser = { ...user, ...freshData, _timestamp: Date.now() }
          
          setUser(updatedUser)
          localStorage.setItem('eliteArrowsCurrentUser', JSON.stringify(updatedUser))
          
          setAllUsers(prevUsers => {
            const updatedUsers = prevUsers.map(u => 
              u.id === user.id ? { ...u, ...freshData } : u
            )
            localStorage.setItem('eliteArrowsUsers', JSON.stringify(updatedUsers))
            return updatedUsers
          })
        }
      }, 100)
    } catch (error) {
      console.error('Error updating user:', error)
    }
  }

  const addUserManually = async (userData) => {
    const emailLower = userData.email.toLowerCase()
    const isAdmin = ADMIN_EMAILS.includes(emailLower)

    const newUser = {
      ...userData,
      threeDartAverage: userData.threeDartAverage || 0,
      division: null,
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
    const currentRequests = user.sentFriendRequests || []
    if (currentRequests.includes(friendId)) return
    
    await updateUser({ sentFriendRequests: [...currentRequests, friendId] })
    
    const allUsersData = getAllUsers()
    const friendUser = allUsersData.find(u => u.id === friendId)
    
    const notification = {
      id: `friend_request_${Date.now()}`,
      type: 'friend_request',
      fromUserId: user.id,
      fromUsername: user.username,
      toUserId: friendId,
      toUsername: friendUser?.username || 'Unknown',
      message: `${user.username} sent you a friend request`,
      isRead: false,
      createdAt: new Date().toISOString()
    }
    
    const existingNotifications = JSON.parse(localStorage.getItem('eliteArrowsNotifications') || '[]')
    localStorage.setItem('eliteArrowsNotifications', JSON.stringify([...existingNotifications, notification]))
    
    try {
      await addDoc(collection(db, 'notifications'), {
        ...notification
      })
    } catch (e) {
      console.log('Error saving to Firebase:', e)
    }
    
    alert('Friend request sent!')
  }

  const acceptFriendRequest = async (userId) => {
    if (!user) return
    const currentFriends = user.friends || []
    const currentRequests = user.receivedFriendRequests || []
    const newFriends = [...currentFriends, userId]
    const newRequests = currentRequests.filter(id => id !== userId)
    await updateUser({ friends: newFriends, receivedFriendRequests: newRequests })
    
    const allUsersData = getAllUsers()
    const requestUser = allUsersData.find(u => u.id === userId)
    
    const notification = {
      id: `friend_accepted_${Date.now()}`,
      type: 'friend_accepted',
      fromUserId: user.id,
      fromUsername: user.username,
      toUserId: userId,
      toUsername: requestUser?.username || 'Unknown',
      message: `${user.username} accepted your friend request`,
      isRead: false,
      createdAt: new Date().toISOString()
    }
    const existingNotifications = JSON.parse(localStorage.getItem('eliteArrowsNotifications') || '[]')
    localStorage.setItem('eliteArrowsNotifications', JSON.stringify([...existingNotifications, notification]))
    
    try {
      await addDoc(collection(db, 'notifications'), {
        ...notification
      })
    } catch (e) {
      console.log('Error saving to Firebase:', e)
    }
  }

  const declineFriendRequest = async (userId) => {
    if (!user) return
    const currentRequests = user.receivedFriendRequests || []
    await updateUser({ receivedFriendRequests: currentRequests.filter(id => id !== userId) })
  }

  const cancelFriendRequest = async (userId) => {
    if (!user) return
    const currentSent = user.sentFriendRequests || []
    await updateUser({ sentFriendRequests: currentSent.filter(id => id !== userId) })
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

  const getAllUsers = () => {
    if (allUsers.length > 0) return allUsers
    const localUsers = JSON.parse(localStorage.getItem('eliteArrowsUsers') || '[]')
    return localUsers
  }

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

  useEffect(() => {
    if (!user?.id) return
    const storedNotifs = JSON.parse(localStorage.getItem('eliteArrowsNotifications') || '[]')
    setNotifications(storedNotifs.filter(n => n.toUserId === user.id))
  }, [user?.id])

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      notifications,
      signUp, 
      signIn, 
      signOut: handleSignOut, 
      updateUser,
      addUserManually,
      addFriend,
      acceptFriendRequest,
      declineFriendRequest,
      cancelFriendRequest,
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