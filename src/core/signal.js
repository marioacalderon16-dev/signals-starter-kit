/**
 * src/core/signal.js
 * 
 * Sistema de reactividad: Signals, Computed, Effects y Batch
 */

let signalIdCounter = 0

// Dueño actual (Effect o root): adopta los effects y onCleanup creados mientras está activo
let currentOwner = null
let effectIdCounter = 0

class Signal {
  constructor(value) {
    this.value = value
    this.subs = new Set()
    this.id = `signal_${signalIdCounter++}`
  }

  get() {
    if (Signal.current && Signal.current.deps) {
      this.subs.add(Signal.current)
      Signal.current.deps.add(this)
    }
    return this.value
  }

  set(value) {
    if (Object.is(value, this.value)) return
    this.value = value
    this.subs.forEach(sub => {
      try {
        if (sub && typeof sub.dirty === 'function') {
          sub.dirty()
        }
      } catch (error) {
        console.error('Error in signal subscriber:', error)
      }
    })
  }
}

class Computed {
  constructor(fn) {
    this.fn = fn
    this.value = undefined
    this.isDirty = true
    this.subs = new Set()
    this.deps = new Set()
  }

  get() {
    if (this.isDirty) {
      this.deps.forEach(d => d.subs.delete(this))
      this.deps.clear()
      const prev = Signal.current
      Signal.current = this
      try {
        this.value = this.fn()
        this.isDirty = false
      } finally {
        Signal.current = prev
      }
    }
    if (Signal.current && Signal.current !== this && Signal.current.deps) {
      this.subs.add(Signal.current)
      Signal.current.deps.add(this)
    }
    return this.value
  }

  dirty() {
    if (this.isDirty) return
    this.isDirty = true
    this.subs.forEach(sub => sub.dirty())
  }
}

/**
 * Quita `sub` de `dep`. Si `dep` es un Computed que se queda sin observadores,
 * se desuscribe a su vez de sus fuentes (evita fugas al desmontar).
 */
const unsubscribe = (dep, sub) => {
  dep.subs.delete(sub)
  if (dep instanceof Computed && dep.subs.size === 0) {
    dep.deps.forEach(d => unsubscribe(d, dep))
    dep.deps.clear()
    dep.isDirty = true
  }
}

/**
 * Libera lo que posee un dueño: primero los hijos (en orden inverso), luego sus onCleanup.
 */
const disposeOwned = (owner) => {
  const owned = owner.owned
  owner.owned = []
  for (let i = owned.length - 1; i >= 0; i--) owned[i].cleanup()

  const cleanups = owner.cleanups
  owner.cleanups = []
  for (let i = cleanups.length - 1; i >= 0; i--) {
    try {
      untrack(cleanups[i])
    } catch (error) {
      console.error('Error in onCleanup:', error)
    }
  }
}

class Effect {
  constructor(fn) {
    this.fn = fn
    this.cleanupFn = null
    this.deps = new Set()
    this.owned = []
    this.cleanups = []
    this.disposed = false
    if (currentOwner) currentOwner.owned.push(this)
    this.run()
  }

  run() {
    if (this.disposed) return
    Effect.pending.delete(this)
    this.deps.forEach(d => d.subs.delete(this))
    this.deps.clear()

    // Limpieza de la ejecución anterior (hijos, onCleanup y función devuelta), fuera del tracking
    disposeOwned(this)
    this._runCleanup()

    const prevListener = Signal.current
    const prevOwner = currentOwner
    Signal.current = this
    currentOwner = this
    try {
      const result = this.fn()
      if (typeof result === 'function') {
        this.cleanupFn = result
      }
    } catch (error) {
      console.error('Error in effect:', error)
    } finally {
      Signal.current = prevListener
      currentOwner = prevOwner
    }
  }

  dirty() {
    Effect.pending.add(this)
    if (!Effect.scheduled) {
      Effect.scheduled = true
      Promise.resolve().then(Effect.flush)
    }
  }

  _runCleanup() {
    if (!this.cleanupFn) return
    const fn = this.cleanupFn
    this.cleanupFn = null
    try {
      untrack(fn)
    } catch (error) {
      console.error('Error in effect cleanup:', error)
    }
  }

  cleanup() {
    if (this.disposed) return
    this.disposed = true
    disposeOwned(this)
    this._runCleanup()
    Effect.pending.delete(this)
    this.deps.forEach(d => unsubscribe(d, this))
    this.deps.clear()
  }
}

class Batch {
  static run(fn) {
    const wasScheduled = Effect.scheduled
    Effect.scheduled = true
    try {
      return fn()
    } finally {
      Effect.scheduled = wasScheduled
      if (!wasScheduled) Effect.flush()
    }
  }
}

Effect.pending = new Set()
Effect.scheduled = false
// Máximo de rondas por flush: corta ciclos (un effect que escribe su propia dependencia)
const MAX_FLUSH_ROUNDS = 100

Effect.flush = () => {
  Effect.scheduled = true // evita programar otra microtask mientras se vacía la cola
  try {
    for (let round = 0; Effect.pending.size > 0; round++) {
      if (round >= MAX_FLUSH_ROUNDS) {
        Effect.pending.clear()
        console.error(`Effect.flush: ciclo detectado tras ${MAX_FLUSH_ROUNDS} rondas; se descartan los effects pendientes`)
        break
      }
      // Copia antes de iterar: los effects pueden encolar otros durante la ronda
      const queue = [...Effect.pending]
      Effect.pending.clear()
      queue.forEach(e => e.run())
    }
  } finally {
    Effect.scheduled = false
  }
}

/**
 * Ejecuta fn sin registrar dependencias en el effect/computed actual.
 */
export const untrack = (fn) => {
  const prev = Signal.current
  Signal.current = null
  try {
    return fn()
  } finally {
    Signal.current = prev
  }
}

// Funciones factory para crear instancias
export const signal = (value) => new Signal(value)
export const computed = (fn) => new Computed(fn)
/**
 * Crea un dueño raíz independiente (no lo adopta el dueño actual) y ejecuta fn sin tracking.
 * fn recibe `dispose`, que libera todos los effects y onCleanup creados dentro.
 * @returns el valor devuelto por fn
 */
export const createRoot = (fn) => {
  const root = {
    owned: [],
    cleanups: [],
    disposed: false,
    cleanup() {
      if (root.disposed) return
      root.disposed = true
      disposeOwned(root)
    }
  }
  const prevListener = Signal.current
  const prevOwner = currentOwner
  Signal.current = null
  currentOwner = root
  try {
    return fn(() => root.cleanup())
  } finally {
    Signal.current = prevListener
    currentOwner = prevOwner
  }
}

/**
 * Devuelve el dueño actual (effect o root), o null si no hay ninguno.
 * Útil para registrar onCleanup solo cuando hay alguien que lo vaya a ejecutar.
 */
export const getOwner = () => currentOwner

/**
 * Registra una limpieza en el dueño actual (effect o root).
 * Corre cuando el dueño se re-ejecuta o se destruye.
 */
export const onCleanup = (fn) => {
  if (!currentOwner) {
    console.warn('onCleanup llamado fuera de un effect o createRoot: no se ejecutará nunca')
    return
  }
  currentOwner.cleanups.push(fn)
}

/**
 * Crea un effect y devuelve su función dispose (detiene el effect y ejecuta su limpieza).
 */
export const effect = (fn) => {
  const instance = new Effect(fn)
  return () => instance.cleanup()
}

// Exports de clases para casos avanzados
export { Signal, Computed, Effect, Batch }