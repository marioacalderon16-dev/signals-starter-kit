import { describe, it, expect, vi, afterEach } from 'vitest'
import { h, fragment } from './dom.js'
import { signal } from '@core/signal.js'

const tick = () => new Promise(r => setTimeout(r))

afterEach(() => vi.restoreAllMocks())

describe('h() – eventos', () => {
  it('onClick y on:custom registran listeners', () => {
    const click = vi.fn()
    const custom = vi.fn()
    const el = h('button', { onClick: click, 'on:my-event': custom })
    el.click()
    el.dispatchEvent(new Event('my-event'))
    expect(click).toHaveBeenCalledTimes(1)
    expect(custom).toHaveBeenCalledTimes(1)
  })

  it('atributos que empiezan por "on" en minúscula no son eventos', () => {
    const el = h('div', { one: 'x', online: 'y' })
    expect(el.getAttribute('one')).toBe('x')
    expect(el.getAttribute('online')).toBe('y')
  })

  it('un handler que no es función avisa y no lanza', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() => h('button', { onClick: 'alert(1)' })).not.toThrow()
    expect(warn).toHaveBeenCalled()
  })
})

describe('h() – innerHTML', () => {
  it('innerHTML se ignora con aviso (evita XSS accidental)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const el = h('div', { innerHTML: '<img src=x onerror=alert(1)>' })
    expect(el.innerHTML).toBe('')
    expect(warn).toHaveBeenCalled()
  })

  it('dangerouslySetInnerHTML inserta HTML de forma explícita (estático y signal)', async () => {
    expect(h('div', { dangerouslySetInnerHTML: '<b>hi</b>' }).innerHTML).toBe('<b>hi</b>')
    const html = signal('<i>a</i>')
    const el = h('div', { dangerouslySetInnerHTML: html })
    html.set('<i>b</i>')
    await tick()
    expect(el.innerHTML).toBe('<i>b</i>')
  })
})

describe('h() – hijos', () => {
  it('false, true, null y undefined no se pintan', () => {
    const el = h('div', {}, false, true, null, undefined, 0, 'a')
    expect(el.textContent).toBe('0a')
  })

  it('patrón cond && h(...) funciona', () => {
    const show = false
    expect(h('div', {}, show && h('span', {}, 'x')).textContent).toBe('')
  })

  it('signal hijo con texto se actualiza', async () => {
    const s = signal('uno')
    const el = h('p', {}, s)
    s.set('dos')
    await tick()
    expect(el.textContent).toBe('dos')
  })

  it('signal hijo puede contener un Node y alternar con texto/false', async () => {
    const s = signal(h('b', {}, 'nodo'))
    const el = h('p', {}, 'antes-', s, '-después')
    expect(el.innerHTML).toBe('antes-<b>nodo</b>-después')
    s.set(false)
    await tick()
    expect(el.textContent).toBe('antes--después')
    s.set('texto')
    await tick()
    expect(el.textContent).toBe('antes-texto-después')
    s.set(h('i', {}, 'otro'))
    await tick()
    expect(el.innerHTML).toBe('antes-<i>otro</i>-después')
  })

  it('avisa si hay hijos junto a textContent o dangerouslySetInnerHTML', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(h('p', { textContent: 'a' }, 'hijo').textContent).toBe('a')
    h('p', { dangerouslySetInnerHTML: '<b>a</b>' }, h('i'))
    expect(warn).toHaveBeenCalledTimes(2)
  })

  it('no avisa si los hijos extra son vacíos', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    h('p', { textContent: 'a' }, false, null)
    expect(warn).not.toHaveBeenCalled()
  })

  it('fragment() tampoco pinta booleanos', () => {
    const div = document.createElement('div')
    div.appendChild(fragment(false, 'a', null, true))
    expect(div.textContent).toBe('a')
  })
})
