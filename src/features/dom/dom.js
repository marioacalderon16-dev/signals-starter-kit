/*  src/core/dom.js  –  Helper DOM 100 % reactivo  */

import { effect } from '@core/signal.js'

/* ----------  utilidades internas  ---------- */
const isSignal = v => v && typeof v.get === 'function'
// Hijos que no se pintan: permite el patrón  cond && h(...)
const isEmptyChild = v => v == null || typeof v === 'boolean'
// Solo  onClick  (mayúscula tras "on") u  on:evento ; "one", "online"… son atributos
const isEventKey = k => /^on[A-Z]/.test(k) || k.startsWith('on:')

/* ----------  1.  bindProp  ---------- */
// Nota: los bindings leen el signal SOLO dentro de su effect (que corre en el acto);
// una lectura fuera la rastrearía el effect padre (p.ej. define reactivo) y re-renderizaría todo.
export const bindProp = (el, prop, signal) => {
  effect(() => { el[prop] = signal.get() })
  return el
}

/* ----------  2.  bindAttr  ---------- */
export const bindAttr = (el, attr, signal) => {
  const read = () => {
    const v = signal.get()
    v == null ? el.removeAttribute(attr) : el.setAttribute(attr, v)
  }
  effect(read)                 // inicial + reactivo
  return el
}

/* ----------  3.b  reactiveChild  ---------- */
// Hijo reactivo: el signal puede contener texto, un Node o un valor vacío (false/null)
export const reactiveChild = signal => {
  const textNode = document.createTextNode('')
  let node = textNode
  effect(() => {
    const v = signal.get()
    const next = v instanceof Node ? v : textNode
    if (next === textNode) textNode.nodeValue = isEmptyChild(v) ? '' : String(v)
    if (next !== node) {
      if (node.parentNode) node.parentNode.replaceChild(next, node)
      node = next
    }
  })
  return node
}

/* ----------  3.  reactiveText  ---------- */
export const reactiveText = signal => {
  const node = document.createTextNode('')
  effect(() => { node.nodeValue = signal.get() })
  return node
}

/* ----------  4.  clearElement  ---------- */
export const clearElement = el => { while (el.firstChild) el.removeChild(el.firstChild) }

/* ----------  5.  fragment  ---------- */
export const fragment = (...children) => {
  const f = document.createDocumentFragment()
  children.flat(Infinity).forEach(ch => {
    if (isEmptyChild(ch)) return
    f.appendChild(ch instanceof Node ? ch : document.createTextNode(String(ch)))
  })
  return f
}

/* ----------  6.  bind múltiple  ---------- */
export const bind = (el, bindings) => {
  Object.entries(bindings).forEach(([k, signal]) => {
    if (!isSignal(signal)) return
    if (k === 'style')        bindProp(el, 'style', signal)
    else if (k === 'className') bindProp(el, 'className', signal)
    else if (k.startsWith('attr:')) bindAttr(el, k.slice(5), signal)
    else                      bindProp(el, k, signal)
  })
  return el
}

