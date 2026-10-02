// src/features/router/Link.js
// Enlace del router: base de despliegue, estado activo y precarga de páginas diferidas

import { h } from '@features/dom/dom.js'
import { computed } from '@core/signal.js'
import { currentPath, normalizePath, url } from './router.state.js'
import { matchRoute } from './router.utils.js'

/**
 * <a> para navegar dentro de la app.
 *
 *   Link({ to: '/admin/productos', activeClass: 'font-bold', prefetch: true }, 'Productos')
 *   h(Link, { to: '/acerca' }, 'Acerca')
 *
 * - href con la base de despliegue (url()); el clic lo intercepta el router (sin recarga).
 * - activeClass se aplica si la ruta actual es `to` o cuelga de ella (/admin activa en
 *   /admin/usuarios). Con exact: true, solo si coincide; '/' es exacto por defecto.
 * - aria-current="page" solo en la página exacta.
 * - prefetch: al pasar el ratón o enfocar, descarga la página diferida (route.load) una vez.
 */
export function Link({ to, activeClass = '', exact, prefetch = false, className = '', children = [], ...attrs } = {}, ...hijos) {
  const destino = normalizePath(to)
  const soloExacto = exact ?? destino === '/'

  const coincide = computed(() => currentPath.get() === destino)
  const activo = computed(() => coincide.get() || (!soloExacto && currentPath.get().startsWith(`${destino}/`)))

  const clases = {}
  if (className) clases[className] = true
  if (activeClass) clases[activeClass] = activo

  const el = h('a', {
    ...attrs,
    href: url(to),
    className: clases,
    'aria-current': computed(() => (coincide.get() ? 'page' : null))
  }, ...[].concat(children), ...hijos)

  if (prefetch) {
    let hecho = false
    const precargar = () => {
      if (hecho) return
      hecho = true
      const ruta = matchRoute(destino)?.route
      if (!ruta?.load) return
      try {
        Promise.resolve(ruta.load()).catch(() => { hecho = false }) // si falla, se reintenta otro día
      } catch {
        hecho = false
      }
    }
    el.addEventListener('mouseenter', precargar)
    el.addEventListener('focus', precargar)
  }

  return el
}
