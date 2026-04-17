import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js'
import { getMessaging } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js'

const firebaseConfig = {
  apiKey: "AIzaSyBLuRvmE1UgKvYFw7K0utT11ljjrf52vlA",
  authDomain: "elitearrowsapp.firebaseapp.com",
  projectId: "elitearrowsapp",
  storageBucket: "elitearrowsapp.firebasestorage.app",
  messagingSenderId: "848326452210",
  appId: "1:848326452210:web:3626c7f4214167d51ec16b"
}

const app = initializeApp(firebaseConfig)
const messaging = getMessaging()

self.addEventListener('push', (event) => {
  console.log('[FCM SW] Push received:', event)

  let data = {
    title: 'Elite Arrows',
    body: 'You have a new notification',
    icon: '/logo.jpg',
    badge: '/logo.jpg',
    data: {}
  }

  if (event.data) {
    try {
      const payload = event.data.json()
      data = {
        title: payload.title || data.title,
        body: payload.body || data.body,
        icon: payload.icon || data.icon,
        badge: payload.badge || data.badge,
        data: payload.data || {}
      }
    } catch (e) {
      console.log('[FCM SW] Error parsing push data:', e)
      data.body = event.data.text() || data.body
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    data: data.data,
    vibrate: [200, 100, 200],
    tag: data.data?.notificationId || 'default',
    renotify: true,
    requireInteraction: false,
    actions: [
      { action: 'open', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  )
})

self.addEventListener('notificationclick', (event) => {
  console.log('[FCM SW] Notification clicked:', event)
  
  event.notification.close()

  if (event.action === 'dismiss') {
    return
  }

  const urlToOpen = event.notification.data?.url || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      if (windowClients.length > 0) {
        windowClients[0].focus()
        windowClients[0].postMessage({
          type: 'NOTIFICATION_CLICKED',
          data: event.notification.data
        })
      } else {
        return clients.openWindow(urlToOpen)
      }
    })
  )
})

self.addEventListener('message', (event) => {
  console.log('[FCM SW] Message received:', event)
  
  if (event.data && event.data.type === 'SET_BADGE') {
    setBadgeCount(event.data.count)
  }
  
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    self.registration.showNotification(event.data.title, {
      body: event.data.body,
      icon: event.data.icon || '/logo.jpg',
      badge: event.data.badge || '/logo.jpg',
      data: event.data.data || {}
    })
  }
})

async function setBadgeCount(count) {
  if (navigator.setAppBadge) {
    await navigator.setAppBadge(count)
  } else if (navigator.setClientBadge) {
    navigator.setClientBadge(count)
  }
  
  try {
    const registration = await navigator.serviceWorker.getRegistration()
    if (registration) {
      await registration.update()
    }
  } catch (e) {
    console.log('[FCM SW] Error updating badge:', e)
  }
}

console.log('[FCM SW] Firebase Messaging Service Worker loaded')
