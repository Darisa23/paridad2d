import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Rutas absolutas calculadas a partir de la ubicación de este archivo:
// funcionan sin importar desde qué carpeta se ejecute Playwright ni dónde esté el proyecto.
const FRONTEND = path.dirname(fileURLToPath(import.meta.url))
const BACKEND = path.resolve(FRONTEND, '..', 'backend')

// Python del entorno virtual del backend (Windows o macOS/Linux). Se puede forzar con PYTHON=...
const venvPython =
  process.platform === 'win32'
    ? path.join(BACKEND, '.venv', 'Scripts', 'python.exe')
    : path.join(BACKEND, '.venv', 'bin', 'python')
const python = process.env.PYTHON ?? venvPython

export default defineConfig({
  testDir: path.join(FRONTEND, 'e2e'),
  outputDir: path.join(FRONTEND, 'test-results'),
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } }, grepInvert: /@celular/ },
    { name: 'movil', use: { ...devices['Pixel 7'] }, grep: /@celular/ },
  ],
  webServer: [
    {
      command: `"${python}" -m uvicorn app.main:app --host 127.0.0.1 --port 8000`,
      cwd: BACKEND,
      url: 'http://127.0.0.1:8000/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'npm run dev -- --host 127.0.0.1',
      cwd: FRONTEND,
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
})
