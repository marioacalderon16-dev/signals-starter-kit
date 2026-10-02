import { describe, it, expect, vi, beforeAll } from 'vitest'
import { define, c } from './Component.js'
import { createRoot, getStats } from '@core/signal.js'
import { navigate } from '@features/router/router.state.js'
import { registerRoutes } from '@features/router/router.utils.js'

const defineP = (name) => define(name, () => Object.assign(document.createElement('p'), { textContent: `página:${name}` }))

// Cada load() devuelve una promesa que el test resuelve o rechaza a mano: sin esperas reales
const cargas = vi.hoisted(() => {
  const pendientes = {}
  const contador = {}
  const diferida = (nombre) => () => {
    contador[nombre] = (contador[nombre] ?? 0) + 1
    return new Promise((resolve, reject) => { pendientes[nombre] = { resolve, reject } })
  }
  return { pendientes, contador, diferida }
})

// Rutas de prueba: desde la v2 se registran con registerRoutes (el router ya no importa routes.config.js)
const routes = [
    { path: '/', component: 'Inicio', name: 'inicio' },
    { path: '/perezosa', component: 'Perezosa', name: 'perezosa', load: cargas.diferida('Perezosa') },
    { path: '/lenta', component: 'Lenta', name: 'lenta', load: cargas.diferida('Lenta') },
    { path: '/unica', component: 'Unica', name: 'unica', load: cargas.diferida('Unica') },
    { path: '/rota', component: 'Rota', name: 'rota', load: cargas.diferida('Rota') },
    { path: '/rota-lenta', component: 'RotaLenta', name: 'rota-lenta', load: cargas.diferida('RotaLenta') },
]
registerRoutes(routes)

// Deja correr las microtasks (effects del router y callbacks de las promesas)
const microtasks = async () => { for (let i = 0; i < 10; i++) await Promise.resolve() }
const terminar = async (nombre) => { defineP(nombre); cargas.pendientes[nombre].resolve(); await microtasks() }
const fallar = async (nombre) => { cargas.pendientes[nombre].reject(new Error('chunk no encontrado')); await microtasks() }

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
    await microtasks()
    expect(root.textContent).toBe('Cargando…')
    await terminar('Perezosa')
    expect(root.textContent).toBe('página:Perezosa')

    navigate('/')
    await microtasks()
    navigate('/perezosa')
    await microtasks()
    expect(root.textContent).toBe('página:Perezosa')
    expect(cargas.contador.Perezosa).toBe(1)
  })

  it('si se navega a otra ruta durante la carga, el resultado se descarta', async () => {
    navigate('/lenta')
    await microtasks()
    navigate('/')
    await microtasks()
    await terminar('Lenta') // la carga termina tarde
    expect(root.textContent).toBe('página:Inicio')
  })

  it('si la carga falla, muestra un error', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    navigate('/rota')
    await microtasks()
    await fallar('Rota')
    expect(root.textContent).toBe('Error al cargar la página')
    expect(err).toHaveBeenCalled()
    navigate('/')
    await microtasks()
    expect(root.textContent).toBe('página:Inicio')
  })

  it('un error de una carga obsoleta (ya se navegó a otra ruta) se descarta sin mostrar ni registrar nada', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    navigate('/rota-lenta')
    await microtasks()
    navigate('/')
    await microtasks()
    await fallar('RotaLenta')
    expect(root.textContent).toBe('página:Inicio')
    expect(err).not.toHaveBeenCalled()
  })
})

describe('regresiones R1 (Router.lazy)', () => {
  it('si el Router se desmonta durante una carga diferida, no monta nada después', async () => {
    navigate('/')
    await microtasks()
    let dispose
    const otro = document.createElement('div')
    createRoot(d => { dispose = d; otro.appendChild(c('Router')) })
    navigate('/unica')                       // empieza a cargar (nunca cargada antes)
    await microtasks()
    const vivos = getStats().effects
    dispose()                               // se desmonta antes de que termine
    await terminar('Unica')
    expect(otro.textContent).not.toContain('página:Unica')
    expect(getStats().effects).toBeLessThan(vivos)
  })
})
