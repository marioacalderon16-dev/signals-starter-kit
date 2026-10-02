import { describe, it, expect, beforeAll } from 'vitest'
import '@components/index.js'
import { renderApp } from '@components/Component.js'
import { registerRoutes } from '@features/router/router.utils.js'
import { routes } from '@features/router/routes.config.js'
import { navigate } from '@features/router/router.state.js'
import { temperatura, cargando } from '@features/weather/weather.state.js'

registerRoutes(routes) // como en main.js

const tick = () => new Promise(r => setTimeout(r))

describe('Router', () => {
  let root

  beforeAll(() => {
    root = document.createElement('div')
    renderApp('App', root)
  })

  it('renderiza la ruta inicial', () => {
    expect(root.textContent).toContain('Fusagasuga')
  })

  it('la ruta inicial es la presentación con las demos del contador y del clima', () => {
    expect(root.querySelector('h1').textContent).toContain('signals-starter-kit')
    expect(root.textContent).toContain('npx degit marioacalderon16-dev/signals-starter-kit mi-app')
    const botones = [...root.querySelectorAll('button')].map(b => b.textContent)
    expect(botones).toContain('Actualizar') // demo del clima (WeatherCard)
    expect(botones).toContain('Reiniciar')  // ejemplo básico (Contador)
  })

  it('muestra 404 en una ruta desconocida y lo quita al volver', async () => {
    navigate('/no-existe')
    await tick()
    expect(root.textContent).toContain('404')
    navigate('/')
    await tick()
    expect(root.textContent).not.toContain('404')
    expect(root.textContent).toContain('Fusagasuga')
  })

  it('al cambiar de ruta libera los effects de la página (sin fugas acumuladas)', async () => {
    const montada = temperatura.subs.size
    expect(montada).toBeGreaterThan(0)
    navigate('/no-existe')
    await tick()
    expect(temperatura.subs.size).toBe(0)
    expect(cargando.subs.size).toBe(0)
    navigate('/')
    await tick()
    expect(temperatura.subs.size).toBe(montada)
  })
})
