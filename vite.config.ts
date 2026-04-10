import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo_ticket.png'],
      manifest: {
        name: 'Doble JJ - Abastecimiento',
        short_name: 'Doble JJ',
        description: 'Sistema de Gestión de Abastecimiento Mayorista Doble JJ',
        theme_color: '#3b82f6',
        icons: [
          {
            src: 'logo_ticket.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'logo_ticket.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'logo_ticket.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
})
