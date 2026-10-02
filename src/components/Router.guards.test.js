import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { define, c } from './Component.js'
import { signal, createRoot } from '@core/signal.js'
import { navigate, currentPath } from '@features/router/router.state.js'
import { registerRoutes } from '@features/router/router.utils.js'

const sesion = signal(null)

// Rutas de prueba: desde la v2 se registran con registerRoutes (el router ya no importa routes.config.js)
const routes = [
    { path: '/', component: 'Inicio', name: 'inicio' },
    { path: '/vieja', redirect: '/nueva' },
    { path: '/usuario/:id', redirect: ({ params }) => `/perfil/${params.id}` },
    { path: '/perfil/:id', component: 'Perfil', name: 'perfil' },
    { path: '/nueva', component: 'Nueva', name: 'nueva' },
    { path: '/login', component: 'Login', name: 'login' },
    {
      path: '/admin',
      component: 'Admin',
      name: 'admin',
      beforeEnter: ({ path, query }) => (sesion.get() ? true : `/login?volver=${path}${query.tab ? `&tab=${query.tab}` : ''}`)
    },
    { path: '/a-si-misma', component: 'Nueva', name: 'mismo', beforeEnter: () => '/a-si-misma/' },
    { path: '/bucle-a', redirect: '/bucle-b' },
    { path: '/bucle-b', redirect: '/bucle-a' },
]
registerRoutes(routes)

const tick = () => new Promise(r => setTimeout(r))
const settle = async () => { for (let i = 0; i < 15; i++) await tick() }

let root

beforeAll(async () => {
  for (const name of ['Inicio', 'Nueva', 'Login', 'Admin']) {
    define(name, () => Object.assign(document.createElement('p'), { textContent: `página:${name}` }))
  }
  define('Perfil', ({ params }) => Object.assign(document.createElement('p'), { textContent: `perfil:${params.id}` }))
  await import('./Router.js')
  root = document.createElement('div')
  createRoot(() => root.appendChild(c('Router')))
})

describe('Router: redirect y beforeEnter', () => {
  beforeEach(async () => { navigate('/'); await settle() }) // independiente del orden de los tests

  it('redirect con texto reemplaza la ruta (sin entrada extra en el historial)', async () => {
    navigate('/')
    const largo = history.length
    navigate('/vieja')
    await settle()
    expect(root.textContent).toBe('página:Nueva')
    expect(location.pathname).toBe('/nueva')
    expect(history.length).toBe(largo + 1) // solo la entrada de /vieja, reemplazada por /nueva
  })

  it('redirect con función recibe los params', async () => {
    navigate('/usuario/42')
    await settle()
    expect(root.textContent).toBe('perfil:42')
    expect(currentPath.get()).toBe('/perfil/42')
  })

  it('beforeEnter redirige si no hay sesión y deja pasar si la hay', async () => {
    sesion.set(null)
    navigate('/admin?tab=ventas')
    await settle()
    expect(root.textContent).toBe('página:Login')
    expect(location.pathname + location.search).toBe('/login?volver=/admin&tab=ventas')

    sesion.set({ usuario: 'ana' })
    navigate('/admin')
    await settle()
    expect(root.textContent).toBe('página:Admin')
  })

  it('cambiar la sesión no re-ejecuta el guard ni re-renderiza la página', async () => {
    sesion.set({ usuario: 'ana' })
    navigate('/admin')
    await settle()
    const nodo = root.firstChild.firstChild
    sesion.set({ usuario: 'luis' })
    await settle()
    expect(root.firstChild.firstChild).toBe(nodo)
  })

  it('un guard que redirige a la misma ruta avisa y muestra la página', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    navigate('/a-si-misma')
    await settle()
    expect(root.textContent).toBe('página:Nueva')
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('corta los bucles de redirección', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    navigate('/bucle-a')
    await settle()
    expect(root.textContent).toContain('Demasiadas redirecciones')
    expect(err).toHaveBeenCalled()
    err.mockRestore()
    navigate('/vieja') // justo después del bucle: el contador se reinició y una redirección normal funciona
    await settle()
    expect(root.textContent).toBe('página:Nueva')
    navigate('/')
    await settle()
    expect(root.textContent).toBe('página:Inicio')
  })
})

describe('cobertura R2 (guards)', () => {
  it('muchas navegaciones válidas con una redirección cada una no cuentan como bucle', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    for (let i = 0; i < 12; i++) {
      navigate('/vieja')
      await settle()
      expect(root.textContent).toBe('página:Nueva')
    }
    expect(err).not.toHaveBeenCalled()
  })
})
