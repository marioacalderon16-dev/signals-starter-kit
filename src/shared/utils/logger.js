// src/shared/utils/logger.js - Versión ultra minimalista
const env = import.meta.env || {}

const isDev = env.DEV || env.VITE_DEV_MODE === 'true'
const logLevel = (env.VITE_LOG_LEVEL || (isDev ? 'DEBUG' : 'WARN')).toUpperCase()

const LEVELS = { TRACE: 0, DEBUG: 1, INFO: 2, WARN: 3, ERROR: 4, SILENT: 5 }
const currentLevel = LEVELS[logLevel] ?? LEVELS.WARN // ?? : TRACE vale 0

export const logger = {
  trace: (msg, ...args) => currentLevel <= 0 && console.trace('[TRACE]', msg, ...args),
  debug: (msg, ...args) => currentLevel <= 1 && console.debug('[DEBUG]', msg, ...args),
  info: (msg, ...args) => currentLevel <= 2 && console.info('[INFO]', msg, ...args),
  warn: (msg, ...args) => currentLevel <= 3 && console.warn('[WARN]', msg, ...args),
  error: (msg, ...args) => currentLevel <= 4 && console.error('[ERROR]', msg, ...args),
  create: (prefix) => ({
    trace: (msg, ...args) => logger.trace(`${prefix}: ${msg}`, ...args),
    debug: (msg, ...args) => logger.debug(`${prefix}: ${msg}`, ...args),
    info: (msg, ...args) => logger.info(`${prefix}: ${msg}`, ...args),
    warn: (msg, ...args) => logger.warn(`${prefix}: ${msg}`, ...args),
    error: (msg, ...args) => logger.error(`${prefix}: ${msg}`, ...args)
  })
}

export default logger