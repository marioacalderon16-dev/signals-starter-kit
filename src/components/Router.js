// src/components/Router.js
// Componente router que maneja la navegación

import { signal, effect, onCleanup, untrack } from '@core/index.js'
import { define, c, render, getComponent } from '@components/Component.js'
import { currentPath, currentQuery, replace, normalizePath } from '@features/router/router.state.js'
import { matchRoute, hasRoutes } from '@features/router/router.utils.js'
import { logger } from '@shared/utils/logger.js'
import config from '@/config/app.js'

const log = logger.create('ROUTER')

// Máximo de redirecciones seguidas antes de considerarlo un bucle
const MAX_REDIRECTS = 10

/**
 * ¿Animar este cambio de página con la View Transitions API?
 * Solo si el navegador la soporta, la ruta no la desactiva (transition: false)
 * y el usuario no pidió reducir el movimiento.
 */
function usarTransicion(route) {
  return route.transition !== false &&
    typeof document.startViewTransition === 'function' &&
    !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

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
  let currentRenderer = null // página actual
  let layoutRenderer = null  // layout actual (se conserva entre rutas que lo comparten)
  let layoutName = null
  let slot = null            // hueco del layout donde se monta la página
  const titulo = signal('')  // título de la ruta, para que el layout lo muestre
  let redirects = 0
  let navegacion = 0 // id de la navegación actual: descarta cargas y transiciones obsoletas

  const desmontarLayout = () => {
    if (layoutRenderer) layoutRenderer.cleanup()
    layoutRenderer = null
    layoutName = null
    slot = null
  }

  // route.title: texto o ({ params, query }) => texto
  const aplicarTitulo = (routeMatch) => {
    const { title } = routeMatch.route
    let texto = title
    if (typeof title === 'function') {
      try {
        texto = untrack(() => title({ params: routeMatch.params, query: currentQuery.get() }))
      } catch (error) {
        // Un título roto no debe impedir mostrar la página
        log.error(`Error en el title de ${routeMatch.route.path}:`, error)
        texto = ''
      }
    }
    titulo.set(texto ?? '')
    document.title = texto ? `${texto} · ${config.name}` : config.name
  }

  // Monta la página (y su layout si cambia) en el contenedor
  const montarPagina = (routeMatch) => {
    if (currentRenderer) currentRenderer.cleanup()
    currentRenderer = null

    const nombreLayout = routeMatch.route.layout ?? null
    if (nombreLayout !== layoutName) {
      desmontarLayout()
      container.textContent = ''
      if (nombreLayout) {
        // El layout recibe { content, title }: un hueco para la página y el título como signal
        // (`contenido` se mantiene como alias por compatibilidad)
        slot = document.createElement('div')
        slot.style.display = 'contents'
        layoutRenderer = render((props) => c(nombreLayout, props), container, { content: slot, contenido: slot, title: titulo })
        layoutName = nombreLayout
      }
    } else {
      // Mismo layout (o ninguno): quita el texto 404 / "Cargando…" si lo había
      ;(slot ?? container).textContent = ''
    }

    currentRenderer = render(
      (props) => c(routeMatch.component, props),
      slot ?? container,
      { params: routeMatch.params }
    )
    currentRoute = routeMatch
  }

  // Monta (o actualiza) la página de una ruta ya resuelta
  const montar = (routeMatch, id) => {
    aplicarTitulo(routeMatch)

    const mismoLayout = (currentRoute?.route.layout ?? null) === (routeMatch.route.layout ?? null)
    if (currentRoute && currentRoute.component === routeMatch.component && mismoLayout) {
      // Mismo componente y mismo layout: solo actualizamos las props
      if (currentRenderer) currentRenderer.update({ params: routeMatch.params })
      currentRoute = routeMatch
      return
    }

    // Si llega otra navegación antes de que corra la transición, se descarta esta
    const cambiar = () => {
      if (id === navegacion) montarPagina(routeMatch)
    }
    const primeraCarga = !currentRoute && !layoutName
    if (!primeraCarga && usarTransicion(routeMatch.route)) document.startViewTransition(cambiar)
    else cambiar()
  }

  // Desmonta la página (y el layout) y muestra un texto (404, carga, error…)
  const mostrarTexto = (texto) => {
    if (currentRenderer) currentRenderer.cleanup()
    currentRenderer = null
    currentRoute = null
    desmontarLayout()
    container.textContent = texto
  }

  // Si el Router se desmonta, desmonta también la página actual
  onCleanup(() => {
    navegacion++ // invalida cargas diferidas y transiciones pendientes: no deben montar nada
    if (currentRenderer) currentRenderer.cleanup()
    currentRenderer = null
    desmontarLayout()
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
      // Sin rutas registradas no es un 404: falta registerRoutes(routes) en main.js (migración a la v2)
      if (!hasRoutes()) {
        mostrarTexto('No hay rutas registradas: añade registerRoutes(routes) en src/main.js (ver la consola y el CHANGELOG).')
        return
      }
      // Fallback si no se encuentra ninguna ruta
      mostrarTexto('Página no encontrada (404)')
      return
    }

    // Carga diferida: route.load() importa el módulo que define el componente (solo la primera vez)
    if (routeMatch.route.load && !getComponent(routeMatch.component)) {
      aplicarTitulo(routeMatch) // el título ya es el de la página que se está cargando
      if (layoutName && routeMatch.route.layout === layoutName) {
        // Mismo layout: el aviso va dentro del hueco y el layout (y su estado) se conserva
        if (currentRenderer) currentRenderer.cleanup()
        currentRenderer = null
        currentRoute = null
        slot.textContent = 'Cargando…'
      } else {
        mostrarTexto('Cargando…')
      }
      routeMatch.route.load()
        .then(() => {
          if (id === navegacion) montar(routeMatch, id) // si ya se navegó a otra ruta, se descarta
        })
        .catch((error) => {
          if (id !== navegacion) return
          log.error(`Error al cargar la página de ${path}:`, error)
          mostrarTexto('Error al cargar la página')
        })
      return
    }

    montar(routeMatch, id)
  })

  return container
})