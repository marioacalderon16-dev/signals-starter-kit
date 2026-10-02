// src/features/router/router.state.js
// Estado del router

import { signal, computed } from '@core/index.js'
import { parseQueryParams } from './router.utils.js'
import { logger } from '@shared/utils/logger.js'

const log = logger.create('ROUTER')

/**
 * Normaliza una ruta para el matching: solo el pathname, sin query, hash ni barra final.
 * @param {string} path - Ruta (ej. '/products/1/?q=2#top')
 * @returns {string} Ruta normalizada (ej. '/products/1')
 */
export function normalizePath(path) {
  const { pathname } = new URL(path, window.location.origin)
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
}

/**
 * Signal que contiene la ruta actual (normalizada) de la aplicación.
 */
export const currentPath = signal(normalizePath(window.location.pathname))

// Query actual como texto ('?a=1'): al ser string, navegar sin cambiar la query no notifica
const currentSearch = signal(window.location.search)

/**
 * Query params actuales como objeto (ej. { q: 'hola' }). Reactivo: se actualiza al navegar.
 */
export const currentQuery = computed(() => parseQueryParams(currentSearch.get()))

/**
 * Sincroniza los signals del router con la URL actual del navegador.
 */
function syncFromLocation() {
  currentPath.set(normalizePath(window.location.pathname))
  currentSearch.set(window.location.search)
}

/**
 * Navega a una nueva ruta.
 * @param {string} path - La nueva ruta (ej. '/about').
 */
export function navigate(path) {
  window.history.pushState(null, null, path)
  syncFromLocation()
  log.info(`Navegando a: ${path}`)
}

/**
 * Reemplaza la ruta actual (sin crear entrada en el historial).
 * @param {string} path - La nueva ruta.
 */
export function replace(path) {
  window.history.replaceState(null, null, path)
  syncFromLocation()
  log.info(`Reemplazando ruta a: ${path}`)
}

/**
 * Vuelve a la página anterior.
 */
export function goBack() {
  window.history.back()
}

/**
 * Avanza a la siguiente página.
 */
export function goForward() {
  window.history.forward()
}

// Escuchar eventos de navegación del navegador (botones atrás/adelante)
window.addEventListener('popstate', () => {
  syncFromLocation()
  log.info(`Navegación del navegador: ${window.location.pathname}`)
})

// Interceptar clics en enlaces internos <a href="/..."> para navegar sin recargar
document.addEventListener('click', (event) => {
  // Respetar clics ya gestionados, no izquierdos o con modificadores (abrir en pestaña, etc.)
  if (event.defaultPrevented || event.button !== 0) return
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

  const link = event.target instanceof Element ? event.target.closest('a[href]') : null
  if (!link) return
  if ((link.target && link.target !== '_self') || link.hasAttribute('download')) return

  const url = new URL(link.href, window.location.href)
  if (url.origin !== window.location.origin) return

  // Ancla en la misma página: dejar que el navegador haga scroll
  const samePage = url.pathname === window.location.pathname && url.search === window.location.search
  if (samePage && url.hash) return

  event.preventDefault()
  navigate(url.pathname + url.search + url.hash)
})
