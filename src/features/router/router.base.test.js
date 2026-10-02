import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'

// Simula una app desplegada en una subruta (vite.config: base: '/app/')
vi.stubEnv('BASE_URL', '/app/')

let base, state, routes

beforeAll(async () => {
  history.replaceState(null, '', '/app/')
  base = await import('./router.base.js')
  state = await import('./router.state.js')
  routes = await import('./routes.config.js')
})

afterEach(() => { document.body.innerHTML = '' })

describe('router con base /app/', () => {
  it('url() añade la base y es idempotente', () => {
    expect(base.url('/')).toBe('/app/')
    expect(base.url('/tareas?q=1#x')).toBe('/app/tareas?q=1#x')
    expect(base.url(base.url('/tareas'))).toBe('/app/tareas')
  })

  it('stripBase() quita la base', () => {
    expect(base.stripBase('/app')).toBe('/')
    expect(base.stripBase('/app/')).toBe('/')
    expect(base.stripBase('/app/tareas')).toBe('/tareas')
    expect(base.stripBase('/apple')).toBe('/apple') // no confunde prefijos
  })

  it('la ruta inicial /app/ se lee como /', () => {
    expect(state.currentPath.get()).toBe('/')
  })

  it('navigate usa rutas de la app y escribe la URL con base', () => {
    state.navigate('/tareas/?q=1')
    expect(location.pathname + location.search).toBe('/app/tareas/?q=1')
    expect(state.currentPath.get()).toBe('/tareas')
    state.navigate(base.url('/otra')) // también acepta una URL que ya lleva la base
    expect(location.pathname).toBe('/app/otra')
    expect(state.currentPath.get()).toBe('/otra')
  })

  it('popstate quita la base', () => {
    history.pushState(null, '', '/app/x/')
    dispatchEvent(new PopStateEvent('popstate'))
    expect(state.currentPath.get()).toBe('/x')
  })

  it('generateUrl incluye la base', () => {
    routes.routes.push({ path: '/p/:id', component: 'P', name: 'p' })
    expect(routes.generateUrl('p', { id: 7 })).toBe('/app/p/7')
  })

  const click = (href) => {
    const a = document.createElement('a')
    a.setAttribute('href', href)
    document.body.appendChild(a)
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    a.dispatchEvent(ev)
    return ev
  }

  it('intercepta enlaces dentro de la base y deja pasar los de fuera', () => {
    state.navigate('/')
    expect(click('/app/y').defaultPrevented).toBe(true)
    expect(state.currentPath.get()).toBe('/y')
    expect(click('/fuera').defaultPrevented).toBe(false)
    expect(state.currentPath.get()).toBe('/y')
  })
})
