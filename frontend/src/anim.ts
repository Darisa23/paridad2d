/**
 * Motor de pausas de la animación: velocidad, cancelación limpia y «Saltar animación».
 *
 * Cada secuencia obtiene un *token*. Si empieza otra (por ejemplo, se pulsa
 * Convertir de nuevo), el token cambia y la siguiente pausa de la anterior lanza
 * `Cancelled`. «Saltar» hace que todas las pausas de la secuencia en curso
 * terminen al instante, así el código llega solo a su estado final.
 */

export class Cancelled extends Error {
  constructor() {
    super('cancelled')
    this.name = 'Cancelled'
  }
}

export class Runner {
  private token = 0
  private skipping = false
  private speed = 1
  private pending = new Set<() => void>()

  setSpeed(s: number) {
    this.speed = s
  }

  /** Empieza una secuencia exclusiva: cancela la anterior. */
  begin(): number {
    this.token++
    this.skipping = false
    this.flush()
    return this.token
  }

  /** Continúa con el token actual (pasos encadenados como «paridad por filas»). */
  resume(): number {
    this.skipping = false
    return this.token
  }

  /** Invalida cualquier secuencia en curso sin empezar otra. */
  cancel() {
    this.token++
    this.flush()
  }

  skip() {
    this.skipping = true
    this.flush()
  }

  get isSkipping() {
    return this.skipping
  }

  check(my: number) {
    if (my !== this.token) throw new Cancelled()
  }

  /** Pausa de `ms` milisegundos (escalada por la velocidad). */
  async sleep(my: number, ms: number): Promise<void> {
    this.check(my)
    if (!this.skipping && ms > 0) {
      await new Promise<void>((resolve) => {
        const done = () => {
          clearTimeout(t)
          this.pending.delete(done)
          resolve()
        }
        const t = setTimeout(done, ms * this.speed)
        this.pending.add(done)
      })
    }
    this.check(my)
  }

  private flush() {
    for (const done of [...this.pending]) done()
  }
}

/** Factor de la animación adaptativa: las 3 primeras letras con detalle, el resto 4× más rápido. */
export const fz = (i: number) => (i < 3 ? 1 : 0.25)

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
