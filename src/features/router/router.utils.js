// src/features/router/router.utils.js
// Utilidades para el router (matching de rutas)

import { signal, untrack } from '@core/signal.js'

// v2: el router NO importa routes.config.js (eso creaba un ciclo de importación con los
// guards de la app). Las rutas se registran desde main.js con registerRoutes(routes).
let routes = []
let avisado = false
// Cambia en cada registerRoutes: matchRoute lo lee, así el Router se vuelve a evaluar
// si las rutas se registran (o reemplazan) después de montarlo
const versionRutas = signal(0)

/**
 * Registra la tabla de rutas de la app. Se llama una vez en main.js, antes de renderApp:
 *   import { routes } from '@features/router/routes.config.js'
 *   registerRoutes(routes)
 * Guarda la referencia al array (no una copia): añadir rutas con push después también cuenta,
 * pero solo se reevalúa la ruta actual al volver a llamar a registerRoutes o al navegar.
 * @param {Array} tablaDeRutas - Array de rutas ({ path, component, … })
 * @throws {TypeError} si no es un array
 */
export function registerRoutes(tablaDeRutas) {
  if (!Array.isArray(tablaDeRutas)) {
    throw new TypeError('registerRoutes(routes) necesita el array de rutas de routes.config.js')
  }
  routes = tablaDeRutas
  avisado = false // si vuelve a quedarse sin rutas, el aviso vuelve a salir
  versionRutas.set(untrack(() => versionRutas.get()) + 1) // untrack: llamarlo desde un effect no crea un bucle
}

/** ¿Se ha registrado alguna ruta? (el Router lo usa para explicar la migración a la v2) */
export const hasRoutes = () => routes.length > 0

/**
 * Encuentra la ruta que coincide con el path actual y extrae los parámetros.
 * @param {string} path - La ruta actual (ej. '/products/1')
 * @returns {Object|null} - Un objeto con el componente y los parámetros, o null.
 */
export function matchRoute(path) {
  versionRutas.get() // dependencia reactiva: registrar rutas reevalúa el Router
  if (routes.length === 0 && !avisado) {
    avisado = true
    console.warn('[ROUTER] No hay rutas registradas. Desde la v2, añade en src/main.js (antes de renderApp):\n' +
      "  import { routes } from '@features/router/routes.config.js'\n" +
      '  registerRoutes(routes)')
  }
  for (const route of routes) {
    const { regex, paramNames } = compileRoute(route.path)
    const match = path.match(regex)

    if (match) {
      // Extraer los parámetros capturados
      const params = paramNames.reduce((acc, name, index) => {
        acc[name] = safeDecode(match[index + 1]) // El primer match es la URL completa
        return acc
      }, {})

      return { 
        component: route.component, 
        params,
        name: route.name,
        route // definición completa (redirect, beforeEnter, load…)
      }
    }
  }

  return null
}

// Decodifica un segmento de URL ('caf%C3%A9' → 'café'); si el % está mal formado, lo deja tal cual
function safeDecode(value) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

// Cache de rutas compiladas: el regex se construye una sola vez por path
const compiledRoutes = new Map()

/**
 * Convierte un path de ruta (ej. '/products/:id', '/files/*') en un regex.
 * Escapa los caracteres especiales; ':param' captura un segmento y '*' cualquier cosa.
 */
function compileRoute(routePath) {
  let compiled = compiledRoutes.get(routePath)
  if (compiled) return compiled

  const paramNames = []
  const regexPath = routePath
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // '.' y demás especiales son literales
    .replace(/:(\w+)/g, (_, paramName) => {
      paramNames.push(paramName)
      return '([^\\/]+)' // Captura cualquier cosa que no sea una barra
    })
    .replace(/\*/g, '(?:.*)') // Wildcard sin captura: no desplaza el índice de los params

  compiled = { regex: new RegExp(`^${regexPath}$`), paramNames }
  compiledRoutes.set(routePath, compiled)
  return compiled
}

/**
 * Extrae query params de una URL.
 * @param {string} url - La URL (ej. '/products?category=frutas&sort=asc')
 * @returns {Object} Un objeto con los query params.
 */
export function parseQueryParams(url) {
  // URLSearchParams: soporta '=' en valores, '+' como espacio y '%' malformado; ignora el hash
  const { searchParams } = new URL(url, 'http://localhost')
  return Object.fromEntries(searchParams)
}

/**
 * Construye una query string desde un objeto.
 * @param {Object} params - Los parámetros a convertir.
 * @returns {string} La query string (ej. '?category=frutas&sort=asc')
 */
export function buildQueryString(params) {
  const entries = Object.entries(params)
  if (entries.length === 0) return ''

  const query = entries
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')

  return `?${query}`
}