// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('registerRoutes (v2: el router ya no importa routes.config.js)', () => {
  it('router.utils.js no importa routes.config.js: no puede haber ciclo de importación', () => {
    const codigo = fs.readFileSync(path.resolve('src/features/router/router.utils.js'), 'utf8')
    // Solo sentencias import reales (el aviso de migración menciona el import dentro de un texto)
    // Una sentencia import cuyo módulo de origen sea routes.config (sin cruzar comillas)
    expect(codigo).not.toMatch(/^\s*import\s[^'"]*?from\s+['"][^'"]*routes\.config/m)
    expect(codigo).not.toMatch(/import\(\s*['"][^'"]*routes\.config/)
  })

  it('matchRoute usa las rutas registradas y registerRoutes las reemplaza', async () => {
    vi.resetModules()
    const { registerRoutes, matchRoute } = await import('./router.utils.js')
    registerRoutes([{ path: '/a', component: 'A' }])
    expect(matchRoute('/a')?.component).toBe('A')
    registerRoutes([{ path: '/b', component: 'B' }])
    expect(matchRoute('/a')).toBeNull()
    expect(matchRoute('/b')?.component).toBe('B')
  })

  it('sin rutas registradas avisa una sola vez con la solución', async () => {
    vi.resetModules()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { matchRoute } = await import('./router.utils.js')
    expect(matchRoute('/')).toBeNull()
    expect(matchRoute('/otra')).toBeNull()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0].join(' '))).toMatch(/registerRoutes/)
  })

  it('el aviso vuelve a salir si, tras registrar rutas, se registra una tabla vacía', async () => {
    vi.resetModules()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { registerRoutes, matchRoute } = await import('./router.utils.js')
    matchRoute('/')
    registerRoutes([{ path: '/a', component: 'A' }])
    registerRoutes([])
    matchRoute('/')
    expect(warn).toHaveBeenCalledTimes(2)
  })

  it('registerRoutes exige un array', async () => {
    const { registerRoutes } = await import('./router.utils.js')
    expect(() => registerRoutes({ path: '/' })).toThrow(TypeError)
  })

})
