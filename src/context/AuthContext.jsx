import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { db, auth, usersCollection, adminDataCollection, fcmTokensCollection, doc, setDoc, getDoc, getDocs, query, where, collection, orderBy, onSnapshot, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut as firebaseSignOut, onAuthStateChanged, setPersistence, browserSessionPersistence, browserLocalPersistence, updateDoc, deleteDoc, FieldValue, getMessagingInstance, getToken, onMessage, isSupported } from '../firebase'
import SeasonOneWelcomeModal from '../components/SeasonOneWelcomeModal'
import { getResultIdentityKey, getResultOverrideKeys } from '../utils/resultIdentity'

const AuthContext = createContext(null)

const ADMIN_EMAILS = ['rhyshowe2023@outlook.com', 'dhineberry@yahoo.com', 'test@elitearrows.co.uk']
const SEASON_ONE_WELCOME_START = new Date('2026-05-01T00:00:00+01:00').getTime()

export const DIVISIONS = ['Elite', 'Diamond', 'Platinum', 'Gold', 'Silver', 'Bronze', 'Development']

const RESULT_CACHE_KEY = 'eliteArrowsResults'
const RESULT_PROOF_FIELDS = ['proofImage', 'proof', 'proofUrl', 'proofImageUrl', 'proofFile']
const MINIMAL_RESULT_CACHE_FIELDS = [
  'id',
  'firestoreId',
  'fixtureId',
  'cupId',
  'matchId',
  'player1',
  'player1Id',
  'player2',
  'player2Id',
  'score1',
  'score2',
  'division',
  'gameType',
  'season',
  'date',
  'submittedAt',
  'approvedAt',
  'updatedAt',
  'status',
  'submittedBy',
  'bestOf',
  'firstTo',
  'player1Stats',
  'player2Stats'
]

const stripResultProofForCache = (result) => {
  const cached = { ...result }
  let hasProofImage = Boolean(cached.hasProofImage)
  RESULT_PROOF_FIELDS.forEach(field => {
    if (cached[field]) hasProofImage = true
    delete cached[field]
  })
  if (hasProofImage) cached.hasProofImage = true
  return cached
}

const minimizeResultForCache = (result) => {
  const cached = {}
  MINIMAL_RESULT_CACHE_FIELDS.forEach(field => {
    if (result[field] !== undefined) cached[field] = result[field]
  })
  if (RESULT_PROOF_FIELDS.some(field => result[field])) cached.hasProofImage = true
  return cached
}

const getCachedResults = () => {
  try {
    return JSON.parse(localStorage.getItem(RESULT_CACHE_KEY) || '[]')
  } catch (error) {
    console.warn('Could not read cached results:', error)
    localStorage.removeItem(RESULT_CACHE_KEY)
    return []
  }
}

