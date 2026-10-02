/**
 * src/core/debounced.js
 *
 * debounced(): copia retrasada de un valor reactivo (para búsquedas mientras se escribe)
 */

import { signal, effect, onCleanup, untrack, getOwner } from './signal.js'

/**
 * Devuelve un signal que toma el valor de `source` cuando este lleva `ms` sin cambiar.
 *
 *   const texto = signal('')
 *   const busqueda = debounced(texto, 300)
 *   const libros = resource(() => busqueda.get() || null, (q, { signal }) => buscar(q, { signal }))
 *
 * - `source` es un signal/computed o una función que lee signals.
 * - El valor inicial es el actual de `source` (sin esperar).
 * - El temporizador pendiente se cancela al desmontar el componente (onCleanup):
 *   créalo dentro de un componente o de un createRoot.
 * - Trátalo como de solo lectura: lo actualiza `source`.
 *
 * @param {{ get: Function } | Function} source
 * @param {number} ms - Milisegundos de espera.
 * @returns {import('./signal.js').Signal}
 */
export function debounced(source, ms) {
  if (!(ms >= 0)) throw new TypeError('debounced(source, ms) necesita ms >= 0')
  if (!getOwner()) console.warn('[debounced] Creado fuera de un componente o createRoot: su effect nunca se liberará')
  const read = typeof source === 'function' ? source : () => source.get()
  const valor = signal(undefined)
  let primera = true

  effect(() => {
    const siguiente = read()
    if (primera) {
      // Valor inicial sin esperar (y sin un set retrasado que notificaría en vano)
      primera = false
      valor.set(siguiente)
      return
    }
    const temporizador = setTimeout(() => valor.set(siguiente), ms)
    onCleanup(() => clearTimeout(temporizador))
  })

  return valor
}
