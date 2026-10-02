// @vitest-environment node
//
// Un guard de la app puede importar '@kit' y usarlo AL CARGARSE.
// Hasta la v1, el router importaba routes.config.js y eso creaba el ciclo
// routes.config → guard → '@kit' → router → routes.config. Desde la v2 las rutas se
// registran con registerRoutes(routes) en main.js y el ciclo no existe: este test lo
// comprueba de verdad, en un mini-proyecto temporal (vi.mock con una factoría asíncrona
// que importa '@kit' se bloquea), entrando por cuatro sitios, incluido el arranque de main.js.
import { it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const RAIZ = path.resolve('.')
const VITEST = path.join(RAIZ, 'node_modules/vitest/vitest.mjs')

// Exportaciones de '@kit' que NO son del router: deben estar listas al cerrarse el ciclo
const NO_ROUTER = [
  'signal', 'computed', 'effect', 'untrack', 'Batch', 'createRoot', 'onCleanup', 'getOwner', 'getStats',
  'resource', 'h', 'For', 'Show', 'fragment', 'text', 'define', 'c', 'render', 'renderApp', 'HttpClient', 'persist'
]

// Guard de la app que importa '@kit' y lo USA AL CARGARSE (el caso que rompe el orden)
const GUARD = `import * as kit from '@kit'

const faltan = ${JSON.stringify(NO_ROUTER)}.filter((nombre) => typeof kit[nombre] !== 'function')
if (faltan.length) throw new Error('Al cargar el guard aún no existen en @kit: ' + faltan.join(', '))

export const sesion = kit.signal(null)
kit.persist('sesion-ciclo', sesion)
export const requiereSesion = () => (sesion.get() ? true : '/login')
`

// routes.config.js fijo (el del proyecto puede tener otra forma u otros guards): mismas exportaciones
const RUTAS = `import { requiereSesion } from '@features/ciclo/guard.js'

export const routes = [
  { path: '/', component: 'InitialPage', name: 'initial' },
  { path: '/privada', component: 'InitialPage', name: 'privada', beforeEnter: requiereSesion }
]
export const getRouteByName = (name) => routes.find((route) => route.name === name)
export const generateUrl = () => '/'
`

// Un archivo por punto de entrada: cada archivo de Vitest tiene su propio grafo de módulos
const ENTRADAS = {
  'kit-primero': `import * as kit from '@kit'
import { sesion } from '@features/ciclo/guard.js'`,
  'router-primero': `import '@components/Router.js'
import * as kit from '@kit'
import { sesion } from '@features/ciclo/guard.js'`,
  'guard-primero': `import { sesion } from '@features/ciclo/guard.js'
import * as kit from '@kit'`,
  // Como main.js: se importan las rutas (y con ellas el guard) y se registran
  'como-main': `import * as kit from '@kit'
import { routes } from '@features/router/routes.config.js'
import { sesion } from '@features/ciclo/guard.js'
kit.registerRoutes(routes)`
}

const testDeEntrada = (imports) => `import { it, expect } from 'vitest'
${imports}

it('el guard carga y la API de @kit está completa', () => {
  expect(sesion.get()).toBeNull()
  expect(typeof kit.navigate).toBe('function')
  expect(typeof kit.registerRoutes).toBe('function')
})
`

const sinColores = (texto) => texto.replace(/\u001b\[[0-9;]*m/g, '')

it("un guard de routes.config puede importar '@kit' y usarlo al cargarse (sin ciclo de importación)", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ssk-ciclo-'))
  try {
    // Copia del proyecto sin sus tests (solo los archivos de configuración que existan)
    for (const archivo of ['package.json', 'vite.config.js', 'vitest.config.js', 'vitest.config.mjs', 'index.html']) {
      if (fs.existsSync(path.join(RAIZ, archivo))) fs.copyFileSync(path.join(RAIZ, archivo), path.join(dir, archivo))
    }
    fs.cpSync(path.join(RAIZ, 'src'), path.join(dir, 'src'), {
      recursive: true,
      filter: (origen) => !origen.endsWith('.test.js')
    })
    fs.symlinkSync(path.join(RAIZ, 'node_modules'), path.join(dir, 'node_modules'), 'junction') // 'junction': también en Windows

    // Guard real + routes.config fijo que lo usa
    fs.mkdirSync(path.join(dir, 'src/features/ciclo'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'src/features/ciclo/guard.js'), GUARD)
    fs.writeFileSync(path.join(dir, 'src/features/router/routes.config.js'), RUTAS)
    for (const [nombre, imports] of Object.entries(ENTRADAS)) {
      fs.writeFileSync(path.join(dir, `src/ciclo-${nombre}.test.js`), testDeEntrada(imports))
    }

    let salida = ''
    try {
      salida = execFileSync(process.execPath, [VITEST, 'run', 'src/ciclo-'], {
        cwd: dir,
        encoding: 'utf8',
        stdio: 'pipe',
        env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' }
      })
    } catch (error) {
      salida = `${error.stdout ?? ''}${error.stderr ?? ''}${error.stdout || error.stderr ? '' : error.message}`
    }
    salida = sinColores(salida)

    const ok = /Tests\s+4 passed \(4\)/.test(salida)
    expect(ok, [
      "Un guard que importa '@kit' y lo usa al cargarse ya no funciona: ¿ha vuelto el ciclo de importación?",
      'Comprueba que src/features/router/router.utils.js NO importe routes.config.js (las rutas se',
      'registran con registerRoutes(routes) en main.js) y que nada del router importe módulos de la app.',
      '--- salida del proyecto de prueba (últimas 40 líneas) ---',
      salida.trim().split('\n').slice(-40).join('\n')
    ].join('\n')).toBe(true)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}, 60_000)
