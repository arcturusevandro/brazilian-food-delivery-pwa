import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const sw = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8')
const firebase = await readFile(new URL('../src/lib/firebase.ts', import.meta.url), 'utf8')
const pwa = await readFile(new URL('../src/lib/pwa.ts', import.meta.url), 'utf8')
const pushSender = await readFile(new URL('../supabase/functions/send-order-push/index.ts', import.meta.url), 'utf8')

test('PWA and Firebase share the same service worker', () => {
  assert.match(firebase, /serviceWorker\.register\('\/sw\.js'\)/)
  assert.match(pwa, /serviceWorker\.register\('\/sw\.js'\)/)
  assert.doesNotMatch(firebase + pwa, /firebase-messaging-sw\.js/)
})

test('the PWA remains installable when Firebase is unavailable', () => {
  assert.match(sw, /try\s*{[\s\S]*importScripts/)
  assert.match(sw, /catch \(error\)/)
  assert.match(sw, /messaging\?\.onBackgroundMessage/)
})

test('cache cleanup is scoped and navigation has an offline fallback', () => {
  assert.match(sw, /key\.startsWith\(CACHE_PREFIX\)/)
  assert.match(sw, /event\.request\.mode === 'navigate'/)
  assert.match(sw, /caches\.match\('\/'\)/)
})

test('notification clicks cannot navigate outside the application origin', () => {
  assert.match(sw, /destination\.origin === self\.location\.origin/)
})

test('Firebase private keys accept common secret storage formats', () => {
  assert.match(pushSender, /JSON\.parse\(normalized\)/)
  assert.match(pushSender, /parsed\.private_key/)
  assert.match(pushSender, /atob\(normalized\)/)
  assert.match(pushSender, /replace\(\/\\\\n\/g, "\\n"\)/)
})
