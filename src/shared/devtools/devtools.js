/**
 * src/shared/devtools/devtools.js
 *
 * Panel de desarrollo: muestra cuántos effects hay vivos y resalta en la página
 * cada nodo que actualiza un signal (la reactividad de grano fino, a la vista).
 * Solo se carga en desarrollo (ver src/main.js). Desactívalo con VITE_DEVTOOLS=false.
 */

import { getStats } from '@core/signal.js'
import { devtools } from '@features/dom/dom.js'

const CLAVE = 'ssk-devtools' // 'on' | 'off' en localStorage
const DURACION_MS = 700

const leerPreferencia = () => {
  try { return localStorage.getItem(CLAVE) !== 'off' } catch { return true }
}
const guardarPreferencia = (activo) => {
  try { localStorage.setItem(CLAVE, activo ? 'on' : 'off') } catch { /* sin storage: no se recuerda */ }
}

const CSS = `
@keyframes ssk-flash { from { outline-color: rgb(245 158 11) } to { outline-color: rgb(245 158 11 / 0) } }
[data-ssk-flash] { outline: 2px solid rgb(245 158 11); outline-offset: 1px; animation: ssk-flash ${DURACION_MS}ms ease-out forwards }
[data-ssk-devtools] {
  position: fixed; right: 12px; bottom: 12px; z-index: 2147483647;
  font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
  background: #0f172a; color: #f8fafc; padding: 6px 10px; border: 0; border-radius: 9999px;
  cursor: pointer; opacity: .85; box-shadow: 0 2px 8px rgb(0 0 0 / .25)
}
[data-ssk-devtools]:hover { opacity: 1 }
`

/**
 * Monta el panel. No usa signals (se actualiza con un intervalo) para no contarse a sí mismo.
 * @returns {Function} parar: quita el panel y el gancho
 */
export function iniciarDevtools() {
  let resaltar = leerPreferencia()

  const estilo = document.createElement('style')
  estilo.textContent = CSS
  document.head.appendChild(estilo)

  const insignia = document.createElement('button')
  insignia.type = 'button'
  insignia.setAttribute('data-ssk-devtools', '')
  insignia.title = 'signals-starter-kit devtools · clic: activar/desactivar el resaltado de actualizaciones'
  const pintar = () => {
    insignia.textContent = `⚡ ${getStats().effects} effects · resaltar: ${resaltar ? 'sí' : 'no'}`
  }
  insignia.addEventListener('click', () => {
    resaltar = !resaltar
    guardarPreferencia(resaltar)
    pintar()
  })
  document.body.appendChild(insignia)
  pintar()
  const intervalo = setInterval(pintar, 500)

  // Resalta el nodo actualizado (atributo propio: no interfiere con className ni style)
  const temporizadores = new Map()
  devtools.onUpdate = (el) => {
    if (!resaltar || !el || el === insignia) return
    el.removeAttribute('data-ssk-flash')
    void el.offsetWidth // reinicia la animación si se actualiza varias veces seguidas
    el.setAttribute('data-ssk-flash', '')
    clearTimeout(temporizadores.get(el))
    temporizadores.set(el, setTimeout(() => {
      el.removeAttribute('data-ssk-flash')
      temporizadores.delete(el)
    }, DURACION_MS))
  }

  return () => {
    clearInterval(intervalo)
    temporizadores.forEach(clearTimeout)
    devtools.onUpdate = null
    insignia.remove()
    estilo.remove()
  }
}
