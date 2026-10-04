import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'prompt',
    includeAssets: ['favicon-brand-64.png', 'apple-touch-icon.png', 'chippy-icon-192.png', 'chippy-icon-512.png'],
    manifest: { name: 'Chippy Carpool', short_name: 'Chippy', description: 'Coordinate carpools with friends.', theme_color: '#f7f4ed', background_color: '#f7f4ed', display: 'standalone', orientation: 'portrait-primary', icons: [{ src: '/chippy-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }, { src: '/chippy-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }] },
    workbox: { navigateFallback: '/index.html', runtimeCaching: [] },
  })],
  server: { port: 5173 },
})
