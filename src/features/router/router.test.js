import { describe, it, expect, vi, afterEach } from 'vitest'
import { matchRoute, parseQueryParams, buildQueryString, registerRoutes } from './router.utils.js'
import { currentPath, currentQuery, navigate, replace, setQuery, normalizePath } from './router.state.js'
import { effect } from '@core/signal.js'

// Rutas de prueba: desde la v2 se registran con registerRoutes (el router ya no importa routes.config.js)
const routes = [
    { path: '/', component: 'Home', name: 'home' },
    { path: '/a.b', component: 'Dot', name: 'dot' },
    { path: '/files/*/x/*', component: 'Files', name: 'files' },
    { path: '/docs/*/:id', component: 'Doc', name: 'doc' },
    { path: '/products/:id', component: 'Product', name: 'product' },
]
registerRoutes(routes)


describe('matchRoute', () => {
  it('extrae params', () => {
    expect(matchRoute('/products/7')).toMatchObject({ component: 'Product', params: { id: '7' } })
  })

  it('escapa caracteres especiales: "." no es comodín', () => {
    expect(matchRoute('/a.b')?.component).toBe('Dot')
    expect(matchRoute('/aXb')).toBeNull()
  })

  it('todos los "*" son comodines', () => {
    expect(matchRoute('/files/1/x/2')?.component).toBe('Files')
  })

  it('un "*" antes de un param no desplaza el valor del param', () => {
    expect(matchRoute('/docs/a/b/42')).toMatchObject({ component: 'Doc', params: { id: '42' } })
  })
})

describe('parseQueryParams', () => {
  it('soporta "=" en valores, "+" como espacio, % malformado y hash', () => {
    expect(parseQueryParams('/p?a=x=y&b=hola+mundo&c=%ZZ&d=1#frag'))
      .toEqual({ a: 'x=y', b: 'hola mundo', c: '%ZZ', d: '1' })
  })

  it('sin query devuelve {}', () => {
    expect(parseQueryParams('/p')).toEqual({})
  })
})

describe('normalizePath / navigate', () => {
  it('normalizePath quita query, hash y barra final', () => {
    expect(normalizePath('/?q=1')).toBe('/')
    expect(normalizePath('/products/1/')).toBe('/products/1')
    expect(normalizePath('/products/1?x=2#y')).toBe('/products/1')
    expect(normalizePath('/')).toBe('/')
  })

  it('navigate guarda la ruta normalizada pero conserva query/hash en la URL', () => {
    navigate('/products/3/?q=1#top')
    expect(currentPath.get()).toBe('/products/3')
    expect(location.pathname + location.search + location.hash).toBe('/products/3/?q=1#top')
    expect(matchRoute(currentPath.get())?.component).toBe('Product')
  })

  it('popstate actualiza la ruta normalizada', () => {
    history.pushState(null, '', '/products/9/?z=1')
    dispatchEvent(new PopStateEvent('popstate'))
    expect(currentPath.get()).toBe('/products/9')
  })
})

describe('intercepción de enlaces <a>', () => {
  afterEach(() => { document.body.innerHTML = '' })

  const clickLink = (attrs, init = {}) => {
    const a = document.createElement('a')
    Object.entries(attrs).forEach(([k, v]) => a.setAttribute(k, v))
    a.appendChild(document.createElement('span')) // el clic suele venir de un hijo
    document.body.appendChild(a)
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init })
    // jsdom no implementa la navegación real: se anota si el router la impidió y luego se cancela
    let impedido
    const anotar = (e) => { impedido = e.defaultPrevented; e.preventDefault() }
    window.addEventListener('click', anotar, { once: true })
    a.firstChild.dispatchEvent(ev)
    return { defaultPrevented: impedido }
  }

  it('enlace interno: navega sin recargar', () => {
    navigate('/')
    const ev = clickLink({ href: '/products/5' })
    expect(ev.defaultPrevented).toBe(true)
    expect(currentPath.get()).toBe('/products/5')
  })

  it.each([
    ['externo', { href: 'https://example.com/x' }, {}],
    ['target _blank', { href: '/products/6', target: '_blank' }, {}],
    ['download', { href: '/products/6', download: '' }, {}],
    ['ctrl+clic', { href: '/products/6' }, { ctrlKey: true }],
    ['clic central', { href: '/products/6' }, { button: 1 }],
  ])('no intercepta: %s', (_, attrs, init) => {
    navigate('/')
    const ev = clickLink(attrs, init)
    expect(ev.defaultPrevented).toBe(false)
    expect(currentPath.get()).toBe('/')
  })

  it('ancla en la misma página: deja actuar al navegador', () => {
    navigate('/products/1')
    const ev = clickLink({ href: '#seccion' })
    expect(ev.defaultPrevented).toBe(false)
  })
})

