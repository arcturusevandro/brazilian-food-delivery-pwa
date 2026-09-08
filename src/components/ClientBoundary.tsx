import { ClientOnly } from '@tanstack/react-router'
import type { ReactNode } from 'react'

/**
 * SSR-safe boundary for UI that depends on browser-only state such as
 * localStorage, window or client-side authentication state.
 *
 * The server renders the fallback and the real UI mounts in the browser.
 * Keep static and marketing content outside this boundary so it remains
 * server-rendered and crawlable.
 *
 * If an entire page requires the browser, prefer `ssr: false` on the route.
 */
export function ClientBoundary({
  children,
  fallback = null,
}: {
  children: ReactNode
  fallback?: ReactNode
}) {
  return <ClientOnly fallback={fallback}>{children}</ClientOnly>
}
