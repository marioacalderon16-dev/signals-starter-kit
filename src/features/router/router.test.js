import { describe, it, expect, vi, afterEach } from 'vitest'
import { matchRoute, parseQueryParams } from './router.utils.js'
import { currentPath, currentQuery, navigate, replace, normalizePath } from './router.state.js'
import { effect } from '@core/signal.js'

vi.mock('./routes.config.js', () => ({
  routes: [
    { path: '/', component: 'Home', name: 'home' },
    { path: '/a.b', component: 'Dot', name: 'dot' },
    { path: '/files/*/x/*', component: 'Files', name: 'files' },
    { path: '/docs/*/:id', component: 'Doc', name: 'doc' },
    { path: '/products/:id', component: 'Product', name: 'product' },
  ]
}))


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
