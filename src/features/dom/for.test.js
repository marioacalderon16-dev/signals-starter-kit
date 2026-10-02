import { describe, it, expect, vi } from 'vitest'
import { h, For, Show } from './dom.js'
import { signal, createRoot } from '@core/signal.js'
import { define, c as componente } from '@components/Component.js'

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

describe('For con elementos que son fragmentos (Show, varios nodos)', () => {
  const sinComentarios = (html) => html.replace(/<!--.*?-->/g, '')

  it('reordena, añade y quita elementos cuyo render devuelve un Show', async () => {
    const lista = signal([1, 2, 3])
    const { el } = montar(() => h('div', {}, For(lista, x => x, x => Show(() => true, () => h('span', {}, `i${x}`)))))
    expect(el.textContent).toBe('i1i2i3')
    lista.set([3, 1]); await tick()
    expect(sinComentarios(el.innerHTML)).toBe('<span>i3</span><span>i1</span>')
    lista.set([2, 3, 1]); await tick()
    expect(el.textContent).toBe('i2i3i1')
    lista.set([]); await tick()
    expect(sinComentarios(el.innerHTML)).toBe('')
  })

  it('un Show que empieza en texto y pasa a nodo sigue moviéndose y quitándose bien', async () => {
    const items = signal([1, 2])
    const on = signal(false)
    const { el } = montar(() => h('div', {}, For(items, x => x, x => Show(on, () => h('span', {}, `S${x}`), () => `t${x}`))))
    expect(el.textContent).toBe('t1t2')
    on.set(true); await tick()
    expect(el.textContent).toBe('S1S2')
    items.set([2]); await tick()
    expect(sinComentarios(el.innerHTML)).toBe('<span>S2</span>')
    items.set([2, 1]); await tick()
    expect(el.textContent).toBe('S2S1')
  })

  it('un componente reactivo (define con true) que se re-renderiza dentro del item no descoloca la lista', async () => {
    const modo = signal('a')
    define('FilaReactivaFor', ({ x }) => h('span', {}, `${modo.get()}${x}`), true)
    const items = signal([1, 2])
    const { el } = montar(() => h('div', {}, For(items, x => x, x => componente('FilaReactivaFor', { x }))))
    modo.set('b'); await tick()
    items.set([2]); await tick()
    expect(el.textContent).toBe('b2')
    items.set([2, 1]); await tick()
    expect(el.textContent).toBe('b2b1')
  })

  it('un render que devuelve null/false no pinta nada; un texto se pinta como texto', () => {
    const { el } = montar(() => h('div', {}, For(signal([1, 2, 3]), x => x, x => (x === 1 ? null : x === 2 ? false : 'tres'))))
    expect(el.textContent).toBe('tres')
  })

  it('un render que devuelve varios nodos se mueve como un bloque', async () => {
    const lista = signal(['a', 'b'])
    const render = (x) => { const f = document.createDocumentFragment(); f.append(h('dt', {}, x), h('dd', {}, x.toUpperCase())); return f }
    const { el } = montar(() => h('dl', {}, For(lista, x => x, render)))
    lista.set(['b', 'a']); await tick()
    expect(sinComentarios(el.innerHTML)).toBe('<dt>b</dt><dd>B</dd><dt>a</dt><dd>A</dd>')
    lista.set(['a']); await tick()
    expect(sinComentarios(el.innerHTML)).toBe('<dt>a</dt><dd>A</dd>')
  })
})
