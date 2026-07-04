import { createClient } from '@blinkdotnew/sdk'

export const blink = createClient({
  projectId: import.meta.env.VITE_BLINK_PROJECT_ID || 'delivery-pwa-brazil-yroou0wa',
  publishableKey: import.meta.env.VITE_BLINK_PUBLISHABLE_KEY || 'blnk_pk_PQpa0s0NtJEF9WUo_85Y-xj1t6xjAH8T',
  authRequired: false,
  auth: { mode: 'managed' },
})
