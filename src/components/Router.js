// src/components/Router.js
// Componente router que maneja la navegación

import { effect, onCleanup, untrack } from '@core/index.js'
import { define, c, render, getComponent } from '@components/Component.js'
import { currentPath, currentQuery, replace, normalizePath } from '@features/router/router.state.js'
import { matchRoute } from '@features/router/router.utils.js'
import { logger } from '@shared/utils/logger.js'

const log = logger.create('ROUTER')

// Máximo de redirecciones seguidas antes de considerarlo un bucle
const MAX_REDIRECTS = 10

/**
 * Devuelve la ruta a la que hay que redirigir, o null si se puede mostrar la ruta.
 * - route.redirect: '/destino' o (ctx) => '/destino'
 * - route.beforeEnter: (ctx) => '/destino' para redirigir; cualquier otro valor deja pasar
 * ctx = { path, params, query }. Se evalúa sin tracking: cambiar un signal leído aquí
 * (p.ej. la sesión) no vuelve a ejecutar el router; navega explícitamente si hace falta.
 */
function resolveRedirect(routeMatch, path) {
  const { route, params } = routeMatch
  const ctx = { path, params, query: currentQuery.get() }

  if (route.redirect) {
    return typeof route.redirect === 'function' ? route.redirect(ctx) : route.redirect
  }
  if (route.beforeEnter) {
    const result = route.beforeEnter(ctx)
    if (typeof result === 'string') return result
  }
  return null
}

define('Router', () => {
  const container = document.createElement('div')
  container.className = 'router-container'

  let currentRoute = null
  let currentRenderer = null
  let redirects = 0
  let navegacion = 0 // id de la navegación actual: descarta cargas diferidas obsoletas

  // Monta (o actualiza) la página de una ruta ya resuelta
  const montar = (routeMatch) => {
    if (currentRoute && currentRoute.component === routeMatch.component) {
      // Si es el mismo componente, solo actualizamos las props
      if (currentRenderer) {
        currentRenderer.update({ params: routeMatch.params })
      }
      return
    }
    // Si es un componente diferente, limpiamos el anterior y renderizamos el nuevo
    if (currentRenderer) {
      currentRenderer.cleanup()
    }
    // Quita el texto 404 / "Cargando…" si lo había
    container.textContent = ''

    currentRenderer = render(
      (props) => c(routeMatch.component, props),
      container,
      { params: routeMatch.params }
    )

    currentRoute = routeMatch
  }

  // Desmonta la página actual y muestra un texto (404, carga, error…)
  const mostrarTexto = (texto) => {
    if (currentRenderer) currentRenderer.cleanup()
    currentRenderer = null
    currentRoute = null
    container.textContent = texto
  }

  // Si el Router se desmonta, desmonta también la página actual
  onCleanup(() => {
    if (currentRenderer) currentRenderer.cleanup()
  })

  effect(() => {
    const path = currentPath.get()
    const routeMatch = matchRoute(path)

    // Redirecciones y guards
    let destino = routeMatch && untrack(() => resolveRedirect(routeMatch, path))
    if (destino && normalizePath(destino) === path) {
      log.warn(`La ruta ${path} redirige a sí misma; se ignora la redirección`)
      destino = null
    }
    if (destino) {
      if (++redirects > MAX_REDIRECTS) {
        log.error(`Demasiadas redirecciones (posible bucle) en: ${path}`)
        redirects = 0
        mostrarTexto('Error: Demasiadas redirecciones')
        return
      }
      replace(destino) // sin entrada extra en el historial; el effect se re-ejecuta con la nueva ruta
      return
    }
    redirects = 0

    const id = ++navegacion

    if (!routeMatch) {
      // Fallback si no se encuentra ninguna ruta
      mostrarTexto('Página no encontrada (404)')
      return
    }

    // Carga diferida: route.load() importa el módulo que define el componente (solo la primera vez)
    if (routeMatch.route.load && !getComponent(routeMatch.component)) {
      mostrarTexto('Cargando…')
      routeMatch.route.load()
        .then(() => {
          if (id === navegacion) montar(routeMatch) // si ya se navegó a otra ruta, se descarta
        })
        .catch((error) => {
          if (id !== navegacion) return
          log.error(`Error al cargar la página de ${path}:`, error)
          mostrarTexto('Error al cargar la página')
        })
      return
    }

    montar(routeMatch)
  })

  return container
})