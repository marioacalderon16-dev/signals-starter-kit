/**
 * src/core/resource.js
 *
 * resource(): datos asíncronos reactivos (carga, error, cancelación y recarga)
 */

import { signal, effect, onCleanup, untrack, Batch } from './signal.js'

/**
 * Crea un recurso asíncrono.
 *
 *   const usuario = resource(() => id.get(), (id, { signal }) => api.get(`/users/${id}`, {}, { signal }))
 *   usuario.loading.get(); usuario.data.get(); usuario.error.get()
 *
 * - `source` (opcional) se rastrea: cuando cambia, se vuelve a pedir. Si devuelve
 *   false/null/undefined, no se pide nada. Sin `source`, se pide una vez.
 * - `fetcher(params, { signal })` devuelve una promesa. Sus lecturas NO se rastrean.
 * - La petición anterior se cancela (AbortSignal) al volver a pedir y al desmontar;
 *   una respuesta tardía nunca pisa a una más reciente.
 * - Mientras recarga, `data` conserva el valor anterior. Si falla, se guarda `error`
 *   y `data` también se conserva. Un AbortError no cuenta como error.
 *
 * @returns {{ data, error, loading, refetch: Function, mutate: Function }}
 */
export function resource(source, fetcher) {
  if (!fetcher) {
    fetcher = source
    source = () => true
  }

  const data = signal(undefined)
  const error = signal(null)
  const loading = signal(false)
  const version = signal(0) // refetch() la incrementa para forzar una nueva petición

  effect(() => {
    version.get()
    const params = source()
    if (params === false || params === null || params === undefined) {
      loading.set(false)
      return
    }

    const controller = new AbortController()
    let vigente = true
    onCleanup(() => {
      vigente = false
      controller.abort()
    })

    Batch.run(() => {
      loading.set(true)
      error.set(null)
    })

    let promesa
    try {
      promesa = Promise.resolve(untrack(() => fetcher(params, { signal: controller.signal })))
    } catch (e) {
      promesa = Promise.reject(e)
    }

    promesa.then(
      (valor) => {
        if (!vigente) return
        Batch.run(() => {
          data.set(valor)
          loading.set(false)
        })
      },
      (e) => {
        if (!vigente || e?.name === 'AbortError') return
        Batch.run(() => {
          error.set(e)
          loading.set(false)
        })
      }
    )
  })

  return {
    data,
    error,
    loading,
    refetch: () => version.set(untrack(() => version.get()) + 1), // untrack: llamarlo desde un effect no crea un bucle
    mutate: (valor) => data.set(valor) // actualización local (p.ej. optimista)
  }
}