/* ----------  7.  h  –  factory de elementos / componentes  ---------- */
export const h = (tag, attrs = {}, ...children) => {
  /* 7.a  componente función  */
  if (typeof tag === 'function') return tag({ ...attrs, children })

  /* 7.b  elemento normal  */
  const el = document.createElement(tag)

  /* 7.c  atributos / props / eventos  */
  Object.entries(attrs).forEach(([k, v]) => {
    /* eventos  onClick  o  on:click  */
    if (isEventKey(k)) {
      const event = k.startsWith('on:') ? k.slice(3) : k.slice(2).toLowerCase()

      if (isSignal(v)) {
        let currentHandler = null
        effect(() => {
          const newHandler = v.get()
          if (currentHandler) {
            el.removeEventListener(event, currentHandler)
          }
          if (newHandler) {
            el.addEventListener(event, newHandler)
          }
          currentHandler = newHandler
        })
      } else if (typeof v === 'function') {
        el.addEventListener(event, v)
      } else if (v != null) {
        console.warn(`h(): el handler de "${k}" no es una función; se ignora`)
      }
      return
    }

    /* innerHTML  –  bloqueado: inyectar HTML debe ser explícito  */
    if (k === 'innerHTML') {
      console.warn('h(): "innerHTML" se ignora (riesgo de XSS). Usa "dangerouslySetInnerHTML" solo con HTML de confianza')
      return
    }

    /* dangerouslySetInnerHTML  –  string | signal  (solo con HTML de confianza)  */
    if (k === 'dangerouslySetInnerHTML') {
      if (isSignal(v)) bindProp(el, 'innerHTML', v)
      else el.innerHTML = v == null ? '' : v
      return
    }

    /* LISTA de propiedades DOM que NO son atributos HTML */
    const domProperties = [
      'textContent', 'innerText', 'value',
      'checked', 'disabled', 'selected', 'multiple',
      'readOnly', 'required', 'placeholder', 'type',
      'src', 'href', 'alt', 'title', 'tabIndex'
    ]
    
    const specialProperties = ['className', 'style', 'htmlFor']
    
    /* className  –  array | objeto | string | signal  */
    if (k === 'className' || k === 'class') {
      const propName = 'className'
      
      if (isSignal(v)) { 
        bindProp(el, propName, v) 
        return 
      }
      
      if (Array.isArray(v)) {
        const base = v.filter(x => typeof x === 'string')
        const sig  = v.find(isSignal)
        const apply = () => {
          el[propName] = base.concat(sig ? sig.get() : []).join(' ')
        }
        effect(apply) 
        return
      }
      
      if (typeof v === 'object' && !Array.isArray(v)) {
        const keys = Object.keys(v)
        const apply = () => {
          const list = keys.filter(cls => {
            const cond = v[cls]
            return isSignal(cond) ? cond.get() : Boolean(cond)
          })
          el[propName] = list.join(' ')
        }
        effect(apply) 
        return
      }
      
      el[propName] = v || ''
      return
    }

    /* style  –  string | signal | objeto  */
    if (k === 'style') {
      if (isSignal(v)) { 
        bindProp(el, 'style', v) 
        return 
      }
      
      if (typeof v === 'object' && !Array.isArray(v)) {
        Object.entries(v).forEach(([cssProp, val]) => {
          if (isSignal(val)) {
            effect(() => { el.style[cssProp] = val.get() })
          } else {
            el.style[cssProp] = val
          }
        })
        return
      }
      
      el.style.cssText = v || ''
      return
    }

    /* htmlFor (especial para <label>) */
    if (k === 'htmlFor') {
      if (isSignal(v)) {
        effect(() => { el.setAttribute('for', v.get()) })
      } else {
        el.setAttribute('for', v)
      }
      return
    }

    /* VALORES ESTÁTICOS (no señales) */
    if (!isSignal(v)) {
      if (v == null) return // Ignorar null/undefined
      
      // Propiedades DOM directas
      if (domProperties.includes(k)) {
        el[k] = v
      }
      // className ya se manejó arriba
      else if (k === 'className' || k === 'class') {
        el.className = v
      }
      // Atributos normales
      else {
        el.setAttribute(k, v)
      }
      return
    }

    /* VALORES COMO SEÑALES */
    // Propiedades DOM como señales (incluye textContent)
    if (domProperties.includes(k)) {
      bindProp(el, k, v)
    }
    // Atributos normales como señales
    else {
      bindAttr(el, k, v)
    }
  })

  /* 7.d  hijos  (aplanados)  */
  if (children.length > 0) {
    // Verificar si ya se estableció textContent o dangerouslySetInnerHTML
    const hasContentProperty = attrs.textContent !== undefined || 
                              attrs.dangerouslySetInnerHTML !== undefined
    
    // Solo añadir hijos si no hay textContent/dangerouslySetInnerHTML
    if (hasContentProperty) {
      if (children.flat(Infinity).some(ch => !isEmptyChild(ch))) {
        console.warn(`h('${tag}'): se ignoran los hijos porque hay textContent o dangerouslySetInnerHTML`)
      }
    } else {
      children.flat(Infinity).forEach(ch => {
        if (isEmptyChild(ch)) return
        
        if (isSignal(ch)) {
          el.appendChild(reactiveChild(ch))
        } else {
          el.appendChild(
            ch instanceof Node ? ch : document.createTextNode(String(ch))
          )
        }
      })
    }
  }

  return el
}

/* ----------  7.b  –  texto simple  ---------- */
export const text = (content) => {
  if (isSignal(content)) {
    return reactiveText(content)
  }
  return document.createTextNode(String(content))
}

// Uso:
// h('p', { className: 'message' }, text('Texto estático'))
// h('p', { className: 'message' }, text(dynamicSignal))

/* ----------  8.  alias JSX  ---------- */
export const jsx = h