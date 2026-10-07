import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.PAGES_BASE_PATH || '/',
  // The linked package and demo must share the same React runtime.
  resolve: { dedupe: ['react', 'react-dom'] },
})

