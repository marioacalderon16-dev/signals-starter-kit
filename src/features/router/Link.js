// src/features/router/Link.js
// Enlace del router: base de despliegue, estado activo y precarga de páginas diferidas

import { h } from '@features/dom/dom.js'
import { computed, untrack } from '@core/signal.js'
import { currentPath, normalizePath, url } from './router.state.js'
import { matchRoute } from './router.utils.js'

// Valor fijo, signal/computed o función → su valor actual
const leer = (v) => (typeof v === 'function' ? v() : v && typeof v.get === 'function' ? v.get() : v)

/**
 * <a> para navegar dentro de la app.
 *
 *   Link({ to: '/admin/productos', activeClass: 'font-bold', prefetch: true }, 'Productos')
 *   h(Link, { to: '/acerca' }, 'Acerca')
 *   Link({ to: () => `/usuarios/${id.get()}`, className: clase }, 'Ver')   // reactivos
 *
 * - to y className pueden ser un valor, un signal/computed o una función: el enlace se
 *   actualiza sin reconstruirse.
 * - href con la base de despliegue (url()); el clic lo intercepta el router (sin recarga).
 * - activeClass se aplica si la ruta actual es `to` o cuelga de ella (/admin activa en
 *   /admin/usuarios). Con exact: true, solo si coincide; '/' es exacto por defecto.
 * - aria-current="page" solo en la página exacta.
 * - prefetch: al pasar el ratón o enfocar, descarga la página diferida (route.load) una vez
 *   por destino.
 */
export function Link({ to, activeClass = '', exact, prefetch = false, className = '', children = [], ...attrs } = {}, ...hijos) {
  const destino = computed(() => normalizePath(leer(to)))
  const soloExacto = computed(() => exact ?? destino.get() === '/')

  const coincide = computed(() => currentPath.get() === destino.get())
  const activo = computed(() => coincide.get() ||
    (!soloExacto.get() && currentPath.get().startsWith(`${destino.get()}/`)))

  const el = h('a', {
    ...attrs,
    href: computed(() => url(leer(to))),
    className: computed(() => [leer(className), activeClass && activo.get() ? activeClass : '']
      .filter(Boolean).join(' ')),
    'aria-current': computed(() => (coincide.get() ? 'page' : null))
  }, ...[].concat(children), ...hijos)

  if (prefetch) {
    let hechoPara = null // destino ya precargado (o en curso)
    const precargar = () => {
      const actual = untrack(() => destino.get())
      if (hechoPara === actual) return
      hechoPara = actual
      const ruta = matchRoute(actual)?.route
      if (!ruta?.load) return
      const reintentar = () => { if (hechoPara === actual) hechoPara = null } // si falla, se reintenta otro día
      try {
        Promise.resolve(ruta.load()).catch(reintentar)
      } catch {
        reintentar()
      }
    }
    el.addEventListener('mouseenter', precargar)
    el.addEventListener('focus', precargar)
  }

  return el
}
