/**
 * src/kit.js — punto de entrada único del kit
 *
 *   import { signal, computed, h, For, Show, define, Link, navigate, resource } from '@kit'
 *
 * Reexporta la API pública; los módulos internos siguen disponibles en su ruta
 * (@core/…, @features/…) para usos avanzados.
 * No incluye generateUrl: vive en routes.config.js (importarlo aquí crearía un ciclo
 * con los guards de la app, que a su vez importan '@kit').
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

// Router — AL FINAL a propósito: el router importa routes.config.js, que puede importar
// guards de la app que a su vez importen '@kit'. Con este orden, cuando se cierra ese
// ciclo, todo lo anterior (signal, persist…) ya está cargado y se puede usar al instante.
export { navigate, replace, url, currentPath, currentQuery } from '@features/router/router.state.js'
export { Link } from '@features/router/Link.js'
