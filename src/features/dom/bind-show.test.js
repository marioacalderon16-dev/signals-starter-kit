import { describe, it, expect, vi } from 'vitest'
import { h, Show, For } from './dom.js'
import { signal, createRoot, computed } from '@core/signal.js'

const tick = () => new Promise(r => setTimeout(r))
// Los hijos reactivos con nodos usan dos comentarios como anclas: se ignoran al comparar HTML
const sinComentarios = (html) => html.replace(/<!--.*?-->/g, '')
const montar = (fn) => createRoot(dispose => ({ el: fn(), dispose }))

describe('bind:value / bind:checked', () => {
  it('bind:value sincroniza en los dos sentidos', async () => {
    const email = signal('ana@x.com')
    const { el } = montar(() => h('input', { 'bind:value': email }))
    expect(el.value).toBe('ana@x.com')
    el.value = 'luis@x.com'
    el.dispatchEvent(new Event('input'))
    expect(email.get()).toBe('luis@x.com')
    email.set('')
    await tick()
    expect(el.value).toBe('')
  })

  it('no reescribe el input si el valor ya coincide (no mueve el cursor)', async () => {
    const texto = signal('abc')
    const { el } = montar(() => h('input', { 'bind:value': texto }))
    el.value = 'abcd'                   // el usuario escribió, pero el signal aún no lo sabe
    const set = vi.spyOn(el, 'value', 'set')
    texto.set('abcd')                   // el signal cambia al mismo valor que ya tiene el input
    await tick()
    expect(set).not.toHaveBeenCalled()  // no se reescribe: el cursor no se mueve
    texto.set('xyz')
    await tick()
    expect(set).toHaveBeenCalledTimes(1) // un valor distinto sí se escribe
  })

  it('bind:value en textarea y select', () => {
    const t = signal('hola'), s = signal('b')
    const { el } = montar(() => h('div', {},
      h('textarea', { 'bind:value': t }),
      h('select', { 'bind:value': s }, h('option', { value: 'a' }, 'A'), h('option', { value: 'b' }, 'B'))
    ))
    expect(el.querySelector('textarea').value).toBe('hola')
    expect(el.querySelector('select').value).toBe('b')
  })

  it('bind:checked para checkboxes', async () => {
    const acepto = signal(false)
    const { el } = montar(() => h('input', { type: 'checkbox', 'bind:checked': acepto }))
    document.body.appendChild(el) // un checkbox fuera del documento no dispara change (estándar HTML)
    el.click()
    expect(acepto.get()).toBe(true)
    acepto.set(false)
    await tick()
    expect(el.checked).toBe(false)
    el.remove()
  })

  it('null/undefined se muestran como vacío; un bind no soportado avisa', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { el } = montar(() => h('input', { 'bind:value': signal(null) }))
    expect(el.value).toBe('')
    montar(() => h('input', { 'bind:title': signal('x') }))
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('Show', () => {
  it('alterna entre vista y alternativa', async () => {
    const abierto = signal(false)
    const { el } = montar(() => h('div', {}, Show(abierto, () => h('p', {}, 'abierto'), () => h('p', {}, 'cerrado'))))
    expect(el.textContent).toBe('cerrado')
    abierto.set(true)
    await tick()
    expect(el.textContent).toBe('abierto')
  })

  it('sin alternativa no pinta nada; acepta una función como condición', async () => {
    const n = signal(0)
    const { el } = montar(() => h('div', {}, 'a', Show(() => n.get() > 0, () => h('b', {}, 'hay')), 'z'))
    expect(el.textContent).toBe('az')
    n.set(3)
    await tick()
    expect(el.textContent).toBe('ahayz')
  })

  it('no reconstruye la vista si la condición sigue siendo verdadera', async () => {
    const n = signal(1)
    const vista = vi.fn(() => h('p', {}, 'vista'))
    const { el } = montar(() => h('div', {}, Show(() => n.get() > 0, vista)))
    const nodo = el.firstElementChild
    n.set(2); await tick()
    n.set(5); await tick()
    expect(vista).toHaveBeenCalledTimes(1)
    expect(el.firstElementChild).toBe(nodo)
  })

  it('la vista conserva su reactividad y se limpia al ocultarse o desmontar', async () => {
    const visible = signal(true)
    const texto = signal('uno')
    const { el, dispose } = montar(() => h('div', {}, Show(visible, () => h('p', {}, texto))))
    texto.set('dos'); await tick()
    expect(el.textContent).toBe('dos')
    visible.set(false); await tick()
    expect(texto.subs.size).toBe(0)
    visible.set(true); await tick()
    expect(texto.subs.size).toBe(1)
    dispose()
    expect(texto.subs.size).toBe(0)
  })
})

describe('regresiones R1 (dom)', () => {
  it('Show con una vista que devuelve un fragmento (For) cambia de rama y vuelve', async () => {
    const on = signal(true)
    const items = signal([{ id: 1 }, { id: 2 }])
    const { el } = montar(() => h('div', {},
      Show(on, () => For(items, x => x.id, x => h('span', {}, `i${x.id}`)), () => h('p', {}, 'off'))
    ))
    expect(el.textContent).toBe('i1i2')
    on.set(false); await tick()
    expect(sinComentarios(el.innerHTML)).toBe('<p>off</p>')
    on.set(true); await tick()
    expect(el.textContent).toBe('i1i2')
    items.set([{ id: 3 }]); await tick()
    expect(el.textContent).toBe('i3') // la lista sigue viva tras volver a mostrarse
  })

  it('Show + For: si la lista crece antes de ocultarse, no quedan nodos huérfanos', async () => {
    const on = signal(true)
    const items = signal([{ id: 1 }])
    const { el } = montar(() => h('div', {},
      Show(on, () => For(items, x => x.id, x => h('span', {}, `i${x.id}`)), () => h('p', {}, 'off'))
    ))
    items.set([{ id: 1 }, { id: 2 }, { id: 3 }]); await tick()
    on.set(false); await tick()
    expect(sinComentarios(el.innerHTML)).toBe('<p>off</p>')
  })

  it('un mismo fragmento puede volver a mostrarse (fragmento → texto → fragmento)', async () => {
    const frag = document.createDocumentFragment()
    frag.append(h('b', {}, 'A'), h('i', {}, 'B'))
    const valor = signal(frag)
    const { el } = montar(() => h('div', {}, valor))
    valor.set('texto'); await tick()
    expect(el.textContent).toBe('texto')
    valor.set(frag); await tick()
    expect(sinComentarios(el.innerHTML)).toBe('<b>A</b><i>B</i>')
  })

  it('el valor nuevo puede ser un nodo que estaba dentro del rango anterior (primero o último)', async () => {
    const i = h('i', {}, 'I'), b = h('b', {}, 'B')
    const frag = () => { const f = document.createDocumentFragment(); f.append(i, b); return f }
    const valor = signal(frag())
    const { el } = montar(() => h('div', {}, h('em', {}, 'antes'), valor, h('u', {}, 'después')))
    valor.set(b); await tick()
    expect(sinComentarios(el.innerHTML)).toBe('<em>antes</em><b>B</b><u>después</u>')
    valor.set(frag()); await tick()
    valor.set(i); await tick()
    expect(sinComentarios(el.innerHTML)).toBe('<em>antes</em><i>I</i><u>después</u>')
  })

  it('Show dentro de Show: el exterior sigue funcionando aunque el interior cambie su nodo', async () => {
    const a = signal(true), b = signal(true)
    const { el } = montar(() => h('div', {},
      Show(a, () => Show(b, () => h('i', {}, 'I'), () => h('s', {}, 'S')), () => h('p', {}, 'off'))
    ))
    b.set(false); await tick()
    expect(sinComentarios(el.innerHTML)).toBe('<s>S</s>')
    a.set(false); await tick()
    expect(sinComentarios(el.innerHTML)).toBe('<p>off</p>')
    a.set(true); await tick()
    expect(sinComentarios(el.innerHTML)).toBe('<s>S</s>')
  })

  it('texto ↔ nodo ↔ fragmento alternando, sin tocar a los hermanos', async () => {
    const valor = signal('t')
    const { el } = montar(() => h('div', {}, '[', valor, ']'))
    const f = () => { const x = document.createDocumentFragment(); x.append(h('b', {}, '1'), h('b', {}, '2')); return x }
    for (const [v, esperado] of [[h('i', {}, 'n'), '[<i>n</i>]'], ['texto', '[texto]'], [f(), '[<b>1</b><b>2</b>]'], [null, '[]'], [f(), '[<b>1</b><b>2</b>]'], ['fin', '[fin]']]) {
      valor.set(v); await tick()
      expect(sinComentarios(el.innerHTML)).toBe(esperado)
    }
  })

  it('si sacan el hijo reactivo del DOM, avisa en lugar de fallar en silencio', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const valor = signal('a')
    const { el } = montar(() => h('div', {}, valor))
    el.firstChild.remove()
    valor.set('b'); await tick()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('bind:value en <input type=number> guarda números (vacío → null)', () => {
    const n = signal(5)
    const { el } = montar(() => h('input', { type: 'number', 'bind:value': n }))
    expect(el.value).toBe('5')
    el.value = '6'; el.dispatchEvent(new Event('input'))
    expect(n.get()).toBe(6)
    el.value = ''; el.dispatchEvent(new Event('input'))
    expect(n.get()).toBeNull()
  })

  it('bind:value numérico no reescribe lo que el usuario está tecleando (1.0, 1.50, 01)', async () => {
    const n = signal(1)
    const { el } = montar(() => h('input', { type: 'number', 'bind:value': n }))
    for (const tecleado of ['1.0', '1.50', '01']) {
      el.value = tecleado; el.dispatchEvent(new Event('input')); await tick()
      expect(el.value).toBe(tecleado)
    }
    expect(n.get()).toBe(1)
    n.set(7); await tick()
    expect(el.value).toBe('7') // un cambio real del signal sí se refleja
  })

  it('bind:value en <select> aplica el valor cuando las opciones llegan después', async () => {
    const pais = signal('mx')
    const opciones = signal([])
    const { el } = montar(() => h('select', { 'bind:value': pais },
      For(opciones, o => o, o => h('option', { value: o }, o))
    ))
    opciones.set(['es', 'mx']); await tick()
    expect(el.value).toBe('mx')
    expect(pais.get()).toBe('mx')
  })
})

describe('cobertura R2 (dom)', () => {
  it('bind:value en <select>: elegir otra opción (evento change) actualiza el signal', () => {
    const pais = signal('es')
    const { el } = montar(() => h('select', { 'bind:value': pais }, h('option', { value: 'es' }, 'ES'), h('option', { value: 'mx' }, 'MX')))
    el.value = 'mx'
    el.dispatchEvent(new Event('change'))
    expect(pais.get()).toBe('mx')
  })

  it('Show: al volver a la vista principal se liberan los effects de la alternativa', async () => {
    const visible = signal(false)
    const texto = signal('alt')
    const { el } = montar(() => h('div', {}, Show(visible, () => h('p', {}, 'vista'), () => h('p', {}, texto))))
    expect(texto.subs.size).toBe(1)
    visible.set(true); await tick()
    expect(el.textContent).toBe('vista')
    expect(texto.subs.size).toBe(0)
  })
})

describe('cobertura R2 (reactiveChild)', () => {
  it('si el valor vuelve a ser el mismo nodo, no lo reinserta en el DOM', async () => {
    const otro = signal(0)
    const nodo = h('b', {}, 'fijo')
    const { el } = montar(() => h('div', {}, computed(() => (otro.get(), nodo))))
    const cambios = []
    const observador = new MutationObserver(m => cambios.push(...m))
    observador.observe(el, { childList: true, subtree: true })
    otro.set(1); await tick() // el computed se recalcula y devuelve el mismo nodo
    await Promise.resolve()
    observador.disconnect()
    expect(cambios).toEqual([])
  })
})
