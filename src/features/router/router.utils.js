// src/features/router/router.utils.js
// Utilidades para el router (matching de rutas)

import { routes } from './routes.config.js'

/**
 * Encuentra la ruta que coincide con el path actual y extrae los parámetros.
 * @param {string} path - La ruta actual (ej. '/products/1')
 * @returns {Object|null} - Un objeto con el componente y los parámetros, o null.
 */
export function matchRoute(path) {
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
        name: route.name 
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