import { describe, it, expect, vi } from 'vitest'
import { h, For } from './dom.js'
import { signal, createRoot } from '@core/signal.js'

const tick = () => new Promise(r => setTimeout(r))

// Monta dentro de un root (como hace el router con cada página)
const montar = (fn) => createRoot(dispose => ({ el: fn(), dispose }))

const a = { id: 1, t: 'a' }, b = { id: 2, t: 'b' }, c = { id: 3, t: 'c' }

describe('For', () => {
  it('pinta la lista en orden, entre hermanos fijos', () => {
    const lista = signal([a, b])
    const { el } = montar(() =>
      h('ul', {}, h('li', {}, 'inicio'), For(lista, x => x.id, x => h('li', {}, x.t)), h('li', {}, 'fin'))
    )
    expect([...el.querySelectorAll('li')].map(li => li.textContent)).toEqual(['inicio', 'a', 'b', 'fin'])
  })

  it('reutiliza los nodos al añadir, quitar y reordenar', async () => {
    const lista = signal([a, b])
    const render = vi.fn(x => h('li', {}, x.t))
    const { el } = montar(() => h('ul', {}, For(lista, x => x.id, render)))
    const [nodoA, nodoB] = el.children

    lista.set([c, b, a]) // añade c y reordena
    await tick()
    expect([...el.children].map(li => li.textContent)).toEqual(['c', 'b', 'a'])
    expect(el.children[1]).toBe(nodoB)
    expect(el.children[2]).toBe(nodoA)
    expect(render).toHaveBeenCalledTimes(3) // a, b y solo c nuevo

    lista.set([b])
    await tick()
    expect([...el.children]).toEqual([nodoB])
  })

  it('un objeto nuevo con la misma clave re-renderiza solo ese elemento', async () => {
    const lista = signal([a, b])
    const { el } = montar(() => h('ul', {}, For(lista, x => x.id, x => h('li', {}, x.t))))
    const nodoB = el.children[1]
    lista.set([{ ...a, t: 'A' }, b])
    await tick()
    expect(el.children[0].textContent).toBe('A')
    expect(el.children[1]).toBe(nodoB)
  })

  it('libera los effects de los elementos quitados y al desmontar', async () => {
    const marca = signal('!')
    const lista = signal([a, b])
    const { dispose } = montar(() => h('ul', {}, For(lista, x => x.id, x => h('li', {}, x.t, marca))))
    expect(marca.subs.size).toBe(2)
    lista.set([a])
    await tick()
    expect(marca.subs.size).toBe(1)
    dispose()
    expect(marca.subs.size).toBe(0)
  })

  it('avisa si hay claves duplicadas y aun así pinta todo', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const lista = signal([a, { ...a, t: 'otra' }])
    const { el } = montar(() => h('ul', {}, For(lista, x => x.id, x => h('li', {}, x.t))))
    expect(el.children.length).toBe(2)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('lista vacía no pinta nada y acepta una función como fuente', async () => {
    const lista = signal([])
    const { el } = montar(() => h('ul', {}, For(() => lista.get().filter(x => x.id > 1), x => x.id, x => h('li', {}, x.t))))
    expect(el.children.length).toBe(0)
    lista.set([a, b, c])
    await tick()
    expect([...el.children].map(li => li.textContent)).toEqual(['b', 'c'])
  })
})
