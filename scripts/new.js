#!/usr/bin/env node
// scripts/new.js
// Generador de código del kit: páginas, componentes y features siguiendo las convenciones.
//
//   npm run new page Productos                → página + ruta /productos
//   npm run new -- page Admin --lazy          → página diferida (*.lazy.js + load)
//   npm run new -- page MisPedidos --path /cuenta/pedidos
//   npm run new component TarjetaProducto     → componente + test
//   npm run new feature carrito               → estado + test
//
// Nunca sobrescribe archivos existentes. (Las opciones con -- necesitan el `--` de npm.)

import fs from 'node:fs'
import path from 'node:path'

const AYUDA = `Uso:
  npm run new page <Nombre>             Página en src/components/pages/ y su ruta
  npm run new -- page <Nombre> --lazy   Página diferida (*.lazy.js + load en la ruta)
  npm run new -- page <Nombre> --path /ruta/propia
  npm run new component <Nombre>        Componente y su test
  npm run new feature <nombre>          Estado (features/<nombre>/) y su test`

const ROUTES = 'src/features/router/routes.config.js'

// - Utilidades de nombres -
const pascal = (s) => s.charAt(0).toUpperCase() + s.slice(1)
const camel = (s) => s.charAt(0).toLowerCase() + s.slice(1)
const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
const palabras = (s) => kebab(s).split('-')
const titulo = (s) => { const p = palabras(s); return [pascal(p[0]), ...p.slice(1)].join(' ') }

const fallar = (mensaje) => {
  console.error(`✖ ${mensaje}`)
  process.exit(1)
}

// Comprueba todo antes de escribir nada: o se crea todo, o nada
const comprobarLibres = (...rutas) => {
  for (const ruta of rutas) if (fs.existsSync(ruta)) fallar(`${ruta} ya existe: no se sobrescribe`)
}

const comprobarRutaLibre = (componente) => {
  if (!fs.existsSync(ROUTES)) fallar(`no se encontró ${ROUTES}`)
  if (fs.readFileSync(ROUTES, 'utf8').includes(`'${componente}'`)) fallar(`la ruta de ${componente} ya existe en ${ROUTES}`)
}

const escribir = (ruta, contenido) => {
  fs.mkdirSync(path.dirname(ruta), { recursive: true })
  fs.writeFileSync(ruta, contenido)
  console.log(`✔ creado ${ruta}`)
}

// Añade una entrada al final del array `routes` de routes.config.js
const registrarRuta = (entrada) => {
  const codigo = fs.readFileSync(ROUTES, 'utf8')

  const inicio = codigo.indexOf('export const routes = [')
  const fin = inicio === -1 ? -1 : codigo.indexOf('\n]', inicio)
  if (fin === -1) fallar(`no se encontró el array "export const routes = [ … ]" en ${ROUTES}`)

  let antes = codigo.slice(0, fin).trimEnd()
  if (!antes.endsWith(',') && !antes.endsWith('[')) antes += ','
  fs.writeFileSync(ROUTES, `${antes}\n  ${entrada}${codigo.slice(fin)}`)
  console.log(`✔ ruta registrada en ${ROUTES}`)
}

// - Plantillas -
const plantillaPagina = (Nombre, texto) => `/**
 * Página ${texto}
 */

import { define, h } from '@kit'

define('${Nombre}', ({ params }) =>
  h('main', { className: 'mx-auto max-w-3xl space-y-4 p-6' },
    h('h1', { className: 'text-2xl font-bold text-slate-900' }, '${texto}'),
    h('p', { className: 'text-slate-500' }, 'Edita este archivo para empezar.')
  )
)
`

const plantillaComponente = (Nombre) => `/**
 * Componente ${Nombre}
 */

import { define, h } from '@kit'

define('${Nombre}', (props = {}) =>
  h('div', { className: 'rounded-xl bg-white p-4 shadow ring-1 ring-slate-200' },
    props.children ?? '${Nombre}'
  )
)
`

const plantillaTestComponente = (Nombre) => `import { describe, it, expect } from 'vitest'
import { c } from '@kit'
import './${Nombre}.js'

describe('${Nombre}', () => {
  it('se renderiza', () => {
    const el = c('${Nombre}')
    expect(el.textContent).toContain('${Nombre}')
  })
})
`

