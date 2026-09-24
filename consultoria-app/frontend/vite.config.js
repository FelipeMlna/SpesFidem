import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/consultoria/',
  plugins: [react()],
  server: {
    host: true,  // Expone en la red local (access from mobile)
    port: 5173,
  }
})
