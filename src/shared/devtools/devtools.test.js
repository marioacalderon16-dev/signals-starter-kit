import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { signal, effect, createRoot, getStats } from '@core/signal.js'
import { h, devtools } from '@features/dom/dom.js'
import { iniciarDevtools } from './devtools.js'

const tick = () => new Promise(r => setTimeout(r))
// Con temporizadores falsos: deja correr las microtasks (ahí se ejecutan los effects)
const microtasks = async () => { for (let i = 0; i < 5; i++) await Promise.resolve() }

describe('getStats', () => {
  it('cuenta los effects vivos', () => {
    const antes = getStats().effects
    const dispose = effect(() => {})
    expect(getStats().effects).toBe(antes + 1)
    dispose()
    dispose() // dos veces no descuenta dos
    expect(getStats().effects).toBe(antes)
  })
})

describe('gancho devtools.onUpdate', () => {
  afterEach(() => { devtools.onUpdate = null })

  it('avisa al actualizar texto, atributos y clases, no en el primer pintado', async () => {
    const actualizados = []
    devtools.onUpdate = (el) => actualizados.push(el)
    const texto = signal('a'), titulo = signal('t'), activo = signal(false)
    const el = createRoot(() => h('p', { title: titulo, className: { base: true, on: activo } }, texto))
    expect(actualizados).toEqual([])
    texto.set('b'); titulo.set('u'); activo.set(true)
    await tick()
    expect(actualizados.length).toBe(3)
    expect(actualizados.every(x => x === el)).toBe(true)
  })
})

describe('iniciarDevtools', () => {
  let parar
  beforeEach(() => { localStorage.clear(); vi.useFakeTimers() })
  afterEach(() => { parar?.(); vi.useRealTimers(); document.body.innerHTML = '' })

  it('muestra la insignia con el número de effects y la actualiza', () => {
    parar = iniciarDevtools()
    const insignia = document.querySelector('[data-ssk-devtools]')
    expect(insignia.textContent).toMatch(/⚡ \d+ effects/)
    const dispose = effect(() => {})
    vi.advanceTimersByTime(600)
    expect(insignia.textContent).toContain(`⚡ ${getStats().effects} effects`)
    dispose()
  })

  it('resalta los nodos actualizados y quita la marca después', async () => {
    parar = iniciarDevtools()
    const texto = signal('a')
    const el = createRoot(() => h('p', {}, texto))
    document.body.appendChild(el)
    texto.set('b')
    await microtasks()
    expect(el.hasAttribute('data-ssk-flash')).toBe(true)
    vi.advanceTimersByTime(1000)
    expect(el.hasAttribute('data-ssk-flash')).toBe(false)
  })

  it('un clic en la insignia desactiva el resaltado y se recuerda', async () => {
    parar = iniciarDevtools()
    document.querySelector('[data-ssk-devtools]').click()
    expect(localStorage.getItem('ssk-devtools')).toBe('off')
    const texto = signal('a')
    const el = createRoot(() => h('p', {}, texto))
    texto.set('b')
    await microtasks()
    expect(el.hasAttribute('data-ssk-flash')).toBe(false)
    parar()
    parar = iniciarDevtools()
    expect(document.querySelector('[data-ssk-devtools]').textContent).toContain('resaltar: no')
  })

  it('parar() quita la insignia y el gancho', () => {
    parar = iniciarDevtools()
    parar()
    parar = null
    expect(document.querySelector('[data-ssk-devtools]')).toBeNull()
    expect(devtools.onUpdate).toBeNull()
  })
})

describe('cobertura R2 (devtools)', () => {
  it('parar() detiene el intervalo de la insignia', () => {
    vi.useFakeTimers()
    const parar = iniciarDevtools()
    expect(vi.getTimerCount()).toBeGreaterThan(0)
    parar()
    expect(vi.getTimerCount()).toBe(0)
    vi.useRealTimers()
  })
})
