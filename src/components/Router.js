// src/components/Router.js
// Componente router que maneja la navegación

import { effect, onCleanup } from '@core/index.js'
import { define, c, render } from '@components/Component.js'
import { currentPath } from '@features/router/router.state.js'
import { matchRoute } from '@features/router/router.utils.js'

define('Router', () => {
  const container = document.createElement('div')
  container.className = 'router-container'

  let currentRoute = null
  let currentRenderer = null

  // Si el Router se desmonta, desmonta también la página actual
  onCleanup(() => {
    if (currentRenderer) currentRenderer.cleanup()
  })

  effect(() => {
    const path = currentPath.get()
    const routeMatch = matchRoute(path)

    if (routeMatch) {
      if (currentRoute && currentRoute.component === routeMatch.component) {
        // Si es el mismo componente, solo actualizamos las props
        if (currentRenderer) {
          currentRenderer.update({ params: routeMatch.params })
        }
      } else {
        // Si es un componente diferente, limpiamos el anterior y renderizamos el nuevo
        if (currentRenderer) {
          currentRenderer.cleanup()
        }
        // Quita el texto 404 si venimos de una ruta desconocida
        container.textContent = ''

        currentRenderer = render(
          (props) => c(routeMatch.component, props),
          container,
          { params: routeMatch.params }
        )

        currentRoute = routeMatch
      }
    } else {
      // Fallback si no se encuentra ninguna ruta
      if (currentRenderer) {
        currentRenderer.cleanup()
        currentRenderer = null
      }
      container.textContent = 'Página no encontrada (404)'
      currentRoute = null
    }
  })

  return container
})