import { initializeApp, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}')

if (!serviceAccount.project_id) {
  console.error('Set FIREBASE_SERVICE_ACCOUNT env var with your service account JSON')
  process.exit(1)
}

const app = initializeApp({ credential: cert(serviceAccount) })
const auth = getAuth(app)
const db = getFirestore(app)

const testUser = {
  email: 'test@elitearrows.co.uk',
  password: 'TestPass123!',
  displayName: 'Test User',
  emailVerified: true,
  disabled: false
}

try {
  const userRecord = await auth.createUser(testUser)
  console.log('Created auth user:', userRecord.uid)

  await db.collection('users').doc(userRecord.uid).set({
    id: userRecord.uid,
    username: 'Test User',
    email: 'test@elitearrows.co.uk',
    division: 'Elite',
    isAdmin: true,
    isTournamentAdmin: true,
    isSubscribed: true,
    subscriptionType: 'Elite Pass',
    subscriptionDate: new Date().toISOString(),
    subscriptionExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    subscriptionSource: 'admin_granted',
    freeAdminSubscription: true,
    threeDartAverage: 85.5,
    eliteTokens: 500,
    friends: [],
    sentFriendRequests: [],
    receivedFriendRequests: [],
    isOnline: false,
    showOnlineStatus: true,
    doNotDisturb: false,
    adminRequestPending: false,
    createdAt: new Date().toISOString(),
    lastSeen: new Date().toISOString()
  })

  console.log('Created Firestore user document with admin + subscription privileges')
  console.log('Login: test@elitearrows.co.uk / TestPass123!')
} catch (error) {
  if (error.code === 'auth/email-already-exists') {
    console.log('User already exists, updating privileges...')
    const users = await auth.listUsers()
    const existing = users.users.find(u => u.email === 'test@elitearrows.co.uk')
    if (existing) {
      await db.collection('users').doc(existing.uid).set({
        isAdmin: true,
        isTournamentAdmin: true,
        isSubscribed: true,
        subscriptionType: 'Elite Pass',
        subscriptionSource: 'admin_granted',
        freeAdminSubscription: true,
        division: 'Elite',
        eliteTokens: 500
      }, { merge: true })
      console.log('Updated existing user with admin + subscription privileges')
      console.log('Login: test@elitearrows.co.uk / TestPass123!')
    }
  } else {
    console.error('Error:', error.message)
  }
}
