import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { define, c } from './Component.js'
import { h } from '@features/dom/dom.js'
import { createRoot } from '@core/signal.js'
import { navigate } from '@features/router/router.state.js'

const cargaDiferida = vi.hoisted(() => ({ resolver: null }))

vi.mock('@features/router/routes.config.js', () => ({
  routes: [
    { path: '/', component: 'Inicio' },
    { path: '/acerca', component: 'Acerca', title: 'Acerca de' },
    { path: '/p/:id', component: 'Producto', title: ({ params }) => `Producto ${params.id}`, layout: 'Marco' },
    { path: '/lista', component: 'Lista', title: 'Lista', layout: 'Marco' },
    { path: '/rapida', component: 'Rapida', transition: false },
    { path: '/buscar', component: 'Acerca', title: ({ query }) => `Buscar: ${query.q ?? ''}` },
    { path: '/rota', component: 'Rota', title: () => { throw new Error('título roto') } },
    { path: '/diferida', component: 'Diferida', title: 'Diferida', layout: 'Marco', load: () => new Promise(r => { cargaDiferida.resolver = r }) },
  ]
}))

const settle = async () => { for (let i = 0; i < 10; i++) await new Promise(r => setTimeout(r)) }
const p = (name) => () => h('p', {}, `página:${name}`)
let root, montajesMarco = 0

beforeAll(async () => {
  define('Inicio', p('Inicio'))
  define('Acerca', p('Acerca'))
  define('Lista', p('Lista'))
  define('Rapida', p('Rapida'))
  define('Rota', p('Rota'))
  define('Producto', ({ params }) => h('p', {}, `producto:${params.id}`))
  define('Marco', ({ content, title }) => {
    montajesMarco++
    return h('section', { className: 'marco' }, h('h1', {}, title), content)
  })
  await import('./Router.js')
  root = document.createElement('div')
  createRoot(() => root.appendChild(c('Router')))
})

afterEach(() => { delete document.startViewTransition; delete window.matchMedia })

describe('Router: title', () => {
  it('pone el título de la ruta (texto o función) y restaura el de la app sin título', async () => {
    navigate('/acerca'); await settle()
    expect(document.title).toBe('Acerca de · signals-starter-kit')
    navigate('/p/7'); await settle()
    expect(document.title).toBe('Producto 7 · signals-starter-kit')
    navigate('/'); await settle()
    expect(document.title).toBe('signals-starter-kit')
  })
})

describe('Router: layout', () => {
  it('envuelve la página y no se vuelve a montar entre rutas con el mismo layout', async () => {
    navigate('/'); await settle()
    montajesMarco = 0
    navigate('/p/1'); await settle()
    const marco = root.querySelector('.marco')
    expect(marco.textContent).toBe('Producto 1producto:1')
    navigate('/p/2'); await settle()
    navigate('/lista'); await settle()
    expect(root.querySelector('.marco')).toBe(marco) // mismo nodo
    expect(montajesMarco).toBe(1)
    expect(marco.textContent).toBe('Listapágina:Lista') // el título del layout es reactivo
  })

  it('al ir a una ruta sin layout, el layout desaparece', async () => {
    navigate('/lista'); await settle()
    navigate('/acerca'); await settle()
    expect(root.querySelector('.marco')).toBeNull()
    expect(root.textContent).toBe('página:Acerca')
  })
})

describe('Router: View Transitions', () => {
  const simular = () => {
    const vt = vi.fn(cb => { cb(); return {} })
    document.startViewTransition = vt
    return vt
  }

  it('envuelve el cambio de página en startViewTransition si existe', async () => {
    navigate('/'); await settle()
    const vt = simular()
    navigate('/acerca'); await settle()
    expect(vt).toHaveBeenCalledTimes(1)
    expect(root.textContent).toBe('página:Acerca')
  })

  it('no la usa al cambiar solo los params, con transition: false ni con prefers-reduced-motion', async () => {
    navigate('/p/1'); await settle()
    const vt = simular()
    navigate('/p/2'); await settle()
    navigate('/rapida'); await settle()
    expect(vt).not.toHaveBeenCalled()
    window.matchMedia = () => ({ matches: true })
    navigate('/acerca'); await settle()
    expect(vt).not.toHaveBeenCalled()
    expect(root.textContent).toBe('página:Acerca')
  })

  it('si llega otra navegación antes del callback, se queda la última', async () => {
    navigate('/'); await settle()
    const montajesAcerca = vi.fn(p('Acerca'))
    define('Acerca', montajesAcerca)
    const pendientes = []
    document.startViewTransition = vi.fn(cb => { pendientes.push(cb); return {} })
    navigate('/acerca'); await settle()
    navigate('/lista'); await settle()
    pendientes.forEach(cb => cb())
    await settle()
    expect(root.textContent).toBe('Listapágina:Lista')
    expect(montajesAcerca).not.toHaveBeenCalled() // la transición obsoleta se descartó
    define('Acerca', p('Acerca'))
  })
})

describe('regresiones R1 (Router.h2)', () => {
  it('un title que lanza no deja la página anterior: se muestra la nueva y se registra el error', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    navigate('/acerca'); await settle()
    navigate('/rota'); await settle()
    expect(root.textContent).toBe('página:Rota')
    expect(document.title).toBe('signals-starter-kit')
    expect(err).toHaveBeenCalled()
    err.mockRestore()
  })

  it('"Cargando…" de una ruta diferida con el mismo layout no desmonta el layout', async () => {
    navigate('/lista'); await settle()
    const marco = root.querySelector('.marco')
    navigate('/diferida'); await settle()
    expect(root.querySelector('.marco')).toBe(marco)
    expect(marco.textContent).toBe('DiferidaCargando…') // el título ya es el de la ruta que carga
    expect(document.title).toBe('Diferida · signals-starter-kit')
    define('Diferida', () => h('p', {}, 'página:Diferida'))
    cargaDiferida.resolver() // la carga termina cuando el test quiere
    await settle()
    expect(root.querySelector('.marco')).toBe(marco)
    expect(marco.textContent).toBe('Diferidapágina:Diferida')
  })
})

describe('cobertura R2 (title)', () => {
  it('title puede usar la query', async () => {
    navigate('/buscar?q=phone'); await settle()
    expect(document.title).toBe('Buscar: phone · signals-starter-kit')
  })
})

describe('API en inglés (R3)', () => {
  it('el layout recibe content (alias contenido) y se aplica aunque el componente sea el mismo', async () => {
    let props
    define('MarcoIngles', (p) => { props = p; return h('section', {}, p.content) })
    const { routes } = await import('@features/router/routes.config.js')
    routes.push({ path: '/en', component: 'Acerca', layout: 'MarcoIngles' })
    navigate('/buscar'); await settle() // mismo componente (Acerca) sin layout…
    navigate('/en'); await settle()     // …y ahora con layout: el layout debe aplicarse
    expect(props.content).toBeInstanceOf(Node)
    expect(props.contenido).toBe(props.content)
    expect(root.textContent).toBe('página:Acerca')
  })
})