const saveResultsCache = (results) => {
  const resultList = Array.isArray(results) ? results : []
  try {
    localStorage.setItem(RESULT_CACHE_KEY, JSON.stringify(resultList.map(stripResultProofForCache)))
    return
  } catch (error) {
    console.warn('Could not cache full result metadata:', error)
  }

  try {
    localStorage.setItem(RESULT_CACHE_KEY, JSON.stringify(resultList.map(minimizeResultForCache)))
  } catch (error) {
    console.warn('Could not cache results locally:', error)
    localStorage.removeItem(RESULT_CACHE_KEY)
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [allUsers, setAllUsers] = useState([])
  const [notifications, setNotifications] = useState([])
  const [results, setResults] = useState([])
  const [fixtures, setFixtures] = useState([])
  const [cups, setCups] = useState([])
  const [bets, setBets] = useState([])
  const [supportRequests, setSupportRequests] = useState([])
  const [seasons, setSeasons] = useState([])
  const [dataRefreshTrigger, setDataRefreshTrigger] = useState(0)
  const [adminData, setAdminData] = useState({
    subscriptionPot: 0,
    subscriptionPot10: 0,
    moneyHistory: [],
    leagueTableResetAt: null,
    isMaintenanceMode: false,
    maintenanceMessage: ''
  })
  const [notificationPermission, setNotificationPermission] = useState('default')
  const [fcmToken, setFcmToken] = useState(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [news, setNews] = useState([])
  const [showSeasonOneWelcome, setShowSeasonOneWelcome] = useState(false)
  const unsubscribeRef = useRef(null)
  const seenNotificationIdsRef = useRef(new Set())
  const resultRowsRef = useRef([])
  const resultStatusOverridesRef = useRef((() => {
    try {
      return JSON.parse(localStorage.getItem('eliteArrowsResultStatusOverrides') || '{}')
    } catch (e) {
      return {}
    }
  })())
  
  const SENSITIVE_FIELDS = ['password', 'passwordString', 'passwordHash', 'passwordKey', 'passwordStringValue', 'password', 'firebaseId', 'pwd', 'pass', 'passwd']

  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications')
      return false
    }

    if (Notification.permission === 'granted') {
      setNotificationPermission('granted')
      return true
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission()
      setNotificationPermission(permission)
      
      if (permission === 'granted') {
        await registerFCMToken()
        return true
      }
      return false
    }

    setNotificationPermission('denied')
    return false
  }, [user?.id])

  const registerFCMToken = useCallback(async () => {
    if (!user?.id) return null
    
    try {
      const supported = await isSupported()
      if (!supported) {
        console.log('Firebase messaging not supported')
        return null
      }

      const messaging = await getMessagingInstance()
      if (!messaging) return null

      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
        console.log('FCM SW registered:', registration)
      }

      const token = await getToken(messaging, {
        vapidKey: 'BCeZoSxuL3tWAkXFIGr1x8-Ns4YwOm2iffUVL2yUDK02QhEfMPpJ61CH349hX7cXjBAjSF92_EsZKzmyJXynnxg',
        serviceWorkerRegistration: await navigator.serviceWorker.getRegistration()
      })

      if (token) {
        setFcmToken(token)
        localStorage.setItem('eliteArrowsFcmToken', token)
        
        await setDoc(doc(db, 'fcmTokens', user.id), {
          userId: user.id,
          username: user.username,
          token: token,
          updatedAt: new Date().toISOString()
        }, { merge: true })

        console.log('FCM Token registered:', token.substring(0, 20) + '...')
        return token
      }
    } catch (error) {
      console.error('Error registering FCM token:', error)
    }
    return null
  }, [user?.id, user?.username])

  const showLocalNotification = useCallback((title, options = {}) => {
    if (Notification.permission === 'granted') {
      const notification = new Notification(title, {
        icon: '/elite arrows.jpg',
        badge: '/elite arrows.jpg',
        ...options
      })
      
      notification.onclick = () => {
        window.focus()
        notification.close()
        if (options.data?.url) {
          window.location.href = options.data.url
        }
      }
    }
  }, [])

  const updateBadgeCount = useCallback((count) => {
    setUnreadCount(count)
    localStorage.setItem('eliteArrowsUnreadCount', String(count))
    
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        registration.active?.postMessage({
          type: 'SET_BADGE',
          count: count
        })
      })
    }
    
    if (count > 0 && navigator.setAppBadge) {
      navigator.setAppBadge(count).catch(() => {})
    } else if (count === 0 && navigator.clearAppBadge) {
      navigator.clearAppBadge().catch(() => {})
    }
  }, [])

  const sendNotification = useCallback(async (toUserId, notification) => {
    const newNotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...notification,
      toUserId,
      isRead: false,
      createdAt: new Date().toISOString()
    }
    
    try {
      await setDoc(doc(db, 'notifications', newNotification.id), newNotification)
    } catch (e) {
      console.log('Error saving notification to Firebase:', e)
    }
    
    if (user?.id === toUserId) {
      setNotifications(prev => [newNotification, ...prev])
      setUnreadCount(prev => prev + 1)
      updateBadgeCount(unreadCount + 1)
      const existingNotifications = JSON.parse(localStorage.getItem('eliteArrowsNotifications') || '[]')
      existingNotifications.unshift(newNotification)
      localStorage.setItem('eliteArrowsNotifications', JSON.stringify(existingNotifications))
      showLocalNotification(notification.title || 'Elite Arrows', {
        body: notification.message || 'New notification',
        data: notification.data
      })
    }
    
    return newNotification
  }, [user?.id, unreadCount, updateBadgeCount, showLocalNotification])

  const notifyAllSubscribers = useCallback(async (title, body, data = {}) => {
    const subscribers = allUsers.filter(u => u.isSubscribed || u.isAdmin)
    
    for (const subscriber of subscribers) {
      await sendNotification(subscriber.id, {
        type: data.type || 'table_updated',
        title,
        message: body,
        data
      })
    }
    
    if (subscribers.some(s => s.id === user?.id)) {
      setUnreadCount(prev => prev + subscribers.length)
      updateBadgeCount(unreadCount + subscribers.length)
    }
  }, [allUsers, user?.id, unreadCount, updateBadgeCount, sendNotification])

  const notifyAdmins = useCallback(async (title, body, data = {}) => {
    const admins = allUsers.filter(u => (
      u.isAdmin ||
      u.isTournamentAdmin ||
      u.isCupAdmin ||
      ADMIN_EMAILS.includes(u.email?.toLowerCase())
    ))
    
    for (const admin of admins) {
      await sendNotification(admin.id, {
        type: data.type || 'admin_alert',
        title,
        message: body,
        data
      })
    }
  }, [allUsers, sendNotification])

  const notifyUser = useCallback(async (toUserId, title, body, type, data = {}) => {
    await sendNotification(toUserId, {
      type,
      title,
      message: body,
      data
    })
  }, [sendNotification])

  const triggerDataRefresh = useCallback((dataType = 'all') => {
    setDataRefreshTrigger(prev => prev + 1)
    console.log(`Data refresh triggered: ${dataType}`)
  }, [])

  const publishResults = useCallback((options = {}) => {
    const { announce = true } = options
    const statusRank = { approved: 3, rejected: 3, pending: 2 }
    let storedOverrides = {}
    try {
      storedOverrides = JSON.parse(localStorage.getItem('eliteArrowsResultStatusOverrides') || '{}')
    } catch (error) {
      storedOverrides = {}
    }
    const overrides = { ...(resultStatusOverridesRef.current || {}), ...storedOverrides }
    resultStatusOverridesRef.current = overrides
    const resultRows = resultRowsRef.current.map(row => {
      const override = getResultOverrideKeys(row)
        .map(key => overrides[key])
        .find(Boolean)
      return override ? { ...row, status: override.status } : row
    })

    const resultsData = Array.from(resultRows.reduce((byId, row) => {
      const logicalId = getResultIdentityKey(row)
      const existing = byId.get(logicalId)
      if (!existing) {
        byId.set(logicalId, row)
        return byId
      }

      const existingHasPlayers = existing.player1 || existing.player2
      const rowHasPlayers = row.player1 || row.player2
      const base = rowHasPlayers && !existingHasPlayers ? row : existing
      const overlay = base === row ? existing : row
      const preferredStatus = (statusRank[overlay.status] || 0) > (statusRank[base.status] || 0)
        ? overlay.status
        : base.status

      byId.set(logicalId, {
        ...overlay,
        ...base,
        id: base.id || overlay.id,
        status: preferredStatus,
        firestoreId: rowHasPlayers ? row.firestoreId : existing.firestoreId
      })
      return byId
    }, new Map()).values())

    setResults(resultsData)
    saveResultsCache(resultsData)
    if (announce) {
      triggerDataRefresh('results')
    }
  }, [triggerDataRefresh])

  useEffect(() => {
    if (!user?.id) return

    const hydratedCollections = new Set()
    const announceAfterHydration = (collectionName) => {
      if (!hydratedCollections.has(collectionName)) {
        hydratedCollections.add(collectionName)
        return false
      }
      triggerDataRefresh(collectionName)
      return true
    }

    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const users = snapshot.docs.map(doc => {
        const data = doc.data()
        SENSITIVE_FIELDS.forEach(field => delete data[field])
        return { id: doc.id, ...data }
      })
      setAllUsers(users)
      localStorage.setItem('eliteArrowsUsers', JSON.stringify(users))
      const currentUser = users.find(item => String(item.id) === String(user.id))
      if (currentUser) {
        setUser(prev => {
          if (!prev || String(prev.id) !== String(currentUser.id)) return prev
          const nextUser = { ...prev, ...currentUser }
          localStorage.setItem('eliteArrowsCurrentUser', JSON.stringify(nextUser))
          return nextUser
        })
      }
      announceAfterHydration('users')
    }, (error) => {
      console.log('Users listener error:', error)
    })
    
    const unsubscribeResults = onSnapshot(collection(db, 'results'), (snapshot) => {
      resultRowsRef.current = snapshot.docs.map(docSnap => {
        const data = docSnap.data()
        return {
          ...data,
          id: data.id || docSnap.id,
          firestoreId: docSnap.id
        }
      })
      const shouldAnnounce = hydratedCollections.has('results')
      hydratedCollections.add('results')
      publishResults({ announce: shouldAnnounce })
    }, (error) => {
      console.log('Results listener error:', error)
    })
    
    const unsubscribeFixtures = onSnapshot(collection(db, 'fixtures'), (snapshot) => {
      const fixturesData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(item => !item._deleted)
      setFixtures(fixturesData)
      localStorage.setItem('eliteArrowsFixtures', JSON.stringify(fixturesData))
      announceAfterHydration('fixtures')
    }, (error) => {
      console.log('Fixtures listener error:', error)
    })
    
    const unsubscribeCups = onSnapshot(collection(db, 'cups'), (snapshot) => {
      const cupsData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(item => !item._deleted)
      setCups(cupsData)
      localStorage.setItem('eliteArrowsCups', JSON.stringify(cupsData))
      announceAfterHydration('cups')
    }, (error) => {
      console.log('Cups listener error:', error)
    })

    const unsubscribeBets = onSnapshot(collection(db, 'bets'), (snapshot) => {
      const betsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setBets(betsData)
      localStorage.setItem('eliteArrowsBets', JSON.stringify(betsData))
      announceAfterHydration('bets')
    }, (error) => {
      console.log('Bets listener error:', error)
    })
    
    const unsubscribeSupport = onSnapshot(collection(db, 'supportRequests'), (snapshot) => {
      const supportData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(item => !item._deleted)
      setSupportRequests(supportData)
      localStorage.setItem('eliteArrowsSupportRequests', JSON.stringify(supportData))
      announceAfterHydration('supportRequests')
    }, (error) => {
      console.log('Support listener error:', error)
    })
    
    const unsubscribeSeasons = onSnapshot(collection(db, 'seasons'), (snapshot) => {
      const seasonsData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(item => !item._deleted)
      setSeasons(seasonsData)
      localStorage.setItem('eliteArrowsSeasons', JSON.stringify(seasonsData))
      if (seasonsData.length > 0) {
        const activeSeason = seasonsData.find(s => s.isActive)
        if (activeSeason) {
          localStorage.setItem('eliteArrowsCurrentSeason', activeSeason.name)
        }
      }
      announceAfterHydration('seasons')
    }, (error) => {
      console.log('Seasons listener error:', error)
    })
    
    const unsubscribeNews = onSnapshot(query(collection(db, 'news'), orderBy('createdAt', 'desc')), (snapshot) => {
      const newsData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(item => !item._deleted)
      setNews(newsData)
      localStorage.setItem('eliteArrowsNews', JSON.stringify(newsData))
      announceAfterHydration('news')
    }, (error) => {
      console.log('News listener error:', error)
      setNews([])
    })
    
    const unsubscribeAdmin = onSnapshot(doc(db, 'adminData', 'main'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data()
        setAdminData({
          subscriptionPot: data.subscriptionPot || 0,
          subscriptionPot10: data.subscriptionPot10 || 0,
          moneyHistory: data.moneyHistory || [],
          resultStatusOverrides: data.resultStatusOverrides || {},
          leagueTableResetAt: data.leagueTableResetAt || null,
          isMaintenanceMode: data.isMaintenanceMode || false,
          maintenanceMessage: data.maintenanceMessage || ''
        })
        resultStatusOverridesRef.current = data.resultStatusOverrides || {}
        localStorage.setItem('eliteArrowsResultStatusOverrides', JSON.stringify(data.resultStatusOverrides || {}))
        localStorage.setItem('eliteArrowsSubscriptionPot', String(data.subscriptionPot || 0))
        localStorage.setItem('eliteArrowsSubscriptionPot10', String(data.subscriptionPot10 || 0))
        localStorage.setItem('eliteArrowsMoneyHistory', JSON.stringify(data.moneyHistory || []))
        publishResults({ announce: hydratedCollections.has('adminData') })
      }
      hydratedCollections.add('adminData')
    }, (error) => {
      console.log('Admin data listener error:', error)
    })
    
    return () => {
      unsubscribeUsers()
      unsubscribeResults()
      unsubscribeFixtures()
      unsubscribeCups()
      unsubscribeBets()
      unsubscribeSupport()
      unsubscribeSeasons()
      unsubscribeNews()
      unsubscribeAdmin()
    }
  }, [user?.id, triggerDataRefresh, publishResults])
  
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
          const stored = localStorage.getItem('eliteArrowsCurrentUser')
          if (stored) setUser(JSON.parse(stored))
        }
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

  const updateUser = async (updates, showAlert = true) => {
    if (!user?.id) return
    
    const cleanUpdates = {}
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined && updates[key] !== null && updates[key] !== '') {
        cleanUpdates[key] = updates[key]
      }
    })
    
    if (Object.keys(cleanUpdates).length === 0) return
    
    try {
      const userRef = doc(db, 'users', user.id)
      await setDoc(userRef, cleanUpdates, { merge: true })
      
      const updatedUser = { ...user, ...cleanUpdates }
      setUser(updatedUser)
      localStorage.setItem('eliteArrowsCurrentUser', JSON.stringify(updatedUser))
      
      setAllUsers(prev => {
        const updated = prev.map(u => u.id === user.id ? { ...u, ...cleanUpdates } : u)
        localStorage.setItem('eliteArrowsUsers', JSON.stringify(updated))
        return updated
      })
      
      if (showAlert) alert('Profile updated!')
    } catch (error) {
      if (showAlert) alert('Error: ' + error.message)
    }
  }

  const updateOtherUser = async (userId, updates) => {
    const cleanUpdates = {}
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        cleanUpdates[key] = updates[key]
      }
    })
    
    if (Object.keys(cleanUpdates).length === 0) return
    
    try {
      const userRef = doc(db, 'users', userId)
      await setDoc(userRef, cleanUpdates, { merge: true })
      
      if (userId === user?.id) {
        const updatedUser = { ...user, ...cleanUpdates }
        setUser(updatedUser)
        localStorage.setItem('eliteArrowsCurrentUser', JSON.stringify(updatedUser))
      }

      setAllUsers(prev => {
        const sourceUsers = prev.length > 0 ? prev : JSON.parse(localStorage.getItem('eliteArrowsUsers') || '[]')
        const updated = sourceUsers.map(u => u.id === userId ? { ...u, ...cleanUpdates } : u)
        localStorage.setItem('eliteArrowsUsers', JSON.stringify(updated))
        return updated
      })
    } catch (error) {
      console.error('Error updating user:', error)
      throw error
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
    if ((user.friends || []).includes(friendId)) {
      return
    }
    
    const allUsersData = getAllUsers()
    const friendUser = allUsersData.find(u => u.id === friendId)
    if (!friendUser) {
      return
    }

    const userFriends = Array.from(new Set([...(user.friends || []), friendId]))
    const friendFriends = Array.from(new Set([...(friendUser.friends || []), user.id]))

    await updateUser({
      friends: userFriends,
      sentFriendRequests: (user.sentFriendRequests || []).filter(id => id !== friendId),
      receivedFriendRequests: (user.receivedFriendRequests || []).filter(id => id !== friendId)
    }, false)
    try {
      await updateOtherUser(friendId, {
        friends: friendFriends,
        sentFriendRequests: (friendUser.sentFriendRequests || []).filter(id => id !== user.id),
        receivedFriendRequests: (friendUser.receivedFriendRequests || []).filter(id => id !== user.id)
      })
    } catch (error) {
      console.warn('Could not update friend record immediately:', error)
    }
    
    const notification = {
      id: `friend_added_${Date.now()}`,
      type: 'friend_accepted',
      fromUserId: user.id,
      fromUsername: user.username,
      toUserId: friendId,
      toUsername: friendUser?.username || 'Unknown',
      message: `${user.username} added you as a friend`,
      isRead: false,
      createdAt: new Date().toISOString()
    }
    
    const existingNotifications = JSON.parse(localStorage.getItem('eliteArrowsNotifications') || '[]')
    localStorage.setItem('eliteArrowsNotifications', JSON.stringify([...existingNotifications, notification]))
    
    try {
      await setDoc(doc(db, 'notifications', notification.id), notification)
    } catch (e) {
      console.log('Error saving to Firebase:', e)
    }
  }

  const acceptFriendRequest = async (userId) => {
    if (!user) return
    const allUsersData = getAllUsers()
    const requestUser = allUsersData.find(u => u.id === userId)
    if (!requestUser) return

    const currentFriends = user.friends || []
    const currentRequests = user.receivedFriendRequests || []
    const newFriends = Array.from(new Set([...currentFriends, userId]))
    const newRequests = currentRequests.filter(id => id !== userId)
    await updateUser({ friends: newFriends, receivedFriendRequests: newRequests }, false)
    await updateOtherUser(userId, {
      friends: Array.from(new Set([...(requestUser.friends || []), user.id])),
      sentFriendRequests: (requestUser.sentFriendRequests || []).filter(id => id !== user.id)
    })
    
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
      await setDoc(doc(db, 'notifications', notification.id), notification)
    } catch (e) {
      console.log('Error saving to Firebase:', e)
    }
  }

  const declineFriendRequest = async (userId) => {
    if (!user) return
    const requestUser = getAllUsers().find(u => u.id === userId)
    const currentRequests = user.receivedFriendRequests || []
    await updateUser({ receivedFriendRequests: currentRequests.filter(id => id !== userId) }, false)
    if (requestUser) {
      await updateOtherUser(userId, {
        sentFriendRequests: (requestUser.sentFriendRequests || []).filter(id => id !== user.id)
      })
    }
  }

  const cancelFriendRequest = async (userId) => {
    if (!user) return
    const requestUser = getAllUsers().find(u => u.id === userId)
    const currentSent = user.sentFriendRequests || []
    await updateUser({ sentFriendRequests: currentSent.filter(id => id !== userId) }, false)
    if (requestUser) {
      await updateOtherUser(userId, {
        receivedFriendRequests: (requestUser.receivedFriendRequests || []).filter(id => id !== user.id)
      })
    }
  }

  const removeFriend = async (friendId) => {
    if (!user) return
    const friendUser = getAllUsers().find(u => u.id === friendId)
    const newFriends = (user.friends || []).filter(id => id !== friendId)
    await updateUser({ friends: newFriends }, false)
    if (friendUser) {
      await updateOtherUser(friendId, {
        friends: (friendUser.friends || []).filter(id => id !== user.id)
      })
    }
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

  const getResults = () => {
    if (results.length > 0) return results
    return getCachedResults()
  }

  const updateResults = (updatedResults) => {
    const nextResults = Array.isArray(updatedResults) ? updatedResults : []
    resultRowsRef.current = nextResults
    setResults(nextResults)
    saveResultsCache(nextResults)
    triggerDataRefresh('results')
  }

  const getFixtures = () => {
    if (fixtures.length > 0) return fixtures
    const local = JSON.parse(localStorage.getItem('eliteArrowsFixtures') || '[]')
    return local
  }

  useEffect(() => {
    if (!user?.id) {
      setShowSeasonOneWelcome(false)
      return
    }

    const updateSeasonOneWelcome = () => {
      const isSubscriberOrAdmin = user.isSubscribed || user.isAdmin || user.isTournamentAdmin
      const seasonHasStarted = Date.now() >= SEASON_ONE_WELCOME_START
      const localAcknowledged = localStorage.getItem(`eliteArrowsSeasonOneWelcome_${user.id}`) === 'acknowledged'
      setShowSeasonOneWelcome(Boolean(
        isSubscriberOrAdmin &&
        seasonHasStarted &&
        !user.seasonOneWelcomeAcknowledged &&
        !localAcknowledged
      ))
    }

    updateSeasonOneWelcome()

    const delayUntilSeasonStarts = SEASON_ONE_WELCOME_START - Date.now()
    if (delayUntilSeasonStarts <= 0) return

    const timer = setTimeout(updateSeasonOneWelcome, Math.min(delayUntilSeasonStarts, 2147483647))
    return () => clearTimeout(timer)
  }, [user?.id, user?.isSubscribed, user?.isAdmin, user?.isTournamentAdmin, user?.seasonOneWelcomeAcknowledged])

  const acknowledgeSeasonOneWelcome = async () => {
    if (!user?.id) return
    const acknowledgedAt = new Date().toISOString()
    localStorage.setItem(`eliteArrowsSeasonOneWelcome_${user.id}`, 'acknowledged')
    setShowSeasonOneWelcome(false)
    await updateUser({
      seasonOneWelcomeAcknowledged: true,
      seasonOneWelcomeAcknowledgedAt: acknowledgedAt,
      refundPolicyAcknowledged: true,
      refundPolicyAcknowledgedAt: acknowledgedAt
    }, false)
    window.location.reload()
  }

  const updateFixtures = (updatedFixtures) => {
    setFixtures(updatedFixtures)
    localStorage.setItem('eliteArrowsFixtures', JSON.stringify(updatedFixtures))
    triggerDataRefresh('fixtures')
  }

  const getCups = () => {
    if (cups.length > 0) return cups
    const local = JSON.parse(localStorage.getItem('eliteArrowsCups') || '[]')
    return local
  }

  const getSupportRequests = () => {
    if (supportRequests.length > 0) return supportRequests
    const local = JSON.parse(localStorage.getItem('eliteArrowsSupportRequests') || '[]')
    return local
  }

  const getSeasons = () => {
    if (seasons.length > 0) return seasons
    const local = JSON.parse(localStorage.getItem('eliteArrowsSeasons') || '[]')
    return local
  }

  const getNews = () => {
    if (news.length > 0) return news
    const local = JSON.parse(localStorage.getItem('eliteArrowsNews') || '[]')
    return local
  }

  const postNews = async (title, message, pinned = false) => {
    if (!user) return
    const newPost = {
      id: `news_${Date.now()}`,
      title,
      message,
      authorId: user.id,
      authorName: user.username,
      createdAt: new Date().toISOString(),
      pinned
    }
    try {
      await setDoc(doc(db, 'news', newPost.id), newPost, { merge: true })
    } catch (e) {
      console.log('Error posting news to Firebase:', e)
    }
    const local = JSON.parse(localStorage.getItem('eliteArrowsNews') || '[]')
    local.unshift(newPost)
    localStorage.setItem('eliteArrowsNews', JSON.stringify(local))
    setNews(local)
  }

  const deleteNews = async (newsId) => {
    try {
      await deleteDoc(doc(db, 'news', newsId))
    } catch (e) {
      console.log('Error deleting news from Firebase:', e)
    }
    const local = JSON.parse(localStorage.getItem('eliteArrowsNews') || '[]')
    const updated = local.filter(n => n.id !== newsId)
    localStorage.setItem('eliteArrowsNews', JSON.stringify(updated))
    setNews(updated)
  }

  const togglePinNews = async (newsId, currentPinned) => {
    try {
      await setDoc(doc(db, 'news', newsId), { pinned: !currentPinned }, { merge: true })
    } catch (e) {
      console.log('Error pinning news:', e)
    }
    const local = JSON.parse(localStorage.getItem('eliteArrowsNews') || '[]')
    const updated = local.map(n => n.id === newsId ? { ...n, pinned: !currentPinned } : n)
    localStorage.setItem('eliteArrowsNews', JSON.stringify(updated))
    setNews(updated)
  }

  const addTokens = async (amount) => {
    if (!user) return
    const newTokens = (user.eliteTokens || 0) + amount
    await updateUser({ eliteTokens: newTokens }, false)
  }

  const useTokens = async (amount) => {
    if (!user) return false
    if ((user.eliteTokens || 0) < amount) return false
    const newTokens = (user.eliteTokens || 0) - amount
    await updateUser({ eliteTokens: newTokens })
    return true
  }
  
  const updateAdminData = async (newData) => {
    try {
      await setDoc(doc(db, 'adminData', 'main'), newData, { merge: true })
      setAdminData(prev => {
        const next = { ...prev, ...newData }
        try {
          if (Object.prototype.hasOwnProperty.call(newData, 'resultStatusOverrides')) {
            resultStatusOverridesRef.current = newData.resultStatusOverrides || {}
            localStorage.setItem('eliteArrowsResultStatusOverrides', JSON.stringify(newData.resultStatusOverrides || {}))
          }
          if (Object.prototype.hasOwnProperty.call(newData, 'subscriptionPot')) {
            localStorage.setItem('eliteArrowsSubscriptionPot', String(newData.subscriptionPot || 0))
          }
          if (Object.prototype.hasOwnProperty.call(newData, 'subscriptionPot10')) {
            localStorage.setItem('eliteArrowsSubscriptionPot10', String(newData.subscriptionPot10 || 0))
          }
          if (Object.prototype.hasOwnProperty.call(newData, 'moneyHistory')) {
            localStorage.setItem('eliteArrowsMoneyHistory', JSON.stringify(newData.moneyHistory || []))
          }
        } catch (e) {
          console.error('localStorage error (quota exceeded?):', e)
          // Clear problematic keys if quota exceeded
          if (e.name === 'QuotaExceededError' || e.code === 22) {
            localStorage.removeItem('eliteArrowsResultStatusOverrides')
            localStorage.removeItem('eliteArrowsMoneyHistory')
          }
        }
        return next
      })
      console.log('Admin data updated:', newData)
    } catch (e) {
      console.error('Error updating admin data:', e)
    }
  }
  
  const addToMoneyHistory = async (type, amount, description) => {
    try {
      const docRef = doc(db, 'adminData', 'main')
      const docSnap = await getDoc(docRef)
      const currentData = docSnap.exists() ? docSnap.data() : {}
      const currentHistory = currentData.moneyHistory || []
      const newEntry = { id: Date.now(), type, amount, description, date: new Date().toISOString() }
      await setDoc(docRef, { moneyHistory: [...currentHistory, newEntry] }, { merge: true })
    } catch (e) {
      console.error('Error adding to money history:', e)
    }
  }

  useEffect(() => {
    if (!user?.id) {
      setNotifications([])
      setUnreadCount(0)
      updateBadgeCount(0)
      seenNotificationIdsRef.current = new Set()
      return
    }

    const notificationsQuery = query(collection(db, 'notifications'), where('toUserId', '==', user.id))
    const unsubscribeNotifications = onSnapshot(notificationsQuery, (snapshot) => {
      const userNotifs = snapshot.docs
        .map((docSnap) => {
          const data = docSnap.data()
          return {
            ...data,
            id: data.id || docSnap.id,
            notificationDocId: docSnap.id
          }
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

      const previousIds = seenNotificationIdsRef.current
      const nextIds = new Set(userNotifs.map((notification) => notification.id))
      const shouldAnnounceNewNotifications = previousIds.size > 0

      userNotifs.forEach((notification) => {
        if (shouldAnnounceNewNotifications && !previousIds.has(notification.id) && !notification.isRead) {
          showLocalNotification(notification.title || 'Elite Arrows', {
            body: notification.message || 'New notification',
            data: notification.data
          })
        }
      })

      seenNotificationIdsRef.current = nextIds
      setNotifications(userNotifs)
      localStorage.setItem('eliteArrowsNotifications', JSON.stringify(userNotifs))
      const unread = userNotifs.filter(n => !n.isRead).length
      setUnreadCount(unread)
      updateBadgeCount(unread)
    }, (error) => {
      console.log('Notifications listener error:', error)
      const storedNotifs = JSON.parse(localStorage.getItem('eliteArrowsNotifications') || '[]')
      const userNotifs = storedNotifs.filter(n => n.toUserId === user.id)
      setNotifications(userNotifs)
      const unread = userNotifs.filter(n => !n.isRead).length
      setUnreadCount(unread)
      updateBadgeCount(unread)
    })

    return () => unsubscribeNotifications()
  }, [user?.id, showLocalNotification, updateBadgeCount])

  useEffect(() => {
    const setupForegroundMessages = async () => {
      try {
        const messaging = await getMessagingInstance()
        if (!messaging) return
        
        onMessage(messaging, (payload) => {
          console.log('Foreground message received:', payload)
          
          const { title, body, data } = payload
          
          if (Notification.permission === 'granted') {
            new Notification(title || 'Elite Arrows', {
              body: body || 'New notification',
              icon: '/elite arrows.jpg',
              badge: '/elite arrows.jpg',
              data: data
            })
          }
        })
      } catch (error) {
        console.log('FCM onMessage setup error:', error)
      }
    }
    
    if (user?.id) {
      setupForegroundMessages()
    }
  }, [user?.id])

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission)
    }
    
    const storedToken = localStorage.getItem('eliteArrowsFcmToken')
    if (storedToken) {
      setFcmToken(storedToken)
    }
    
    const storedUnread = localStorage.getItem('eliteArrowsUnreadCount')
    if (storedUnread) {
      setUnreadCount(parseInt(storedUnread) || 0)
    }
  }, [])

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      allUsers,
      notifications,
      results,
      fixtures,
      cups,
      supportRequests,
      seasons,
      dataRefreshTrigger,
      adminData,
      notificationPermission,
      fcmToken,
      unreadCount,
      news,
      triggerDataRefresh,
      requestNotificationPermission,
      registerFCMToken,
      showLocalNotification,
      updateBadgeCount,
      sendNotification,
      notifyAllSubscribers,
      notifyAdmins,
      notifyUser,
      signUp, 
      signIn, 
      signOut: handleSignOut, 
      updateUser,
      updateOtherUser,
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
      getResults,
      updateResults,
      getFixtures,
      updateFixtures,
      getCups,
      bets,
      getSupportRequests,
      getSeasons,
      getNews,
      postNews,
      deleteNews,
      togglePinNews,
      addTokens,
      useTokens,
      adminData,
      updateAdminData,
      addToMoneyHistory,
      isAuthenticated: !!user 
    }}>
      {showSeasonOneWelcome && user && (
        <SeasonOneWelcomeModal
          isOpen={showSeasonOneWelcome}
          userName={user.username}
          onAcknowledge={acknowledgeSeasonOneWelcome}
        />
      )}
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
