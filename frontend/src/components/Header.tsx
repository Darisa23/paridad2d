import { useEffect, useState } from 'react'
import type { Conn } from '../useSimulator'

const SCALES = [0.85, 0.92, 1, 1.1, 1.2, 1.32, 1.45]
const read = (k: string) => {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v)
  } catch {
    /* sin almacenamiento: no pasa nada */
  }
}

const systemDark = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches

export function Header({ conn }: { conn: Conn }) {
  const [dark, setDark] = useState(() => {
    const t = read('paridad.theme')
    return t ? t === 'dark' : systemDark()
  })
  const [scale, setScale] = useState(() => {
    const s = parseFloat(read('paridad.scale') ?? '')
    return SCALES.includes(s) ? s : 1
  })

  useEffect(() => {
    document.documentElement.style.fontSize = `${scale * 100}%`
  }, [scale])

  const toggleTheme = () => {
    const next = !dark
    setDark(next)
    document.documentElement.dataset.theme = next ? 'dark' : 'light'
    write('paridad.theme', next ? 'dark' : 'light')
  }
  const bump = (d: number) => {
    const i = Math.max(0, Math.min(SCALES.length - 1, SCALES.indexOf(scale) + d))
    setScale(SCALES[i])
    write('paridad.scale', String(SCALES[i]))
  }

  const connText = conn === 'ok' ? 'Conectado' : conn === 'down' ? 'Sin conexión' : 'Conectando…'

  return (
    <header className="top">
      <h1>Paridad bidimensional</h1>
      <div className="tools">
        <span className={`conn conn-${conn}`} role="status" aria-live="polite" title="Estado del servidor de cálculo">
          <i aria-hidden="true" />
          {connText}
        </span>
        <div className="seg-btns" role="group" aria-label="Tamaño de letra">
          <button type="button" className="sm" onClick={() => bump(-1)} disabled={scale === SCALES[0]} aria-label="Reducir tamaño de letra">
            A−
          </button>
          <button
            type="button"
            className="sm"
            onClick={() => bump(1)}
            disabled={scale === SCALES[SCALES.length - 1]}
            aria-label="Aumentar tamaño de letra"
          >
            A+
          </button>
        </div>
        <button type="button" className="sm" onClick={toggleTheme} aria-pressed={dark} aria-label={dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}>
          {dark ? '☀ Claro' : '☾ Oscuro'}
        </button>
      </div>
    </header>
  )
}