const plantillaFeature = (nombre) => `/**
 * Estado y acciones de ${nombre}
 */

// Del núcleo y no de '@kit': un estado puede acabar importado por un guard de routes.config
import { signal, computed } from '@core/signal.js'

// - Estado -
export const ${nombre} = signal([])

// - Derivados -
export const total${pascal(nombre)} = computed(() => ${nombre}.get().length)

// - Acciones (siempre un valor nuevo: set() ignora el mismo objeto) -
export const agregar = (item) => ${nombre}.set([...${nombre}.get(), item])
export const vaciar = () => ${nombre}.set([])
`

const plantillaTestFeature = (nombre) => `import { describe, it, expect, beforeEach } from 'vitest'
import { ${nombre}, total${pascal(nombre)}, agregar, vaciar } from './${nombre}.state.js'

describe('${nombre}', () => {
  beforeEach(() => vaciar())

  it('agregar actualiza el total', () => {
    agregar({ id: 1 })
    expect(total${pascal(nombre)}.get()).toBe(1)
    expect(${nombre}.get()).toEqual([{ id: 1 }])
  })
})
`

// - Comandos -
const [tipo, nombreBruto, ...resto] = process.argv.slice(2)
const opcion = (flag) => {
  const i = resto.indexOf(flag)
  return i === -1 ? undefined : resto[i + 1] ?? true
}

if (!tipo || tipo === '--help' || tipo === '-h') {
  console.log(AYUDA)
  process.exit(tipo ? 0 : 1)
}
if (!['page', 'component', 'feature'].includes(tipo)) fallar(`tipo desconocido "${tipo}"\n\n${AYUDA}`)
if (!nombreBruto || !/^[A-Za-z][A-Za-z0-9]*$/.test(nombreBruto)) {
  fallar(`nombre no válido "${nombreBruto ?? ''}": usa letras y números, empezando por letra (ej. Productos)`)
}

if (tipo === 'page') {
  const base = pascal(nombreBruto).replace(/Page$/, '')
  const Nombre = `${base}Page`
  const lazy = resto.includes('--lazy')
  const ruta = opcion('--path') ?? `/${kebab(base)}`
  if (typeof ruta !== 'string' || !ruta.startsWith('/')) fallar('--path debe empezar por "/"')

  const archivo = `src/components/pages/${Nombre}${lazy ? '.lazy' : ''}.js`
  comprobarLibres(archivo, `src/components/pages/${Nombre}${lazy ? '' : '.lazy'}.js`)
  comprobarRutaLibre(Nombre)
  escribir(archivo, plantillaPagina(Nombre, titulo(base)))
  const load = lazy ? `, load: () => import('@components/pages/${Nombre}.lazy.js')` : ''
  registrarRuta(`{ path: '${ruta}', component: '${Nombre}', name: '${kebab(base)}', title: '${titulo(base)}'${load} }`)
  console.log(`\nAbre http://localhost:4321${ruta}`)
}

if (tipo === 'component') {
  const Nombre = pascal(nombreBruto)
  const carpeta = `src/components/${kebab(Nombre)}`
  comprobarLibres(`${carpeta}/${Nombre}.js`, `${carpeta}/${Nombre}.test.js`)
  escribir(`${carpeta}/${Nombre}.js`, plantillaComponente(Nombre))
  escribir(`${carpeta}/${Nombre}.test.js`, plantillaTestComponente(Nombre))
  console.log(`\nÚsalo con c('${Nombre}') (se registra solo)`)
}

if (tipo === 'feature') {
  const nombre = camel(nombreBruto)
  const carpeta = `src/features/${kebab(nombre)}`
  comprobarLibres(`${carpeta}/${kebab(nombre)}.state.js`, `${carpeta}/${kebab(nombre)}.test.js`)
  escribir(`${carpeta}/${kebab(nombre)}.state.js`, plantillaFeature(nombre))
  escribir(`${carpeta}/${kebab(nombre)}.test.js`, plantillaTestFeature(nombre).replace(`./${nombre}.state.js`, `./${kebab(nombre)}.state.js`))
}
