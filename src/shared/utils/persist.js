// src/shared/utils/persist.js
// Persistencia minimalista de signals en localStorage

import { effect } from '@core/signal.js'
import { logger } from '@shared/utils/logger.js'

/**
 * Persiste un signal en localStorage.
 * - Al cargar: Lee valor del localStorage
 * - Al cambiar: Guarda en localStorage automáticamente
 * 
 * @param {string} key - Clave en localStorage
 * @param {Signal} signal - Señal a persistir
 * @param {Object} options - Opciones (opcional)
 * @param {Storage} options.storage - localStorage o sessionStorage
 * @param {Function} options.onError - Callback para errores
 * @returns {Function} dispose: deja de guardar los cambios
 */
export function persist(key, signal, options = {}) {
  const {
    storage = localStorage,
    onError = (error) => logger.error(`[persist] Error con "${key}":`, error)
  } = options
  
  const storageName = storage === localStorage ? 'localStorage'
    : storage === sessionStorage ? 'sessionStorage'
    : 'storage'
  
  // 1. Cargar valor inicial desde storage
  try {
    const raw = storage.getItem(key)
    if (raw) {
      const value = JSON.parse(raw)
      signal.set(value)
      logger.debug(`[persist] "${key}" cargado desde ${storageName}`)
    }
  } catch (error) {
    onError(error)
  }
  
  // 2. Guardar automáticamente al cambiar (devuelve dispose para dejar de persistir)
  return effect(() => {
    const value = signal.get()
    
    try {
      if (value === undefined || value === null) {
        storage.removeItem(key)
      } else {
        storage.setItem(key, JSON.stringify(value))
      }
    } catch (error) {
      onError(error)
    }
  })
}

/**
 * Persiste en sessionStorage (alias conveniente)
 * @param {string} key - Clave en sessionStorage
 * @param {Signal} signal - Señal a persistir
 * @param {Object} options - Opciones (opcional)
 */
export function persistSession(key, signal, options = {}) {
  return persist(key, signal, { ...options, storage: sessionStorage })
}

/**
 * Elimina un valor persistido
 * @param {string} key - Clave a eliminar
 * @param {Storage} storage - localStorage (por defecto) o sessionStorage
 */
export function clearPersisted(key, storage = localStorage) {
  try {
    storage.removeItem(key)
    logger.debug(`[persist] "${key}" eliminado`)
  } catch (error) {
    logger.warn(`[persist] Error al eliminar "${key}":`, error)
  }
}

/**
 * Verifica si existe un valor persistido
 * @param {string} key - Clave a verificar
 * @param {Storage} storage - localStorage (por defecto) o sessionStorage
 * @returns {boolean} True si existe
 */
export function hasPersisted(key, storage = localStorage) {
  try {
    return storage.getItem(key) !== null
  } catch {
    return false
  }
}