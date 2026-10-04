import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'prompt',
    includeAssets: ['chippy-icon.svg'],
    manifest: { name: 'Chippy Carpool', short_name: 'Chippy', description: 'Coordinate carpools with friends.', theme_color: '#f7f4ed', background_color: '#f7f4ed', display: 'standalone', orientation: 'portrait-primary', icons: [{ src: '/chippy-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }] },
    workbox: { navigateFallback: '/index.html', runtimeCaching: [] },
  })],
  server: { port: 5173 },
})
