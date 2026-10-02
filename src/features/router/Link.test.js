import { describe, it, expect, vi, afterEach } from 'vitest'
import { Link } from './Link.js'
import { navigate } from './router.state.js'
import { createRoot } from '@core/signal.js'

const cargarAdmin = vi.hoisted(() => vi.fn(() => Promise.resolve()))

vi.mock('./routes.config.js', () => ({
  routes: [
    { path: '/', component: 'Inicio' },
    { path: '/admin', component: 'Admin', load: cargarAdmin },
    { path: '/admin/usuarios', component: 'Usuarios' },
    { path: '/acerca', component: 'Acerca' },
  ]
}))

const tick = () => new Promise(r => setTimeout(r))
const montar = (fn) => createRoot(() => { const el = fn(); document.body.appendChild(el); return el })

afterEach(() => { document.body.innerHTML = '' })

describe('Link', () => {
  it('crea un <a> con href, clases e hijos', () => {
    const a = montar(() => Link({ to: '/acerca', className: 'text-sm' }, 'Acerca ', 'de'))
    expect(a.tagName).toBe('A')
    expect(a.getAttribute('href')).toBe('/acerca')
    expect(a.className).toContain('text-sm')
    expect(a.textContent).toBe('Acerca de')
  })

  it('activeClass y aria-current siguen a la ruta actual', async () => {
    navigate('/')
    const a = montar(() => Link({ to: '/acerca', activeClass: 'font-bold' }, 'Acerca'))
    expect(a.classList.contains('font-bold')).toBe(false)
    expect(a.hasAttribute('aria-current')).toBe(false)
    navigate('/acerca?x=1')
    await tick()
    expect(a.classList.contains('font-bold')).toBe(true)
    expect(a.getAttribute('aria-current')).toBe('page')
  })

  it('por defecto también está activo en rutas hijas; exact lo evita; "/" es exacto', async () => {
    const padre = montar(() => Link({ to: '/admin', activeClass: 'on' }, 'Admin'))
    const exacto = montar(() => Link({ to: '/admin', exact: true, activeClass: 'on' }, 'Admin'))
    const inicio = montar(() => Link({ to: '/', activeClass: 'on' }, 'Inicio'))
    navigate('/admin/usuarios')
    await tick()
    expect(padre.classList.contains('on')).toBe(true)
    expect(exacto.classList.contains('on')).toBe(false)
    expect(inicio.classList.contains('on')).toBe(false)
    expect(padre.getAttribute('aria-current')).toBeNull() // aria-current solo en la página exacta
  })

  it('al hacer clic navega sin recargar (lo intercepta el router)', () => {
    navigate('/')
    const a = montar(() => Link({ to: '/acerca' }, 'Acerca'))
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    a.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
    expect(location.pathname).toBe('/acerca')
  })

  it('prefetch: carga la página diferida al pasar el ratón o enfocar, una sola vez', () => {
    cargarAdmin.mockClear()
    const a = montar(() => Link({ to: '/admin', prefetch: true }, 'Admin'))
    a.dispatchEvent(new Event('mouseenter'))
    a.dispatchEvent(new Event('focus'))
    expect(cargarAdmin).toHaveBeenCalledTimes(1)
    const sin = montar(() => Link({ to: '/admin' }, 'Admin'))
    sin.dispatchEvent(new Event('mouseenter'))
    expect(cargarAdmin).toHaveBeenCalledTimes(1)
  })

  it('un error de prefetch no rompe nada', async () => {
    cargarAdmin.mockClear()
    cargarAdmin.mockImplementationOnce(() => Promise.reject(new Error('offline')))
    const a = montar(() => Link({ to: '/admin', prefetch: true }, 'Admin'))
    expect(() => a.dispatchEvent(new Event('mouseenter'))).not.toThrow()
    await tick()
    a.dispatchEvent(new Event('mouseenter')) // tras un fallo, se reintenta
    expect(cargarAdmin).toHaveBeenCalledTimes(2)
  })

  it('una ruta no se activa por un hermano con prefijo común (/admin vs /administracion)', async () => {
    const a = montar(() => Link({ to: '/admin', activeClass: 'on' }, 'Admin'))
    navigate('/administracion')
    await tick()
    expect(a.classList.contains('on')).toBe(false)
  })
})

describe('cobertura R2 (Link)', () => {
  it('si load() lanza de forma síncrona, el prefetch también se reintenta', () => {
    cargarAdmin.mockClear()
    cargarAdmin.mockImplementationOnce(() => { throw new Error('síncrono') })
    const a = montar(() => Link({ to: '/admin', prefetch: true }, 'Admin'))
    a.dispatchEvent(new Event('mouseenter'))
    a.dispatchEvent(new Event('mouseenter'))
    expect(cargarAdmin).toHaveBeenCalledTimes(2)
  })
})
