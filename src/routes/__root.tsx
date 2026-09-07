/// <reference types="vite/client" />
import {
  HeadContent,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import type { ReactNode } from 'react'
import indexCss from '../index.css?url'

const queryClient = new QueryClient()

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1.0' },
      { title: 'Rei do Hambúrguer | Centralizaweb' },
      { name: 'description', content: 'Cardápio online do Rei do Hambúrguer, desenvolvido pela Centralizaweb.' },
      { name: 'theme-color', content: '#0a0a0a' },
      { property: 'og:type', content: 'website' },
      { property: 'og:title', content: 'Rei do Hambúrguer | Centralizaweb' },
      { property: 'og:description', content: 'Cardápio online do Rei do Hambúrguer, desenvolvido pela Centralizaweb.' },
      { property: 'og:site_name', content: 'Rei do Hambúrguer | Centralizaweb' },
      { property: 'og:locale', content: 'pt_BR' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
    links: [
      { rel: 'stylesheet', href: indexCss },
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      { rel: 'manifest', href: '/site.webmanifest' },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                {
                  '@type': 'WebSite',
                  name: 'Rei do Hambúrguer',
                  url: 'https://reidohamburguer.centralizaweb.com.br',
                },
                {
                  '@type': 'Organization',
                  name: 'Centralizaweb',
                  url: 'https://reidohamburguer.centralizaweb.com.br',
                  sameAs: [],
                },
              ],
            }),
          }}
        />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <Toaster position="top-right" />
          {children}
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  )
}
