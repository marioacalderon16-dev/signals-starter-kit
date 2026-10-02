import { describe, it, expect, vi, afterEach } from 'vitest'
import { define, c, render } from './Component.js'
import { h } from '@features/dom/dom.js'
import { signal } from '@core/signal.js'

const tick = () => new Promise(r => setTimeout(r))

afterEach(() => vi.restoreAllMocks())

describe('render()', () => {
  it('update y cleanup no lanzan y reemplazan el elemento', () => {
    const container = document.createElement('div')
    const r = render(p => Object.assign(document.createElement('span'), { textContent: p.n }), container, { n: 1 })
    r.update({ n: 2 })
    expect(container.textContent).toBe('2')
    r.cleanup()
    expect(container.childNodes.length).toBe(0)
  })
})

describe('define(..., isReactive)', () => {
  it('re-renderiza y reemplaza en el DOM cuando cambia un signal leído en el cuerpo', async () => {
    const modo = signal('a')
    define('RxBody', () => h('p', {}, `modo:${modo.get()}`), true)
    const host = h('div', {}, c('RxBody'))
    modo.set('b')
    await tick()
    expect(host.textContent).toBe('modo:b')
    expect(host.childNodes.length).toBe(1)
  })

  it('los bindings de h() no re-renderizan el componente entero', async () => {
    const texto = signal('x')
    const clase = signal('c1')
    const attr = signal('t1')
    const body = vi.fn(() => h('p', { className: clase, title: attr, 'data-x': attr }, texto))
    define('RxBindings', body, true)
    const host = h('div', {}, c('RxBindings'))
    texto.set('y')
    clase.set('c2')
    attr.set('t2')
    await tick()
    expect(body).toHaveBeenCalledTimes(1)
    const p = host.firstChild
    expect([p.textContent, p.className, p.title, p.getAttribute('data-x')]).toEqual(['y', 'c2', 't2', 't2'])
  })

  it('no acumula suscripciones al re-renderizar', async () => {
    const modo = signal(0)
    const texto = signal('t')
    define('RxLeak', () => h('p', {}, modo.get(), texto), true)
    h('div', {}, c('RxLeak'))
    const inicial = texto.subs.size
    for (let i = 1; i <= 3; i++) { modo.set(i); await tick() }
    expect(texto.subs.size).toBe(inicial)
  })

  it('si no está montado, avisa y no lanza', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const modo = signal(0)
    define('RxSuelto', () => h('p', {}, modo.get()), true)
    c('RxSuelto') // nunca se monta
    modo.set(1)
    await tick()
    expect(err).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalled()
  })
})
