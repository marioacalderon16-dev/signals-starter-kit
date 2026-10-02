import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'

// Simula una app desplegada en una subruta (vite.config: base: '/app/')
vi.stubEnv('BASE_URL', '/app/')

let base, state, routes, rutaInicial

beforeAll(async () => {
  history.replaceState(null, '', '/app/')
  base = await import('./router.base.js')
  state = await import('./router.state.js')
  rutaInicial = state.currentPath.get() // capturada antes de que ningún test navegue
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
    expect(rutaInicial).toBe('/')
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
    // jsdom no implementa la navegación real: se anota si el router la impidió y luego se cancela
    let impedido
    window.addEventListener('click', (e) => { impedido = e.defaultPrevented; e.preventDefault() }, { once: true })
    a.dispatchEvent(ev)
    return { defaultPrevented: impedido }
  }

  it('intercepta enlaces dentro de la base y deja pasar los de fuera', () => {
    state.navigate('/')
    expect(click('/app/y').defaultPrevented).toBe(true)
    expect(state.currentPath.get()).toBe('/y')
    expect(click('/fuera').defaultPrevented).toBe(false)
    expect(state.currentPath.get()).toBe('/y')
  })
})

describe('Link con base /app/', () => {
  it('el href lleva la base y el clic navega a la ruta de la app', async () => {
    const { Link } = await import('./Link.js')
    const a = Link({ to: '/tareas?x=1' }, 'Tareas')
    document.body.appendChild(a)
    expect(a.getAttribute('href')).toBe('/app/tareas?x=1')
    a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }))
    expect(state.currentPath.get()).toBe('/tareas')
    expect(location.pathname + location.search).toBe('/app/tareas?x=1')
  })
})
