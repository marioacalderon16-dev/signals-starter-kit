import { logger } from '@shared/utils/logger.js'
import { url } from './router.base.js'

/**
 * Tabla de rutas de la aplicación.
 * Cada ruta define un path y el componente a renderizar.
 */
export const routes = [
  { 
    path: '/',
    component: 'InitialPage',
    name: 'initial'
  }
]

/**
 * Obtiene una ruta por su nombre.
 * @param {string} name - El nombre de la ruta.
 * @returns {Object|undefined} La ruta encontrada o undefined.
 */
export function getRouteByName(name) {
  return routes.find(route => route.name === name)
}

/**
 * Genera una URL basada en el nombre de la ruta y parámetros.
 * @param {string} name - El nombre de la ruta.
 * @param {Object} params - Los parámetros de la ruta.
 * @returns {string} La URL generada (incluye la base de despliegue si la hay).
 */
export function generateUrl(name, params = {}) {
  const route = getRouteByName(name)
  if (!route) {
    logger.warn(`[ROUTES] Ruta "${name}" no encontrada`)
    return '/'
  }

  // Sustituye cada ':param' completo (':id' no toca ':idx') y codifica su valor
  const path = route.path.replace(/:(\w+)/g, (match, key) =>
    key in params ? encodeURIComponent(params[key]) : match
  )
  return url(path) // con la base de despliegue, lista para usar en un href
}