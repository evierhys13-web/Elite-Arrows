import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging'
import { app } from './firebase'

let messaging = null

export const getMessagingInstance = async () => {
  if (messaging) return messaging
  try {
    messaging = getMessaging(app)
    return messaging
  } catch (e) {
    console.warn('Firebase messaging init failed:', e.message)
    return null
  }
}

export { getToken, onMessage, isSupported }