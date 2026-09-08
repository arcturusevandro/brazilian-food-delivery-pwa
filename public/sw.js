/* global firebase */

const CACHE_NAME = 'rei-do-hamburguer-v2'
const ASSETS = ['/', '/manifest.json']

importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'AIzaSyAhF6y0cf5CxVh9Dj4ygr5YOlXqvernhp8',
  authDomain: 'rei-do-hamburguer-b1c21.firebaseapp.com',
  projectId: 'rei-do-hamburguer-b1c21',
  storageBucket: 'rei-do-hamburguer-b1c21.firebasestorage.app',
  messagingSenderId: '730762568251',
  appId: '1:730762568251:web:a8f6afd7ebb05779b0b21e',
})

const messaging = firebase.messaging()

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  if (new URL(event.request.url).origin !== self.location.origin) return

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetched = fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
      return cached || fetched
    }),
  )
})

messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {}
  const title = data.title || payload.notification?.title || '🔔 Novo pedido recebido'
  const body = data.body || payload.notification?.body || 'Um novo pedido está aguardando preparo.'
  const orderId = data.orderId || data.order_id || 'novo-pedido'
  const notificationUrl = data.url || data.click_action || '/admin'

  return self.registration.showNotification(title, {
    body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/favicon-32x32.png',
    tag: `pedido-${orderId}`,
    renotify: true,
    requireInteraction: true,
    silent: false,
    vibrate: [300, 150, 300, 150, 500],
    data: {
      ...data,
      url: notificationUrl,
      orderId,
    },
  })
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const destinationUrl = event.notification.data?.url || '/admin'

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          const clientUrl = new URL(client.url)
          if (clientUrl.origin === self.location.origin && 'focus' in client) {
            client.navigate(destinationUrl)
            return client.focus()
          }
        }
        return self.clients.openWindow ? self.clients.openWindow(destinationUrl) : undefined
      }),
  )
})
