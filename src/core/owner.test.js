import { describe, it, expect, vi } from 'vitest'
import { signal, computed, effect, createRoot, onCleanup, getOwner, runWithOwner } from './signal.js'

const tick = () => new Promise(r => setTimeout(r))

describe('ownership (F2)', () => {
  it('re-ejecutar un effect libera los effects hijos creados en la ejecución anterior', async () => {
    const outer = signal(0)
    const inner = signal(0)
    const innerFn = vi.fn(() => inner.get())
    effect(() => { outer.get(); effect(innerFn) })
    outer.set(1)
    outer.set(2)
    await tick()
    innerFn.mockClear()
    inner.set(1)
    await tick()
    expect(innerFn).toHaveBeenCalledTimes(1) // solo el hijo vivo, no 2 huérfanos
    expect(inner.subs.size).toBe(1)
  })

  it('onCleanup corre al re-ejecutar y al destruir el effect', async () => {
    const s = signal(0)
    const cleanup = vi.fn()
    const dispose = effect(() => { s.get(); onCleanup(cleanup) })
    s.set(1)
    await tick()
    expect(cleanup).toHaveBeenCalledTimes(1)
    dispose()
    expect(cleanup).toHaveBeenCalledTimes(2)
  })

  it('createRoot devuelve el valor y su dispose libera todo lo creado dentro', async () => {
    const s = signal(0)
    const fn = vi.fn(() => s.get())
    const cleanup = vi.fn()
    let dispose
    const value = createRoot(d => { dispose = d; effect(fn); onCleanup(cleanup); return 42 })
    expect(value).toBe(42)
    dispose()
    expect(cleanup).toHaveBeenCalledTimes(1)
    s.set(1)
    await tick()
    expect(fn).toHaveBeenCalledTimes(1)
    expect(s.subs.size).toBe(0)
  })

  it('createRoot no rastrea lecturas para el effect que lo contiene', async () => {
    const s = signal(0)
    const outer = vi.fn(() => { createRoot(() => s.get()) })
    effect(outer)
    s.set(1)
    await tick()
    expect(outer).toHaveBeenCalledTimes(1)
  })

  it('un computed sin observadores se desuscribe de sus fuentes al destruir el effect', () => {
    const s = signal(1)
    const double = computed(() => s.get() * 2)
    const dispose = effect(() => { double.get() })
    expect(s.subs.size).toBe(1)
    dispose()
    expect(s.subs.size).toBe(0)
    expect(double.get()).toBe(2) // sigue funcionando si se vuelve a leer
  })

  it('onCleanup fuera de un dueño avisa y no lanza', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() => onCleanup(() => {})).not.toThrow()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('runWithOwner', () => {
  it('crea effects bajo un dueño guardado y se liberan con él', async () => {
    const s = signal(0)
    const seen = []
    let owner, dispose
    createRoot(d => { dispose = d; owner = getOwner() })
    runWithOwner(owner, () => effect(() => { seen.push(s.get()) }))
    s.set(1); await tick()
    expect(seen).toEqual([0, 1])
    dispose()
    s.set(2); await tick()
    expect(seen).toEqual([0, 1])
    expect(s.subs.size).toBe(0)
  })

  it('no ejecuta fn si el dueño ya se destruyó', () => {
    let owner
    createRoot(d => { owner = getOwner(); d() })
    const fn = vi.fn()
    expect(runWithOwner(owner, fn)).toBeUndefined()
    expect(fn).not.toHaveBeenCalled()
  })
})
