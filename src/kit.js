/**
 * src/kit.js — punto de entrada único del kit
 *
 *   import { signal, computed, h, For, Show, define, Link, navigate, resource } from '@kit'
 *
 * Reexporta la API pública; los módulos internos siguen disponibles en su ruta
 * (@core/…, @features/…) para usos avanzados.
 * No incluye generateUrl ni la tabla de rutas: viven en routes.config.js, que la app
 * registra en main.js con registerRoutes(routes).
 */

// Reactividad
export {
  signal, computed, effect, untrack, Batch,
  createRoot, onCleanup, getOwner, getStats
} from '@core/signal.js'
export { resource } from '@core/resource.js'

// DOM
export { h, For, Show, fragment, text } from '@features/dom/dom.js'

// Componentes
export { define, c, render, renderApp } from '@components/Component.js'

// Utilidades
export { HttpClient } from '@core/httpClient.js'
export { persist } from '@shared/utils/persist.js'

// Router (desde la v2 no importa routes.config.js: los guards pueden importar '@kit' sin ciclos)
export { navigate, replace, url, currentPath, currentQuery } from '@features/router/router.state.js'
export { registerRoutes } from '@features/router/router.utils.js'
export { Link } from '@features/router/Link.js'
