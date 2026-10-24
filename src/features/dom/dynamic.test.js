import { describe, it, expect, vi } from 'vitest'
import { h, Dynamic } from './dom.js'
import { signal, computed, createRoot, onCleanup, getStats } from '@core/signal.js'
import * as kit from '../../kit.js'

const tick = () => new Promise(r => setTimeout(r))
const sinComentarios = (html) => html.replace(/<!--.*?-->/g, '')
const montar = (fn) => createRoot(dispose => ({ el: fn(), dispose }))
// Vista con un effect propio (el title reactivo), para contar effects vivos
const Vista = (n) => h('p', { title: computed(() => `n${n}`) }, String(n))

describe('Dynamic / función como hijo de h()', () => {
  it('pinta la vista y la rehace cuando cambia lo que lee', async () => {
    const n = signal(1)
    const { el } = montar(() => h('div', {}, () => Vista(n.get())))
    expect(sinComentarios(el.innerHTML)).toBe('<p title="n1">1</p>')
    n.set(2)
    await tick()
    expect(sinComentarios(el.innerHTML)).toBe('<p title="n2">2</p>')
  })

  it('acepta texto y valores vacíos', async () => {
    const n = signal(0)
    const { el } = montar(() => h('div', {}, () => (n.get() ? `hay ${n.get()}` : null)))
    expect(el.textContent).toBe('')
    n.set(3)
    await tick()
    expect(el.textContent).toBe('hay 3')
  })

  it('no acumula effects al cambiar y los libera todos al desmontar', async () => {
    const base = getStats().effects
    const n = signal(0)
    const { dispose } = montar(() => h('div', {}, () => Vista(n.get())))
    const inicio = getStats().effects
    for (let i = 1; i <= 10; i++) {
      n.set(i)
      await tick()
    }
    expect(getStats().effects).toBe(inicio)
    dispose()
    expect(getStats().effects).toBe(base)
  })

  it('sigue sin fugas aunque otro código lea los mismos signals fuera de un effect', async () => {
    // Con un computed como hijo, leerlo desde un handler deja effects sin dueño
    const base = getStats().effects
    const n = signal(0)
    const { dispose } = montar(() => h('div', {}, () => Vista(n.get())))
    const inicio = getStats().effects
    for (let i = 1; i <= 5; i++) {
      n.set(i)
      n.get()
      await tick()
    }
    expect(getStats().effects).toBe(inicio)
    dispose()
    expect(getStats().effects).toBe(base)
  })

  it('onCleanup dentro de la vista corre en cada cambio y al desmontar', async () => {
    const limpieza = vi.fn()
    const n = signal(0)
    const { dispose } = montar(() => h('div', {}, () => {
      const valor = n.get()
      onCleanup(() => limpieza(valor))
      return h('span', {}, String(valor))
    }))
    n.set(1)
    await tick()
    expect(limpieza).toHaveBeenCalledTimes(1)
    expect(limpieza).toHaveBeenLastCalledWith(0)
    dispose()
    expect(limpieza).toHaveBeenCalledTimes(2)
    expect(limpieza).toHaveBeenLastCalledWith(1)
  })

  it('Dynamic se puede usar suelto y se exporta desde @kit', async () => {
    const n = signal('a')
    const { el } = montar(() => h('div', {}, Dynamic(() => h('b', {}, n.get()))))
    n.set('b')
    await tick()
    expect(sinComentarios(el.innerHTML)).toBe('<b>b</b>')
    expect(kit.Dynamic).toBe(Dynamic)
  })
})
