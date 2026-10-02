import { describe, it, expect, vi } from 'vitest'
import { h, Show } from './dom.js'
import { signal, createRoot } from '@core/signal.js'

const tick = () => new Promise(r => setTimeout(r))
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
    const set = vi.spyOn(el, 'value', 'set')
    el.dispatchEvent(new Event('input')) // el valor no cambia
    texto.set('abc')
    await tick()
    expect(set).not.toHaveBeenCalled()
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
