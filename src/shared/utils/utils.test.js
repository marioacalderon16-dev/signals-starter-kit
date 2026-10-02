import { describe, it, expect, vi, afterEach } from 'vitest'
import { signal } from '@core/signal.js'
import { persist } from './persist.js'

const tick = () => new Promise(r => setTimeout(r))

describe('logger', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); vi.restoreAllMocks() })

  it('nivel TRACE no cae a WARN', async () => {
    vi.stubEnv('VITE_LOG_LEVEL', 'TRACE')
    vi.resetModules()
    const { logger } = await import('./logger.js')
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {})
    logger.debug('visible')
    expect(debug).toHaveBeenCalled()
  })
})

describe('persist', () => {
  afterEach(() => localStorage.clear())

  it('carga, guarda y devuelve un dispose que deja de guardar', async () => {
    localStorage.setItem('k', JSON.stringify(5))
    const s = signal(0)
    const dispose = persist('k', s)
    expect(s.get()).toBe(5)
    s.set(6)
    await tick()
    expect(localStorage.getItem('k')).toBe('6')
    expect(typeof dispose).toBe('function')
    dispose()
    s.set(7)
    await tick()
    expect(localStorage.getItem('k')).toBe('6')
  })
})
