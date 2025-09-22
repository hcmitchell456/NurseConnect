// filepath: c:\Users\hcmit\OneDrive\Documents\UNCG\CSC-490\NurseConnect\client\vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: './postcss.config.js',
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    }
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: '/src/index.jsx', // Correct entry point
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})