/**
 * src/core/on.js
 *
 * on(): escucha eventos de document, window o cualquier otro objetivo, con limpieza automática
 */

import { onCleanup, getOwner } from './signal.js'

/**
 * Escucha un evento mientras el componente esté montado.
 *
 *   on(document, 'keydown', (e) => { if (e.key === 'Escape') cerrar() })
 *   on(window, 'resize', medir, { passive: true })
 *
 * - El listener se quita solo al desmontar el componente (onCleanup):
 *   úsalo dentro de un componente, un effect o un createRoot.
 * - Dentro de un effect, se quita y se vuelve a poner en cada re-ejecución.
 * - Para los elementos creados con h() basta con sus props: h('button', { onClick }).
 *
 * @param {EventTarget} target
 * @param {string} evento
 * @param {Function} handler
 * @param {AddEventListenerOptions} [opciones]
 * @returns {Function} Quita el listener antes de tiempo.
 */
export function on(target, evento, handler, opciones) {
  if (!getOwner()) console.warn('[on] Usado fuera de un componente o createRoot: el listener nunca se quitará solo')
  const quitar = () => target.removeEventListener(evento, handler, opciones)
  target.addEventListener(evento, handler, opciones)
  if (getOwner()) onCleanup(quitar)
  return quitar
}
