/* global firebase */

importScripts(
  'https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js',
)

importScripts(
  'https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js',
)

firebase.initializeApp({
  apiKey: 'AIzaSyAhF6y0cf5CxVh9Dj4ygr5YOlXqvernhp8',
  authDomain: 'rei-do-hamburguer-b1c21.firebaseapp.com',
  projectId: 'rei-do-hamburguer-b1c21',
  storageBucket: 'rei-do-hamburguer-b1c21.firebasestorage.app',
  messagingSenderId: '730762568251',
  appId: '1:730762568251:web:a8f6afd7ebb05779b0b21e',
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {}

  const title =
    data.title ||
    payload.notification?.title ||
    '🔔 Novo pedido recebido'

  const body =
    data.body ||
    payload.notification?.body ||
    'Um novo pedido está aguardando preparo.'

  const orderId = data.orderId || data.order_id || 'novo-pedido'

  const notificationUrl =
    data.url ||
    data.click_action ||
    '/admin'

  const notificationOptions = {
    body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: `pedido-${orderId}`,
    renotify: true,
    requireInteraction: true,
    silent: false,
    vibrate: [
      300,
      150,
      300,
      150,
      500,
    ],
    data: {
      ...data,
      url: notificationUrl,
      orderId,
    },
  }

  return self.registration.showNotification(
    title,
    notificationOptions,
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const notificationData =
    event.notification.data || {}

  const destinationUrl =
    notificationData.url || '/admin'

  event.waitUntil(
    self.clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      .then((clientList) => {
        for (const client of clientList) {
          const clientUrl = new URL(client.url)

          if (
            clientUrl.origin === self.location.origin &&
            'focus' in client
          ) {
            client.navigate(destinationUrl)

            return client.focus()
          }
        }

        if (self.clients.openWindow) {
          return self.clients.openWindow(destinationUrl)
        }

        return undefined
      }),
  )
})

self.addEventListener('notificationclose', () => {
  // A notificação foi dispensada pelo usuário.
})
