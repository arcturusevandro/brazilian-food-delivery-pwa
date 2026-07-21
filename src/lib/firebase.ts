import { initializeApp, getApps, getApp } from 'firebase/app'
import {
  getMessaging,
  getToken,
  isSupported,
  type Messaging,
} from 'firebase/messaging'

const firebaseConfig = {
  apiKey: 'AIzaSyAhF6y0cf5CxVh9Dj4ygr5YOlXqvernhp8',
  authDomain: 'rei-do-hamburguer-b1c21.firebaseapp.com',
  projectId: 'rei-do-hamburguer-b1c21',
  storageBucket: 'rei-do-hamburguer-b1c21.firebasestorage.app',
  messagingSenderId: '730762568251',
  appId: '1:730762568251:web:a8f6afd7ebb05779b0b21e',
}

export const FIREBASE_VAPID_KEY =
  'BH2jEV9Z_SJFnfYiQVKLH3MulPgk9aH030jAUfQpY7lBSaFtpMkkyYkX5Owqy6QLdWKSMd7Yq1paM_5rh5ZsG3o'

export const firebaseApp = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig)

let messagingInstance: Messaging | null = null

export async function getFirebaseMessaging(): Promise<Messaging | null> {
  if (typeof window === 'undefined') {
    return null
  }

  const supported = await isSupported()

  if (!supported) {
    return null
  }

  if (!messagingInstance) {
    messagingInstance = getMessaging(firebaseApp)
  }

  return messagingInstance
}

export async function requestFirebaseNotificationToken(): Promise<
  string | null
> {
  if (typeof window === 'undefined') {
    return null
  }

  if (!('Notification' in window)) {
    return null
  }

  if (!('serviceWorker' in navigator)) {
    return null
  }

  const permission = await Notification.requestPermission()

  if (permission !== 'granted') {
    return null
  }

  const messaging = await getFirebaseMessaging()

  if (!messaging) {
    return null
  }

  const registration = await navigator.serviceWorker.register(
    '/firebase-messaging-sw.js',
  )

  const token = await getToken(messaging, {
    vapidKey: FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  })

  return token || null
}
