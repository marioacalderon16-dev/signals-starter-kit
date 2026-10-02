import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { debounced } from './debounced.js'
import { signal, computed, createRoot, effect } from './signal.js'
import { resource } from './resource.js'

describe('debounced', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('empieza con el valor actual y solo cambia cuando la fuente lleva ms sin cambiar', async () => {
    const texto = signal('a')
    const lento = createRoot(() => debounced(texto, 300))
    expect(lento.get()).toBe('a')

    texto.set('ab')
    await vi.advanceTimersByTimeAsync(200)
    texto.set('abc') // reinicia la espera
    await vi.advanceTimersByTimeAsync(200)
    expect(lento.get()).toBe('a')
    await vi.advanceTimersByTimeAsync(100)
    expect(lento.get()).toBe('abc') // 'ab' nunca llegó
  })

  it('acepta una función o un computed como fuente', async () => {
    const n = signal(1)
    const doble = computed(() => n.get() * 2)
    const [deFuncion, deComputed] = createRoot(() => [debounced(() => n.get() + 1, 50), debounced(doble, 50)])
    n.set(5)
    await vi.advanceTimersByTimeAsync(50)
    expect([deFuncion.get(), deComputed.get()]).toEqual([6, 10])
  })

  it('notifica una sola vez por ráfaga de cambios', async () => {
    const texto = signal('')
    const lento = createRoot(() => debounced(texto, 100))
    const vistos = []
    createRoot(() => effect(() => vistos.push(lento.get())))
    for (const t of ['d', 'du', 'dun', 'dune']) {
      texto.set(t)
      await vi.advanceTimersByTimeAsync(30)
    }
    await vi.advanceTimersByTimeAsync(100)
    expect(vistos).toEqual(['', 'dune'])
  })

  it('al desmontar cancela el temporizador pendiente', async () => {
    const texto = signal('a')
    let dispose
    const lento = createRoot((d) => { dispose = d; return debounced(texto, 100) })
    texto.set('b')
    await vi.advanceTimersByTimeAsync(0)
    dispose()
    await vi.advanceTimersByTimeAsync(200)
    expect(lento.get()).toBe('a')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('con resource: una sola petición por ráfaga y ninguna con la fuente vacía', async () => {
    const texto = signal('')
    const fetcher = vi.fn(async (q) => `resultados de ${q}`)
    const r = createRoot(() => {
      const busqueda = debounced(texto, 300)
      return resource(() => busqueda.get() || null, fetcher)
    })
    for (const t of ['d', 'du', 'dune']) {
      texto.set(t)
      await vi.advanceTimersByTimeAsync(100)
    }
    expect(fetcher).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(300)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls[0][0]).toBe('dune')
    expect(r.data.get()).toBe('resultados de dune')
  })

  it('si el valor vuelve al original dentro de la espera, no notifica', async () => {
    const texto = signal('a')
    const lento = createRoot(() => debounced(texto, 100))
    let notificaciones = 0
    createRoot(() => effect(() => { lento.get(); notificaciones++ }))
    texto.set('ab')
    await vi.advanceTimersByTimeAsync(50)
    texto.set('a')
    await vi.advanceTimersByTimeAsync(200)
    expect(lento.get()).toBe('a')
    expect(notificaciones).toBe(1)
  })

  it('con una fuente que crea objetos, no notifica al crearse sin cambios', async () => {
    const n = signal(1)
    const lento = createRoot(() => debounced(() => ({ v: n.get() }), 100))
    let notificaciones = 0
    createRoot(() => effect(() => { lento.get(); notificaciones++ }))
    await vi.advanceTimersByTimeAsync(300)
    expect(notificaciones).toBe(1)
    expect(lento.get()).toEqual({ v: 1 })
  })

  it('avisa si se crea fuera de un componente o createRoot', () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {})
    debounced(signal(1), 10)
    expect(aviso).toHaveBeenCalledWith(expect.stringContaining('fuera de un componente'))
    createRoot(() => debounced(signal(1), 10))
    expect(aviso).toHaveBeenCalledTimes(1)
  })

  it('rechaza un ms inválido', () => {
    expect(() => createRoot(() => debounced(signal(1)))).toThrow(TypeError)
    expect(() => createRoot(() => debounced(signal(1), -1))).toThrow(TypeError)
  })
})
