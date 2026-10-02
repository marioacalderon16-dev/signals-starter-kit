/*  src/core/dom.js  –  Helper DOM 100 % reactivo  */

import { effect, createRoot, onCleanup, getOwner } from '@core/signal.js'

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
  const binds = [] // bind:value / bind:checked se aplican tras los hijos (un <select> necesita sus <option>)
  Object.entries(attrs).forEach(([k, v]) => {
    /* enlace en los dos sentidos  bind:value  bind:checked  */
    if (k.startsWith('bind:')) {
      binds.push([k.slice(5), v])
      return
    }

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

  binds.forEach(([prop, sig]) => bindTwoWay(el, prop, sig))

  return el
}

/* ----------  7.a  bindTwoWay  –  bind:value / bind:checked  ---------- */
// El signal actualiza el elemento y el elemento actualiza el signal.
// Solo escribe en el elemento si el valor difiere (no mueve el cursor al escribir).
const bindTwoWay = (el, prop, signal) => {
  if (!isSignal(signal) || typeof signal.set !== 'function') {
    console.warn(`h(): bind:${prop} necesita un signal (con .set)`)
    return
  }
  if (prop === 'value') {
    effect(() => {
      const v = signal.get()
      const texto = v === null || v === undefined ? '' : String(v)
      if (el.value !== texto) el.value = texto
    })
    el.addEventListener('input', () => signal.set(el.value))
    if (el.tagName === 'SELECT') el.addEventListener('change', () => signal.set(el.value))
    return
  }
  if (prop === 'checked') {
    effect(() => {
      const v = Boolean(signal.get())
      if (el.checked !== v) el.checked = v
    })
    el.addEventListener('change', () => signal.set(el.checked))
    return
  }
  console.warn(`h(): bind:${prop} no está soportado (usa bind:value o bind:checked)`)
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

/* ----------  7.c  For  –  lista con clave  ---------- */
// Pinta una lista reutilizando los nodos de los elementos que no cambian.
// - each:   signal/computed con un array, o una función que lo devuelva
// - key:    (item) => clave única y estable (p.ej. item.id)
// - render: (item) => UN elemento del DOM
// Un item con la misma clave y el mismo objeto conserva su nodo (solo se mueve si cambia
// el orden); con la misma clave pero un objeto nuevo, se re-renderiza solo ese item.
// Cada item tiene su propio root: sus effects se liberan al quitarlo o al desmontar la lista.
export const For = (each, key, render) => {
  const start = document.createComment('for')
  const end = document.createComment('/for')
  const fragment = document.createDocumentFragment()
  fragment.append(start, end)

  let entries = new Map() // clave → { item, node, dispose }

  const disposeAll = () => {
    entries.forEach(entry => entry.dispose())
    entries = new Map()
  }
  if (getOwner()) onCleanup(disposeAll)

  effect(() => {
    const items = typeof each === 'function' ? each() : each.get()
    const next = new Map()
    const nodes = []

    items.forEach((item, index) => {
      let k = key(item)
      if (next.has(k)) {
        console.warn(`For: clave duplicada "${k}"; usa una clave única por elemento`)
        k = `${k}#${index}`
      }

      let entry = entries.get(k)
      if (entry && !Object.is(entry.item, item)) {
        // Misma clave, objeto nuevo: re-renderiza solo este item
        entry.dispose()
        entry.node.remove()
        entry = null
      }
      if (!entry) {
        entry = createRoot(dispose => ({ item, node: render(item), dispose }))
      }

      entries.delete(k)
      next.set(k, entry)
      nodes.push(entry.node)
    })

    // Los que quedan en `entries` ya no están en la lista
    entries.forEach(entry => {
      entry.dispose()
      entry.node.remove()
    })
    entries = next

    // Coloca los nodos en orden entre los comentarios, moviendo solo los que no están en su sitio
    const parent = end.parentNode
    let ref = start
    for (const node of nodes) {
      if (ref.nextSibling !== node) parent.insertBefore(node, ref.nextSibling)
      ref = node
    }
  })

  return fragment
}

/* ----------  7.d  Show  –  renderizado condicional  ---------- */
// Show(cond, () => vista, () => alternativa?)
// - cond: signal/computed o función; se evalúa como verdadero/falso
// - Solo reconstruye cuando la condición cambia de verdadero a falso (o al revés):
//   mientras siga siendo verdadera, la vista conserva su nodo y su estado.
// - Cada rama vive en su propio root: sus effects se liberan al cambiar de rama o al desmontar.
export const Show = (when, vista, alternativa) => {
  const leer = typeof when === 'function' ? when : () => when.get()
  const vacio = () => null
  let ultimo
  let nodo = null
  let dispose = null

  if (getOwner()) onCleanup(() => dispose && dispose())

  return reactiveChild({
    get: () => {
      const activo = Boolean(leer())
      if (activo !== ultimo) {
        ultimo = activo
        if (dispose) dispose()
        nodo = createRoot((d) => {
          dispose = d
          return (activo ? vista : alternativa || vacio)()
        })
      }
      return nodo
    }
  })
}

/* ----------  8.  alias JSX  ---------- */
export const jsx = h