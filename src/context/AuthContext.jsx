import { createContext, useContext, useState, useEffect } from 'react'
import { db, auth, usersCollection, notificationsCollection, doc, setDoc, getDoc, getDocs, query, where, orderBy, onSnapshot, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut as firebaseSignOut, onAuthStateChanged, setPersistence, browserSessionPersistence, browserLocalPersistence } from '../firebase'

const AuthContext = createContext(null)

const ADMIN_EMAIL = 'rhyshowe2023@outlook.com'

export const DIVISIONS = ['Elite', 'Diamond', 'Gold', 'Silver', 'Bronze']

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [allUsers, setAllUsers] = useState([])
  const [notifications, setNotifications] = useState([])

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
          if (userDoc.exists()) {
            setUser({ id: userDoc.id, ...userDoc.data() })
          } else {
            await firebaseSignOut(auth)
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

  useEffect(() => {
    if (!user?.id) return
    
    let unsubscribe = null
    try {
      unsubscribe = onSnapshot(
        query(notificationsCollection, where('toUserId', '==', user.id), orderBy('createdAt', 'desc')),
        (snapshot) => {
          const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
          setNotifications(notifs)
        },
        (error) => {
          console.log('Notifications error (may need Firestore rules):', error.message)
          setNotifications([])
        }
      )
    } catch (e) {
      console.log('Notifications setup error:', e.message)
      setNotifications([])
    }
    return () => { if (unsubscribe) unsubscribe() }
  }, [user?.id])

  const signUp = async (userData, rememberMe = false) => {
    const emailLower = userData.email.toLowerCase()
    const isAdmin = emailLower === ADMIN_EMAIL.toLowerCase()

    try {
      console.log('Attempting Firebase sign up...')
      const { user: firebaseUser } = await createUserWithEmailAndPassword(auth, userData.email, userData.password)
      console.log('Firebase auth successful, user ID:', firebaseUser.uid)
      
      const newUser = {
        ...userData,
        threeDartAverage: userData.threeDartAverage || 0,
        division: null,
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
      
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence)
      const { user: firebaseUser } = await signInWithEmailAndPassword(auth, email, password)
      console.log('Firebase auth successful, user ID:', firebaseUser.uid)
      
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
      console.log('User doc exists:', userDoc.exists())
      
      if (!userDoc.exists()) {
        await firebaseSignOut(auth)
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
    if (!user) return
    try {
      await setDoc(doc(db, 'users', user.id), updates, { merge: true })
      setUser({ ...user, ...updates })
      
      const localUsers = JSON.parse(localStorage.getItem('eliteArrowsUsers') || '[]')
      const index = localUsers.findIndex(u => u.id === user.id)
      if (index !== -1) {
        localUsers[index] = { ...localUsers[index], ...updates }
        localStorage.setItem('eliteArrowsUsers', JSON.stringify(localUsers))
      }
    } catch (error) {
      console.error('Error updating user:', error)
    }
  }

  const addUserManually = async (userData) => {
    const emailLower = userData.email.toLowerCase()
    const isAdmin = emailLower === ADMIN_EMAIL.toLowerCase()

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
    if (currentRequests.includes(friendId)) {
      return
    }
    await updateUser({ 
      sentFriendRequests: [...currentRequests, friendId]
    })
    const friend = allUsers.find(u => u.id === friendId)
    if (friend) {
      const friendRequests = friend.receivedFriendRequests || []
      await setDoc(doc(db, 'users', friendId), { 
        receivedFriendRequests: [...friendRequests, user.id] 
      }, { merge: true })
      const notification = {
        id: `friend_request_${Date.now()}`,
        type: 'friend_request',
        fromUserId: user.id,
        fromUsername: user.username,
        toUserId: friendId,
        message: `${user.username} sent you a friend request`,
        isRead: false,
        createdAt: new Date().toISOString()
      }
      const existingNotifications = JSON.parse(localStorage.getItem('eliteArrowsNotifications') || '[]')
      localStorage.setItem('eliteArrowsNotifications', JSON.stringify([...existingNotifications, notification]))
      alert('Friend request sent!')
    }
  }

  const acceptFriendRequest = async (userId) => {
    if (!user) return
    const currentFriends = user.friends || []
    const currentRequests = user.receivedFriendRequests || []
    const newFriends = [...currentFriends, userId]
    const newRequests = currentRequests.filter(id => id !== userId)
    await updateUser({ 
      friends: newFriends,
      receivedFriendRequests: newRequests
    })
    const requester = allUsers.find(u => u.id === userId)
    if (requester) {
      const requesterFriends = requester.friends || []
      const requesterSent = requester.sentFriendRequests || []
      await setDoc(doc(db, 'users', userId), { 
        friends: [...requesterFriends, user.id],
        sentFriendRequests: requesterSent.filter(id => id !== user.id)
      }, { merge: true })
      const notification = {
        id: `friend_accepted_${Date.now()}`,
        type: 'friend_accepted',
        fromUserId: user.id,
        fromUsername: user.username,
        toUserId: userId,
        message: `${user.username} accepted your friend request`,
        isRead: false,
        createdAt: new Date().toISOString()
      }
      const existingNotifications = JSON.parse(localStorage.getItem('eliteArrowsNotifications') || '[]')
      localStorage.setItem('eliteArrowsNotifications', JSON.stringify([...existingNotifications, notification]))
    }
  }

  const declineFriendRequest = async (userId) => {
    if (!user) return
    const currentRequests = user.receivedFriendRequests || []
    await updateUser({ 
      receivedFriendRequests: currentRequests.filter(id => id !== userId)
    })
    const requester = allUsers.find(u => u.id === userId)
    if (requester) {
      const notification = {
        id: `friend_rejected_${Date.now()}`,
        type: 'friend_rejected',
        fromUserId: user.id,
        fromUsername: user.username,
        toUserId: userId,
        message: `${user.username} declined your friend request`,
        isRead: false,
        createdAt: new Date().toISOString()
      }
      const existingNotifications = JSON.parse(localStorage.getItem('eliteArrowsNotifications') || '[]')
      localStorage.setItem('eliteArrowsNotifications', JSON.stringify([...existingNotifications, notification]))
    }
  }

  const cancelFriendRequest = async (userId) => {
    if (!user) return
    const currentSent = user.sentFriendRequests || []
    await updateUser({ 
      sentFriendRequests: currentSent.filter(id => id !== userId)
    })
    const friend = allUsers.find(u => u.id === userId)
    if (friend) {
      const friendRequests = friend.receivedFriendRequests || []
      await setDoc(doc(db, 'users', userId), { 
        receivedFriendRequests: friendRequests.filter(id => id !== user.id)
      }, { merge: true })
    }
  }

  const removeFriend = async (friendId) => {
    if (!user) return
    const newFriends = (user.friends || []).filter(id => id !== friendId)
    await updateUser({ friends: newFriends })
    const friend = allUsers.find(u => u.id === friendId)
    if (friend) {
      const friendFriends = friend.friends || []
      await setDoc(doc(db, 'users', friendId), { 
        friends: friendFriends.filter(id => id !== user.id)
      }, { merge: true })
    }
  }

  const subscribe = () => {
    updateUser({ isSubscribed: true, paymentDate: new Date().toISOString() })
  }

  const requestAdminRole = () => {
    updateUser({ adminRequestPending: true })
  }

  const getAllUsers = () => {
    const localUsers = JSON.parse(localStorage.getItem('eliteArrowsUsers') || '[]')
    if (localUsers.length > allUsers.length) {
      return localUsers
    }
    return allUsers
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