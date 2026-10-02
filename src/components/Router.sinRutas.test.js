import { it, expect, vi } from 'vitest'
import { define, c } from './Component.js'
import { createRoot } from '@core/signal.js'
import { registerRoutes } from '@features/router/router.utils.js'

it('sin rutas registradas, la página explica cómo migrar (no un 404 a secas)', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  registerRoutes([]) // sin rutas, aunque otro test del mismo proceso las haya registrado
  define('Inicio', () => document.createElement('p'))
  await import('./Router.js')
  const root = document.createElement('div')
  createRoot(() => root.appendChild(c('Router')))
  await new Promise(r => setTimeout(r))
  expect(root.textContent).toContain('registerRoutes')
  expect(root.textContent).not.toContain('404')
})

it('si las rutas se registran después de montar el Router, se aplican sin esperar a navegar', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  registerRoutes([])
  define('Tarde', () => Object.assign(document.createElement('p'), { textContent: 'página:Tarde' }))
  await import('./Router.js')
  const root = document.createElement('div')
  createRoot(() => root.appendChild(c('Router')))
  await new Promise(r => setTimeout(r))
  expect(root.textContent).toContain('registerRoutes')
  registerRoutes([{ path: '/', component: 'Tarde' }])
  await new Promise(r => setTimeout(r))
  expect(root.textContent).toBe('página:Tarde')
})

it('llamar a registerRoutes dentro de un effect no provoca un bucle', async () => {
  const err = vi.spyOn(console, 'error').mockImplementation(() => {})
  const { effect } = await import('@core/signal.js')
  let ejecuciones = 0
  const dispose = effect(() => { ejecuciones++; registerRoutes([{ path: '/', component: 'Tarde' }]) })
  await new Promise(r => setTimeout(r))
  dispose()
  expect(ejecuciones).toBe(1)
  expect(err).not.toHaveBeenCalled()
})
