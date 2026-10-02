import { describe, it, expect, vi } from 'vitest'
import { resource } from './resource.js'
import { signal, createRoot } from './signal.js'

const tick = () => new Promise(r => setTimeout(r))
const diferido = () => { let resolve, reject; const p = new Promise((a, b) => { resolve = a; reject = b }); return { p, resolve, reject } }

describe('resource', () => {
  it('carga: loading → data', async () => {
    const r = createRoot(() => resource(async () => 'hola'))
    expect(r.loading.get()).toBe(true)
    await tick()
    expect([r.loading.get(), r.data.get(), r.error.get()]).toEqual([false, 'hola', null])
  })

  it('se vuelve a pedir al cambiar la fuente y conserva los datos mientras recarga', async () => {
    const id = signal(1)
    const fetcher = vi.fn(async (n) => `item ${n}`)
    const r = createRoot(() => resource(() => id.get(), fetcher))
    await tick()
    expect(r.data.get()).toBe('item 1')
    id.set(2)
    await Promise.resolve()
    expect(r.loading.get()).toBe(true)
    expect(r.data.get()).toBe('item 1') // datos anteriores mientras carga
    await tick()
    expect(r.data.get()).toBe('item 2')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('cancela la petición anterior: una respuesta lenta no pisa a una reciente', async () => {
    const id = signal(1)
    const pendientes = {}
    const signals = {}
    const r = createRoot(() => resource(() => id.get(), (n, { signal }) => {
      signals[n] = signal
      pendientes[n] = diferido()
      return pendientes[n].p
    }))
    id.set(2)
    await tick()
    expect(signals[1].aborted).toBe(true)
    pendientes[2].resolve('dos')
    pendientes[1].resolve('uno (tarde)')
    await tick()
    expect(r.data.get()).toBe('dos')
  })

  it('fuente false/null: no pide nada', async () => {
    const activo = signal(false)
    const fetcher = vi.fn(async () => 'x')
    const r = createRoot(() => resource(() => activo.get() && 'params', fetcher))
    await tick()
    expect(fetcher).not.toHaveBeenCalled()
    expect(r.loading.get()).toBe(false)
    activo.set(true)
    await tick()
    expect(r.data.get()).toBe('x')
  })

  it('error: guarda el error y conserva los datos; un AbortError no cuenta', async () => {
    let falla = false
    const r = createRoot(() => resource(async () => { if (falla) throw new Error('caído'); return 'ok' }))
    await tick()
    falla = true
    r.refetch()
    await tick()
    expect([r.data.get(), r.error.get()?.message, r.loading.get()]).toEqual(['ok', 'caído', false])

    const abortado = createRoot(() => resource(async () => { throw new DOMException('x', 'AbortError') }))
    await tick()
    expect(abortado.error.get()).toBeNull()
  })

  it('refetch y mutate', async () => {
    let n = 0
    const r = createRoot(() => resource(async () => ++n))
    await tick()
    r.refetch()
    await tick()
    expect(r.data.get()).toBe(2)
    r.mutate(99) // actualización local (optimista)
    expect(r.data.get()).toBe(99)
  })

  it('al desmontar cancela la petición y no actualiza nada', async () => {
    let señal
    const pendiente = diferido()
    let r
    const dispose = createRoot(d => { r = resource((_, { signal }) => { señal = signal; return pendiente.p }); return d })
    dispose()
    expect(señal.aborted).toBe(true)
    pendiente.resolve('tarde')
    await tick()
    expect(r.data.get()).toBeUndefined()
  })

  it('las lecturas dentro del fetcher no son dependencias', async () => {
    const otro = signal(0)
    const fetcher = vi.fn(async () => otro.get())
    createRoot(() => resource(fetcher))
    await tick()
    otro.set(1)
    await tick()
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
