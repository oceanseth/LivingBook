import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// The ask server runs separately on :8787. Proxying it under the app's own
// origin keeps the browser on one host: no CORS preflight, and no
// mixed-content block when the app is served over HTTPS (tunnel, preview, or
// prod behind CloudFront). Quick tunnels hand out a fresh *.trycloudflare.com
// hostname each run, so that host has to be allowed or Vite rejects the
// request as an unknown Host. Both dev (`server`) and the production preview
// (`preview`) need this — QA runs against the preview build.
const proxy = {
  '/api': {
    target: process.env.ASK_SERVER_URL ?? 'http://localhost:8787',
    changeOrigin: true,
  },
}
const allowedHosts = ['.trycloudflare.com']

export default defineConfig({
  plugins: [react()],
  server: { proxy, allowedHosts },
  preview: { proxy, allowedHosts },
})
