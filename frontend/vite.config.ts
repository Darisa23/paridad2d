import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Carpeta del front como ruta absoluta (derivada de este archivo), para que Vite
// funcione igual se lance desde donde se lance y esté donde esté el proyecto.
const FRONTEND = path.dirname(fileURLToPath(import.meta.url))

// En local, /api se reenvía al backend FastAPI (uvicorn en el puerto 8000).
const backend = process.env.BACKEND_URL ?? 'http://127.0.0.1:8000'

export default defineConfig({
  root: FRONTEND,
  plugins: [react()],
  build: { outDir: path.join(FRONTEND, 'dist'), emptyOutDir: true },
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': { target: backend, changeOrigin: true } },
  },
  preview: {
    port: 4173,
    proxy: { '/api': { target: backend, changeOrigin: true } },
  },
})
