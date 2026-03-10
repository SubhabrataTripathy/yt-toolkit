import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Replace 'yt-toolkit' with your actual GitHub repository name
export default defineConfig({
  plugins: [react()],
  base: '/yt-toolkit/',   // ← MUST match your GitHub repo name exactly
})
