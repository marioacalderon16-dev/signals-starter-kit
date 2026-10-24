import { describe, it, expect, vi } from 'vitest'
import { h, Show } from './dom.js'
import { signal, computed, createRoot, onCleanup, getStats } from '@core/signal.js'

const tick = () => new Promise(r => setTimeout(r))
const sinComentarios = (html) => html.replace(/<!--.*?-->/g, '')
const montar = (fn) => createRoot(dispose => ({ el: fn(), dispose }))

describe('Show: la vista recibe el valor', () => {
  it('sin keyed recibe una función que lee el valor actual y conserva el nodo', async () => {
    const usuario = signal({ nombre: 'Ana' })
    const vista = vi.fn((u) => h('h1', {}, computed(() => u().nombre)))
    const { el } = montar(() => h('div', {}, Show(usuario, vista)))
    const h1 = el.querySelector('h1')
    expect(h1.textContent).toBe('Ana')
    usuario.set({ nombre: 'Luis' })
    await tick()
    expect(el.querySelector('h1')).toBe(h1)   // mismo nodo
    expect(h1.textContent).toBe('Luis')       // pero al día
    expect(vista).toHaveBeenCalledTimes(1)
  })

  it('las vistas sin parámetros siguen funcionando igual', async () => {
    const visible = signal(true)
    const { el } = montar(() => h('div', {}, Show(visible, () => h('p', {}, 'sí'), () => h('p', {}, 'no'))))
    expect(sinComentarios(el.innerHTML)).toBe('<p>sí</p>')
    visible.set(false)
    await tick()
    expect(sinComentarios(el.innerHTML)).toBe('<p>no</p>')
  })
})

describe('Show con keyed', () => {
  it('reconstruye cuando llega otro valor y la vista lo recibe directo', async () => {
    const usuario = signal({ nombre: 'Ana' })
    const vista = vi.fn((u) => h('h1', {}, u.nombre))
    const { el } = montar(() => h('div', {}, Show(usuario, vista, null, { keyed: true })))
    const antes = el.querySelector('h1')
    expect(antes.textContent).toBe('Ana')
    usuario.set({ nombre: 'Luis' })
    await tick()
    expect(el.querySelector('h1')).not.toBe(antes)
    expect(el.querySelector('h1').textContent).toBe('Luis')
    expect(vista).toHaveBeenCalledTimes(2)
    expect(vista).toHaveBeenLastCalledWith({ nombre: 'Luis' })
  })

  it('no reconstruye si el valor es el mismo objeto', async () => {
    const u = { nombre: 'Ana' }
    const usuario = signal(u)
    const otro = signal(0)
    const vista = vi.fn((x) => h('h1', {}, x.nombre))
    montar(() => h('div', {}, Show(() => (otro.get(), usuario.get()), vista, null, { keyed: true })))
    otro.set(1)
    await tick()
    expect(vista).toHaveBeenCalledTimes(1)
  })

  it('pasa a la alternativa con cualquier valor falso y no la rehace entre falsos', async () => {
    const valor = signal(null)
    const alternativa = vi.fn(() => h('p', {}, 'vacío'))
    const { el } = montar(() => h('div', {}, Show(valor, (v) => h('b', {}, String(v)), alternativa, { keyed: true })))
    valor.set(undefined)
    await tick()
    valor.set(0)
    await tick()
    expect(alternativa).toHaveBeenCalledTimes(1)
    expect(sinComentarios(el.innerHTML)).toBe('<p>vacío</p>')
    valor.set(5)
    await tick()
    expect(sinComentarios(el.innerHTML)).toBe('<b>5</b>')
  })

  it('libera los effects y onCleanup de la versión anterior', async () => {
    const base = getStats().effects
    const limpieza = vi.fn()
    const n = signal(1)
    const { dispose } = montar(() => h('div', {}, Show(n, (v) => {
      onCleanup(() => limpieza(v))
      return h('p', { title: computed(() => `n${v}`) }, String(v))
    }, null, { keyed: true })))
    const inicio = getStats().effects
    for (let i = 2; i <= 6; i++) {
      n.set(i)
      await tick()
    }
    expect(getStats().effects).toBe(inicio)
    expect(limpieza).toHaveBeenCalledTimes(5)
    dispose()
    expect(limpieza).toHaveBeenLastCalledWith(6)
    expect(getStats().effects).toBe(base)
  })
})