describe('params de ruta: decode / encode', () => {
  it('matchRoute decodifica params y tolera % malformado', () => {
    expect(matchRoute('/products/caf%C3%A9').params.id).toBe('café')
    expect(matchRoute('/products/%E0%A4%A').params.id).toBe('%E0%A4%A')
  })

  it('generateUrl codifica params y no confunde :id con :idx', async () => {
    const real = await vi.importActual('./routes.config.js')
    real.routes.push({ path: '/t/:idx/:id', component: 'T', name: 't' })
    expect(real.generateUrl('t', { id: 'a b/c', idx: 'é' })).toBe('/t/%C3%A9/a%20b%2Fc')
  })
})

describe('currentQuery', () => {
  it('refleja la query tras navigate, replace y popstate', () => {
    navigate('/products/1?a=1&b=x+y')
    expect(currentQuery.get()).toEqual({ a: '1', b: 'x y' })
    history.pushState(null, '', '/products/1?c=3')
    dispatchEvent(new PopStateEvent('popstate'))
    expect(currentQuery.get()).toEqual({ c: '3' })
    replace('/products/1?r=1')
    expect(currentQuery.get()).toEqual({ r: '1' })
    navigate('/')
    expect(currentQuery.get()).toEqual({})
  })

  it('es reactiva y no notifica si la query no cambia', async () => {
    navigate('/?q=1')
    const seen = []
    const dispose = effect(() => { seen.push(currentQuery.get().q) })
    navigate('/products/2?q=1') // cambia la ruta, no la query
    await new Promise(r => setTimeout(r))
    navigate('/?q=2')
    await new Promise(r => setTimeout(r))
    dispose()
    expect(seen).toEqual(['1', '2'])
  })
})

describe('buildQueryString', () => {
  it('codifica claves y valores', () => {
    expect(buildQueryString({ q: 'a b&c', 'año': 2024 })).toBe('?q=a%20b%26c&a%C3%B1o=2024')
  })

  it("omite null, undefined y '' (pero no 0 ni false)", () => {
    expect(buildQueryString({ q: '', a: null, b: undefined, pagina: 0, solo: false })).toBe('?pagina=0&solo=false')
    expect(buildQueryString({ q: '' })).toBe('')
    expect(buildQueryString({})).toBe('')
  })
})

describe('setQuery', () => {
  afterEach(() => { navigate('/') })

  it('combina con la query actual, conserva la ruta y el hash, y quita los vacíos', () => {
    history.pushState(null, '', '/products/1?q=dune&pagina=2#lista')
    dispatchEvent(new PopStateEvent('popstate'))
    setQuery({ pagina: 3, orden: 'titulo' })
    expect(location.pathname + location.search + location.hash).toBe('/products/1?q=dune&pagina=3&orden=titulo#lista')
    expect(currentQuery.get()).toEqual({ q: 'dune', pagina: '3', orden: 'titulo' })
    setQuery({ q: '', orden: null })
    expect(location.search).toBe('?pagina=3')
    expect(currentPath.get()).toBe('/products/1')
  })

  it('crea entrada en el historial salvo con { replace: true }', () => {
    navigate('/products/1')
    const inicial = history.length
    setQuery({ q: 'a' })
    expect(history.length).toBe(inicial + 1)
    setQuery({ q: 'ab' }, { replace: true })
    expect(history.length).toBe(inicial + 1)
    expect(location.search).toBe('?q=ab')
  })

  it('no hace nada si la URL no cambia (sin entradas repetidas ni notificaciones)', async () => {
    navigate('/products/1?q=a')
    const inicial = history.length
    const vistos = []
    const dispose = effect(() => { vistos.push(currentQuery.get()) })
    setQuery({ q: 'a' })
    setQuery({ otro: '' })
    await new Promise(r => setTimeout(r))
    dispose()
    expect(history.length).toBe(inicial)
    expect(vistos).toHaveLength(1)
  })

  it('llamado dentro de un effect no lo vuelve dependiente de la query (sin bucles)', async () => {
    navigate('/products/1')
    const texto = { valor: 'x' }
    let ejecuciones = 0
    const dispose = effect(() => { ejecuciones++; setQuery({ q: texto.valor }, { replace: true }) })
    navigate('/products/1?q=otra') // cambia la query: el effect no debe re-ejecutarse
    await new Promise(r => setTimeout(r))
    dispose()
    expect(ejecuciones).toBe(1)
  })
})

describe('setQuery: misma query escrita de otra forma', () => {
  it("'?q=a+b' y '?q=a%20b' son la misma query: no crea entrada ni notifica", async () => {
    history.pushState(null, '', '/products/1?q=a+b')
    dispatchEvent(new PopStateEvent('popstate'))
    const inicial = history.length
    const vistos = []
    const dispose = effect(() => { vistos.push(currentQuery.get()) })
    setQuery({ q: 'a b' })
    await new Promise(r => setTimeout(r))
    dispose()
    expect(history.length).toBe(inicial)
    expect(vistos).toHaveLength(1)
    navigate('/')
  })
})
