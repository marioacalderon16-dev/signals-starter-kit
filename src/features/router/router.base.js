// src/features/router/router.base.js
// Base de despliegue: permite servir la app en una subruta (ej. GitHub Pages: /mi-repo/)

/**
 * Base sin barra final: '' si la app vive en la raíz, '/mi-repo' si vive en una subruta.
 * Sale de la opción `base` de vite.config.js (import.meta.env.BASE_URL).
 */
export const BASE = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '')

/**
 * Quita la base de un pathname del navegador → ruta de la app.
 * @param {string} pathname - Ej. '/mi-repo/tareas'
 * @returns {string} Ej. '/tareas' (o el pathname tal cual si está fuera de la base)
 */
export function stripBase(pathname) {
  if (!BASE) return pathname
  if (pathname === BASE) return '/'
  if (pathname.startsWith(`${BASE}/`)) return pathname.slice(BASE.length)
  return pathname
}

/**
 * Convierte una ruta de la app en una URL real con la base (para href o history).
 * Es idempotente: si la ruta ya lleva la base, la deja igual.
 * @param {string} path - Ej. '/tareas?q=1'
 * @returns {string} Ej. '/mi-repo/tareas?q=1'
 */
export function url(path) {
  if (!BASE || !path.startsWith('/')) return path
  if (path === BASE || path.startsWith(`${BASE}/`) || path.startsWith(`${BASE}?`) || path.startsWith(`${BASE}#`)) return path
  return `${BASE}${path}`
}

/**
 * Indica si un pathname del navegador pertenece a la app (está dentro de la base).
 */
export function isInBase(pathname) {
  return !BASE || pathname === BASE || pathname.startsWith(`${BASE}/`)
}
