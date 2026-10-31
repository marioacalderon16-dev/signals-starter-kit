import { describe, it, expect, vi } from 'vitest'
import { on } from './on.js'
import { signal, createRoot, effect } from './signal.js'

const emitir = (target) => target.dispatchEvent(new Event('ping'))

describe('on', () => {
  it('escucha el evento hasta que se libera el dueño', () => {
    const target = new EventTarget()
    const fn = vi.fn()
    const dispose = createRoot((d) => { on(target, 'ping', fn); return d })

    emitir(target)
    expect(fn).toHaveBeenCalledTimes(1)

    dispose()
    emitir(target)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('devuelve una función que lo quita antes de tiempo', () => {
    const target = new EventTarget()
    const fn = vi.fn()
    const quitar = createRoot(() => on(target, 'ping', fn))

    quitar()
    emitir(target)
    expect(fn).not.toHaveBeenCalled()
  })

  it('dentro de un effect no acumula listeners al re-ejecutarse', () => {
    const target = new EventTarget()
    const fn = vi.fn()
    const n = signal(0)
    createRoot(() => effect(() => { n.get(); on(target, 'ping', fn) }))

    n.set(1)
    emitir(target)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('respeta las opciones de addEventListener', () => {
    const target = new EventTarget()
    const fn = vi.fn()
    createRoot(() => on(target, 'ping', fn, { once: true }))

    emitir(target)
    emitir(target)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('fuera de un dueño avisa y sigue funcionando', () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const target = new EventTarget()
    const fn = vi.fn()

    const quitar = on(target, 'ping', fn)
    emitir(target)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(aviso).toHaveBeenCalledTimes(1)

    quitar()
    aviso.mockRestore()
  })
})
