import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { define, c } from './Component.js'
import { h } from '@features/dom/dom.js'
import { createRoot } from '@core/signal.js'
import { navigate } from '@features/router/router.state.js'

vi.mock('@features/router/routes.config.js', () => ({
  routes: [
    { path: '/', component: 'Inicio' },
    { path: '/acerca', component: 'Acerca', title: 'Acerca de' },
    { path: '/p/:id', component: 'Producto', title: ({ params }) => `Producto ${params.id}`, layout: 'Marco' },
    { path: '/lista', component: 'Lista', title: 'Lista', layout: 'Marco' },
    { path: '/rapida', component: 'Rapida', transition: false },
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
  define('Producto', ({ params }) => h('p', {}, `producto:${params.id}`))
  define('Marco', ({ contenido, title }) => {
    montajesMarco++
    return h('section', { className: 'marco' }, h('h1', {}, title), contenido)
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
    const pendientes = []
    document.startViewTransition = vi.fn(cb => { pendientes.push(cb); return {} })
    navigate('/acerca'); await settle()
    navigate('/lista'); await settle()
    pendientes.forEach(cb => cb())
    await settle()
    expect(root.textContent).toBe('Listapágina:Lista')
  })
})
