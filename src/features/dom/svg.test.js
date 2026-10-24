import { describe, it, expect } from 'vitest'
import { h } from './dom.js'
import { signal, createRoot } from '@core/signal.js'

const SVG_NS = 'http://www.w3.org/2000/svg'
const tick = () => new Promise(r => setTimeout(r))
const montar = (fn) => createRoot(() => fn())

describe('h() con SVG', () => {
  it('svg y sus etiquetas se crean en el espacio de nombres SVG', () => {
    const svg = montar(() => h('svg', { viewBox: '0 0 24 24' }, h('path', { d: 'M0 0L24 24' }), h('circle', { r: 4 })))
    expect(svg.namespaceURI).toBe(SVG_NS)
    expect(svg.querySelector('path').namespaceURI).toBe(SVG_NS)
    expect(svg.querySelector('circle').namespaceURI).toBe(SVG_NS)
  })

  it('los atributos conservan mayúsculas y guiones (viewBox, stroke-width)', () => {
    const svg = montar(() => h('svg', { viewBox: '0 0 24 24', 'stroke-width': 2, fill: 'none' }))
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24')
    expect(svg.getAttribute('stroke-width')).toBe('2')
    expect(svg.getAttribute('fill')).toBe('none')
  })

  it('className llega al atributo class (texto, objeto, array y signal)', async () => {
    const grande = signal(false)
    const color = signal('text-red-600')
    const a = montar(() => h('svg', { className: 'h-6 w-6' }))
    const b = montar(() => h('svg', { className: { 'h-6': true, 'h-8': grande } }))
    const c = montar(() => h('svg', { className: ['h-6', color] }))
    const d = montar(() => h('path', { className: color }))
    expect(a.getAttribute('class')).toBe('h-6 w-6')
    expect(b.getAttribute('class')).toBe('h-6')
    expect(c.getAttribute('class')).toBe('h-6 text-red-600')
    expect(d.getAttribute('class')).toBe('text-red-600')
    grande.set(true)
    color.set('text-sky-700')
    await tick()
    expect(b.getAttribute('class')).toBe('h-6 h-8')
    expect(c.getAttribute('class')).toBe('h-6 text-sky-700')
    expect(d.getAttribute('class')).toBe('text-sky-700')
  })

  it('un atributo reactivo se actualiza (fill)', async () => {
    const fill = signal('red')
    const c = montar(() => h('circle', { fill }))
    expect(c.getAttribute('fill')).toBe('red')
    fill.set('blue')
    await tick()
    expect(c.getAttribute('fill')).toBe('blue')
  })

  it('href y title son atributos en SVG; textContent sigue siendo texto', () => {
    const use = montar(() => h('use', { href: '#icono' }))
    const texto = montar(() => h('text', { textContent: 'Hola' }))
    expect(use.getAttribute('href')).toBe('#icono')
    expect(texto.namespaceURI).toBe(SVG_NS)
    expect(texto.textContent).toBe('Hola')
  })

  it("las etiquetas compartidas con HTML siguen siendo HTML; con 'svg:' son SVG", () => {
    const html = montar(() => h('a', { href: '/x' }))
    const svgA = montar(() => h('svg:a', { href: '#x' }))
    const svgTitle = montar(() => h('svg:title', {}, 'Cerrar'))
    expect(html.namespaceURI).toBe('http://www.w3.org/1999/xhtml')
    expect(svgA.namespaceURI).toBe(SVG_NS)
    expect(svgA.tagName).toBe('a')
    expect(svgA.getAttribute('href')).toBe('#x')
    expect(svgTitle.namespaceURI).toBe(SVG_NS)
    expect(svgTitle.textContent).toBe('Cerrar')
  })

  it('los eventos funcionan en SVG', () => {
    let clics = 0
    const svg = montar(() => h('svg', { onClick: () => clics++ }))
    svg.dispatchEvent(new Event('click'))
    expect(clics).toBe(1)
  })
})
