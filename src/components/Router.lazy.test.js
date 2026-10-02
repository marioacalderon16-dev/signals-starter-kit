import { describe, it, expect, vi, beforeAll } from 'vitest'
import { define, c } from './Component.js'
import { createRoot, getStats } from '@core/signal.js'
import { navigate } from '@features/router/router.state.js'

const defineP = (name) => define(name, () => Object.assign(document.createElement('p'), { textContent: `página:${name}` }))
const espera = (ms) => new Promise(r => setTimeout(r, ms))

const cargas = vi.hoisted(() => ({ perezosa: 0 }))

vi.mock('@features/router/routes.config.js', () => ({
  routes: [
    { path: '/', component: 'Inicio', name: 'inicio' },
    {
      path: '/perezosa', component: 'Perezosa', name: 'perezosa',
      load: async () => { cargas.perezosa++; await espera(20); defineP('Perezosa') }
    },
    {
      path: '/lenta', component: 'Lenta', name: 'lenta',
      load: async () => { await espera(60); defineP('Lenta') }
    },
    {
      path: '/unica', component: 'Unica', name: 'unica',
      load: async () => { await espera(40); defineP('Unica') }
    },
    {
      path: '/rota', component: 'Rota', name: 'rota',
      load: () => Promise.reject(new Error('chunk no encontrado'))
    },
  ]
}))

let root

beforeAll(async () => {
  defineP('Inicio')
  await import('./Router.js')
  root = document.createElement('div')
  createRoot(() => root.appendChild(c('Router')))
})

describe('Router: rutas con carga diferida (load)', () => {
  it('muestra "Cargando…" y luego la página; la segunda visita no vuelve a cargar', async () => {
    navigate('/perezosa')
    await espera(0)
    expect(root.textContent).toBe('Cargando…')
    await espera(40)
    expect(root.textContent).toBe('página:Perezosa')

    navigate('/')
    await espera(0)
    navigate('/perezosa')
    await espera(0)
    expect(root.textContent).toBe('página:Perezosa')
    expect(cargas.perezosa).toBe(1)
  })

  it('si se navega a otra ruta durante la carga, el resultado se descarta', async () => {
    navigate('/lenta')
    await espera(0)
    navigate('/')
    await espera(100)
    expect(root.textContent).toBe('página:Inicio')
  })

  it('si la carga falla, muestra un error', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    navigate('/rota')
    await espera(10)
    expect(root.textContent).toBe('Error al cargar la página')
    expect(err).toHaveBeenCalled()
    err.mockRestore()
    navigate('/')
    await espera(0)
    expect(root.textContent).toBe('página:Inicio')
  })
})

describe('regresiones R1 (Router.lazy)', () => {
  it('si el Router se desmonta durante una carga diferida, no monta nada después', async () => {
    navigate('/')
    await espera(0)
    let dispose
    const otro = document.createElement('div')
    createRoot(d => { dispose = d; otro.appendChild(c('Router')) })
    navigate('/unica')                       // empieza a cargar (40 ms; nunca cargada antes)
    await espera(0)
    const vivos = getStats().effects
    dispose()                               // se desmonta antes de que termine
    await espera(100)
    expect(otro.textContent).not.toContain('página:Unica')
    expect(getStats().effects).toBeLessThan(vivos)
  })
})
