import { useAnimate } from 'framer-motion'
import { useLayoutEffect, useRef } from 'react'
import { prefersReducedMotion } from '../anim'

export type Origin = () => { x: number; y: number } | null

/**
 * Anima la aparición de un elemento la primera vez que `shown` pasa a true.
 * Si hay `origin`, el elemento «vuela» desde ese punto (por ejemplo, desde el
 * campo de texto o desde el contador de unos); si no, aparece con un resorte corto.
 */
export function useReveal<T extends HTMLElement>(shown: boolean, origin?: Origin) {
  const [scope, animate] = useAnimate<T>()
  const was = useRef(shown)
  useLayoutEffect(() => {
    const el = scope.current
    if (!el) return
    if (shown && !was.current) {
      if (prefersReducedMotion()) {
        el.style.opacity = '1'
      } else {
        el.style.opacity = '0'
        const o = origin?.()
        if (o) {
          const r = el.getBoundingClientRect()
          const dx = o.x - (r.left + r.width / 2)
          const dy = o.y - (r.top + r.height / 2)
          void animate(el, { opacity: [0, 1], x: [dx, 0], y: [dy, 0], scale: [0.5, 1] }, { duration: 0.55, ease: [0.22, 1, 0.36, 1] })
        } else {
          void animate(el, { opacity: [0, 1], scale: [0.55, 1] }, { type: 'spring', stiffness: 520, damping: 20 })
        }
      }
    }
    was.current = shown
  }, [shown])
  return scope
}

/** Centro de un elemento por id (para los vuelos). */
export const centerOf = (id: string) => {
  const el = document.getElementById(id)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

/** Posición aproximada del carácter i dentro del campo de texto. */
export const inputCharPoint = (i: number) => {
  const el = document.getElementById('inp') as HTMLInputElement | null
  if (!el) return null
  const r = el.getBoundingClientRect()
  const cs = getComputedStyle(el)
  const ctx = document.createElement('canvas').getContext('2d')
  let w = parseFloat(cs.fontSize) * 0.6
  if (ctx) {
    ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
    w = ctx.measureText('M').width
  }
  const ls = parseFloat(cs.letterSpacing) || 0
  const x = r.left + parseFloat(cs.paddingLeft) + (i + 0.5) * (w + ls) - el.scrollLeft
  return { x: Math.min(x, r.right - 10), y: r.top + r.height / 2 }
}
