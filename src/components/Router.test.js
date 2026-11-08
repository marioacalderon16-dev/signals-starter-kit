import { describe, it, expect, beforeAll } from 'vitest'
import { define, renderApp } from '@components/Component.js'
import '@components/index.js'
import { h } from '@features/dom/dom.js'
import { signal } from '@core/signal.js'
import { registerRoutes } from '@features/router/router.utils.js'
import { navigate } from '@features/router/router.state.js'

// Rutas propias: el test no depende de routes.config.js ni de las páginas de la app
const lectura = signal('hola')
define('PaginaInicioTest', () => h('main', {}, h('h1', {}, 'inicio'), h('p', {}, lectura)))
registerRoutes([{ path: '/', component: 'PaginaInicioTest' }])

const tick = () => new Promise(r => setTimeout(r))

describe('Router', () => {
  let root

  beforeAll(() => {
    root = document.createElement('div')
    renderApp('App', root)
  })

  it('renderiza la ruta inicial', () => {
    expect(root.querySelector('h1').textContent).toBe('inicio')
    expect(root.textContent).toContain('hola')
  })

  it('muestra 404 en una ruta desconocida y lo quita al volver', async () => {
    navigate('/no-existe')
    await tick()
    expect(root.textContent).toContain('404')
    navigate('/')
    await tick()
    expect(root.textContent).not.toContain('404')
    expect(root.textContent).toContain('inicio')
  })

  it('al cambiar de ruta libera los effects de la página (sin fugas acumuladas)', async () => {
    const montada = lectura.subs.size
    expect(montada).toBeGreaterThan(0)
    navigate('/no-existe')
    await tick()
    expect(lectura.subs.size).toBe(0)
    navigate('/')
    await tick()
    expect(lectura.subs.size).toBe(montada)
  })
})
