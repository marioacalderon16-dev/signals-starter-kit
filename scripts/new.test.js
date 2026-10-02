// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const SCRIPT = path.resolve('scripts/new.js')
// Tabla de rutas fija: el test no depende de las rutas que tenga tu proyecto
const ROUTES_FIXTURE = `import { url } from './router.base.js'

export const routes = [
  { 
    path: '/',
    component: 'InitialPage',
    name: 'initial'
  }
]

export function generateUrl(name) {
  return url(name)
}
`
let dir

const run = (...args) => {
  try {
    return { code: 0, out: execFileSync('node', [SCRIPT, ...args], { cwd: dir, encoding: 'utf8', stdio: 'pipe' }) }
  } catch (e) {
    return { code: e.status, out: `${e.stdout}${e.stderr}` }
  }
}
const leer = (p) => fs.readFileSync(path.join(dir, p), 'utf8')
const existe = (p) => fs.existsSync(path.join(dir, p))

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ssk-new-'))
  fs.mkdirSync(path.join(dir, 'src/features/router'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'src/features/router/routes.config.js'), ROUTES_FIXTURE)
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

describe('npm run new', () => {
  it('page: crea la página y registra la ruta con title', async () => {
    const r = run('page', 'Productos')
    expect(r.code).toBe(0)
    expect(leer('src/components/pages/ProductosPage.js')).toContain("define('ProductosPage'")
    const rutas = leer('src/features/router/routes.config.js')
    expect(rutas).toContain("{ path: '/productos', component: 'ProductosPage', name: 'productos', title: 'Productos' }")
    // el archivo sigue siendo JavaScript válido y la ruta queda dentro del array
    const mod = await import(`data:text/javascript,${encodeURIComponent(rutas.replace(/^import .*$/gm, '').replace('url(name)', 'name'))}`)
    expect(mod.routes.map(r => r.path)).toEqual(['/', '/productos'])
  })

  it('page --lazy: crea *.lazy.js y añade load', () => {
    expect(run('page', 'Admin', '--lazy').code).toBe(0)
    expect(existe('src/components/pages/AdminPage.lazy.js')).toBe(true)
    expect(leer('src/features/router/routes.config.js'))
      .toContain("load: () => import('@components/pages/AdminPage.lazy.js')")
  })

  it('page con --path propio y nombre compuesto', () => {
    expect(run('page', 'MisPedidos', '--path', '/cuenta/pedidos').code).toBe(0)
    expect(leer('src/features/router/routes.config.js'))
      .toContain("{ path: '/cuenta/pedidos', component: 'MisPedidosPage', name: 'mis-pedidos', title: 'Mis pedidos' }")
  })

  it('component: crea el componente y su test', () => {
    expect(run('component', 'TarjetaProducto').code).toBe(0)
    expect(leer('src/components/tarjeta-producto/TarjetaProducto.js')).toContain("define('TarjetaProducto'")
    expect(leer('src/components/tarjeta-producto/TarjetaProducto.test.js')).toContain("c('TarjetaProducto'")
  })

  it('feature: crea el estado y su test', () => {
    expect(run('feature', 'carrito').code).toBe(0)
    expect(leer('src/features/carrito/carrito.state.js')).toContain('export const')
    expect(leer('src/features/carrito/carrito.test.js')).toContain("from './carrito.state.js'")
  })

  it('no sobrescribe archivos existentes ni duplica rutas', () => {
    run('page', 'Productos')
    const r = run('page', 'Productos')
    expect(r.code).not.toBe(0)
    expect(r.out).toMatch(/ya existe/)
    expect(leer('src/features/router/routes.config.js').match(/ProductosPage/g).length).toBe(1)
  })

  it('valida el tipo y el nombre, y muestra ayuda', () => {
    expect(run().out).toMatch(/Uso:/)
    expect(run('pagina', 'X').code).not.toBe(0)
    expect(run('page', '123abc').code).not.toBe(0)
    expect(run('page', 'mal nombre').code).not.toBe(0)
  })
})
