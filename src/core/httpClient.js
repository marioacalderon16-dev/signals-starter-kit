/**
 * src/core/httpClient.js
 * 
 * Un cliente HTTP flexible y configurable.
 */
import { logger } from '@shared/utils/logger.js'

const log = logger.create('HttpClient')

// Cuerpos que fetch envía tal cual (el navegador pone su propio Content-Type)
const isRawBody = (data) =>
  typeof data === 'string' ||
  data instanceof FormData ||
  data instanceof Blob ||
  data instanceof URLSearchParams ||
  data instanceof ArrayBuffer

/**
 * Lee el cuerpo según su Content-Type: JSON → objeto, resto → texto, vacío → null.
 */
const parseBody = async (response) => {
  if (response.status === 204) return null
  const text = await response.text()
  if (!text) return null
  const type = response.headers.get('Content-Type') || ''
  if (type.includes('json')) {
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  }
  return text
}

/**
 * Combina un AbortSignal externo con un timeout (ms). Devuelve undefined si no hay ninguno.
 */
const buildSignal = (signal, timeout) => {
  const signals = [signal, timeout ? AbortSignal.timeout(timeout) : null].filter(Boolean)
  if (signals.length <= 1) return signals[0]
  return AbortSignal.any(signals)
}
export class HttpClient {
  /**
   * @param {Object} config - La configuración del cliente.
   * @param {string} config.baseUrl - La URL base para todas las peticiones.
   * @param {Object} [config.headers={}] - Cabeceras por defecto para todas las peticiones.
   * @param {Object} [config.auth=null] - Configuración de autenticación.
   * @param {string} [config.auth.type='Bearer'] - El tipo de autenticación (ej. 'Bearer', 'ApiKey').
   * @param {Function} [config.auth.tokenGetter] - Una función que retorna el token de autenticación.
   * @param {number} [config.timeout] - Timeout por defecto en ms para todas las peticiones.
   */
  constructor({ baseUrl, headers = {}, auth = null, timeout = 0 }) {
    if (!baseUrl) {
      throw new Error('HttpClient requiere una baseUrl en la configuración.')
    }

    this.baseUrl = baseUrl.replace(/\/$/, '') // Elimina la barra final si existe
    this.defaultHeaders = { ...headers }
    this.authConfig = auth
    this.timeout = timeout
  }

  /**
   * Construye la URL completa para la petición.
   * @param {string} endpoint - El endpoint de la API.
   * @returns {string} La URL completa.
   */
  _buildUrl(endpoint) {
    return `${this.baseUrl}/${endpoint.replace(/^\//, '')}` // Elimina la barra inicial si existe
  }

  /**
   * Construye las cabeceras para la petición, incluyendo la de autenticación si es necesario.
   * @param {Object} [customHeaders={}] - Cabeceras adicionales para esta petición.
   * @returns {Object} El objeto de cabeceras completo.
   */
  _buildHeaders(customHeaders = {}) {
    const headers = { ...this.defaultHeaders, ...customHeaders }

    if (this.authConfig && this.authConfig.tokenGetter) {
      const token = this.authConfig.tokenGetter()
      if (token) {
        const authType = this.authConfig.type || 'Bearer'
        headers['Authorization'] = `${authType} ${token}`
      }
    }

    return headers
  }

  /**
   * Realiza una petición HTTP.
   * @param {string} method - El método HTTP (GET, POST, etc.).
   * @param {string} endpoint - El endpoint de la API.
   * @param {Object} [options={}] - Opciones de la petición.
   * @param {*} [options.data] - El cuerpo: objeto/valor (se envía como JSON) o FormData/Blob/string (tal cual).
   * @param {Object} [options.headers={}] - Cabeceras adicionales.
   * @param {AbortSignal} [options.signal] - Señal para cancelar la petición.
   * @param {number} [options.timeout] - Timeout en ms (por defecto el del cliente).
   * @returns {Promise<any>} JSON parseado, texto, o null si no hay contenido.
   * @throws {Error} Con `status` y `data` (cuerpo de la respuesta) si la respuesta no es 2xx.
   */
  async request(method, endpoint, { data, headers = {}, signal, timeout = this.timeout } = {}) {
    const config = {
      method,
      headers: this._buildHeaders(headers),
      signal: buildSignal(signal, timeout),
    }

    if (data !== undefined && data !== null && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
      if (isRawBody(data)) {
        config.body = data
      } else {
        config.body = JSON.stringify(data)
        config.headers = { 'Content-Type': 'application/json', ...config.headers }
      }
    }

    try {
      const response = await fetch(this._buildUrl(endpoint), config)
      const body = await parseBody(response)

      // Lanza un error si la respuesta no es exitosa (2xx)
      if (!response.ok) {
        const error = new Error(body?.message || `Error HTTP: ${response.status}`)
        error.status = response.status
        error.data = body
        throw error
      }

      return body
    } catch (error) {
      log.error(`Error en ${method} ${endpoint}:`, error)
      throw error // Relanza el error para que el manejador lo capture
    }
  }

  // Métodos de conveniencia (options: { signal, timeout })
  get(endpoint, headers, options = {}) {
    return this.request('GET', endpoint, { ...options, headers })
  }

  post(endpoint, data, headers, options = {}) {
    return this.request('POST', endpoint, { ...options, data, headers })
  }

  put(endpoint, data, headers, options = {}) {
    return this.request('PUT', endpoint, { ...options, data, headers })
  }

  patch(endpoint, data, headers, options = {}) {
    return this.request('PATCH', endpoint, { ...options, data, headers })
  }

  delete(endpoint, headers, options = {}) {
    return this.request('DELETE', endpoint, { ...options, headers })
  }

  options(endpoint, headers, options = {}) {
    return this.request('OPTIONS', endpoint, { ...options, headers })
  }
}
