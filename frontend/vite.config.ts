import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The backend runs on this computer (port 8000). The app asks for /api/... on its own address and Vite passes the
// request on to the backend, so the app also works when it is opened from a phone through a public link
// (cloudflared), where "localhost" would mean the phone. allowedHosts lets that link's address in.
const backend = { '/api': 'http://localhost:8000', '/health': 'http://localhost:8000' }

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { allowedHosts: true, proxy: backend },
  preview: { allowedHosts: true, proxy: backend },
})
