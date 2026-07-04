export function registerSW() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then(
        (reg) => console.log('[SW] registered:', reg.scope),
        (err) => console.log('[SW] registration failed:', err)
      )
    })
  }
}
