import { describe, it, expect, vi } from 'vitest'
import { signal, computed, effect, untrack, Batch, Signal } from './signal.js'

const tick = () => new Promise(r => setTimeout(r))

describe('signal / computed / effect', () => {
  it('effect se ejecuta al crearse y tras cambiar una dependencia', async () => {
    const s = signal(1)
    const seen = []
    effect(() => { seen.push(s.get()) })
    s.set(2)
    await tick()
    expect(seen).toEqual([1, 2])
  })

  it('diamante: el effect corre una vez con valores consistentes', async () => {
    const s = signal(1)
    const a = computed(() => s.get() * 2)
    const b = computed(() => s.get() + 1)
    const seen = []
    effect(() => { seen.push([a.get(), b.get()]) })
    s.set(2)
    await tick()
    expect(seen).toEqual([[2, 2], [4, 3]])
  })

  it('Batch difiere los effects hasta el final', () => {
    const s = signal(0)
    const fn = vi.fn(() => s.get())
    effect(fn)
    Batch.run(() => { s.set(1); s.set(2); expect(fn).toHaveBeenCalledTimes(1) })
    expect(fn).toHaveBeenCalledTimes(2)
  })
})

describe('regresiones F1', () => {
  it('effect() devuelve una función dispose que detiene el effect', async () => {
    const s = signal(0)
    const fn = vi.fn(() => s.get())
    const dispose = effect(fn)
    expect(typeof dispose).toBe('function')
    dispose()
    s.set(1)
    await tick()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('dispose ejecuta la función de limpieza del effect', () => {
    const cleanup = vi.fn()
    const dispose = effect(() => cleanup)
    dispose()
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it('un computed que lanza no deja corrupto Signal.current', () => {
    const bad = computed(() => { throw new Error('boom') })
    expect(() => bad.get()).toThrow('boom')
    expect(Signal.current).toBeFalsy()
  })

  it('un effect que escribe su propia dependencia no bloquea en bucle infinito', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = signal(0)
    let runs = 0
    effect(() => { runs++; s.set(s.get() + 1) })
    s.set(100)
    await tick()
    expect(runs).toBeLessThan(1000)
    expect(err).toHaveBeenCalled()
    err.mockRestore()
  })

  it('las lecturas dentro de la limpieza no se rastrean como dependencias', async () => {
    const s = signal(0)
    const other = signal(0)
    const fn = vi.fn(() => { s.get(); return () => other.get() })
    effect(fn)
    s.set(1)
    await tick()
    other.set(1)
    await tick()
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('untrack lee sin suscribir y restaura el contexto', async () => {
    const s = signal(0)
    const fn = vi.fn(() => untrack(() => s.get()))
    effect(fn)
    s.set(1)
    await tick()
    expect(fn).toHaveBeenCalledTimes(1)
    expect(Signal.current).toBeFalsy()
  })
})
