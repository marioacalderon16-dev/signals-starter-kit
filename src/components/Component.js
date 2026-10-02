// src/components/Component.js
// Sistema de componentes: define, c (composición), renderApp

import { effect, createRoot } from '@core/signal.js'

const components = new Map()

/**
 * Registra un componente en la aplicación.
 * @param {string} name - Nombre del componente.
 * @param {Function} componentFn - Función que CREA y DEVUELVE un HTMLElement.
 * @param {boolean} isReactive - Si el componente debe ser reactivo a cambios en props.
 */
export const define = (name, componentFn, isReactive = false) => {
  if (isReactive) {
    // Envolver la función del componente para hacerlo reactivo
    const reactiveComponentFn = (props = {}) => {
      let element
      
      // Crear efecto para re-renderizar cuando las props cambien
      effect(() => {
        const newElement = componentFn(props)
        
        if (!element) {
          element = newElement // Primer render
        } else if (element.parentNode) {
          // Reemplazar el elemento anterior con el nuevo
          element.parentNode.replaceChild(newElement, element)
          element = newElement
        } else {
          console.warn(`define: el componente reactivo '${name}' cambió sin estar montado; se omite el reemplazo`)
        }
      })
      
      return element
    }
    
    components.set(name, reactiveComponentFn)
  } else {
    components.set(name, componentFn)
  }
}

/**
 * Crea una instancia de un componente registrado (composición).
 * @param {string} name - Nombre del componente.
 * @param {Object} props - Props a pasar al componente.
 * @returns {HTMLElement} El elemento DOM del componente.
 */
export const c = (name, props = {}) => {
  const componentFn = components.get(name)
  if (!componentFn) {
    throw new Error(`El componente '${name}' no ha sido definido.`)
  }
  return componentFn(props)
}

/**
 * Renderiza el componente raíz en el contenedor especificado.
 * @param {string} name - Nombre del componente raíz.
 * @param {HTMLElement} container - El elemento del DOM donde se montará la app.
 */
export const renderApp = (name, container) => {
  const componentFn = components.get(name)
  if (!componentFn) {
    throw new Error(`El componente '${name}' no ha sido definido.`)
  }
  
  // Limpiar contenedor
  while (container.firstChild) {
    container.removeChild(container.firstChild)
  }
  
  // Renderizar componente dentro de un root: sus effects y onCleanup tienen dueño
  const appElement = createRoot(() => componentFn())
  container.appendChild(appElement)
  
  return appElement
}

/**
 * Renderiza un componente en un contenedor con actualizaciones granulares.
 * @param {Function} componentFn - Función del componente
 * @param {HTMLElement} container - Contenedor donde se montará
 * @param {Object} props - Props iniciales
 * @returns {Object} Objeto con métodos para actualizar y limpiar
 */
export const render = (componentFn, container, props = {}) => {
  let element
  let dispose = null

  const update = (newProps) => {
    // Libera los effects del render anterior antes de crear los nuevos
    if (dispose) dispose()
    // createRoot: sin tracking (no suscribe al effect que llama a render, p.ej. el Router)
    // y dueño propio para los effects creados por el componente
    const newElement = createRoot(d => {
      dispose = d
      return componentFn(newProps)
    })

    if (element && element.parentNode === container) {
      container.replaceChild(newElement, element)
    } else {
      container.appendChild(newElement)
    }

    element = newElement
  }

  // Render inicial
  update(props)

  return {
    update,
    cleanup: () => {
      if (dispose) dispose()
      dispose = null
      if (element && element.parentNode === container) {
        container.removeChild(element)
      }
      element = null
    }
  }
}

/**
 * Obtiene un componente registrado (útil para debugging).
 * @param {string} name - Nombre del componente.
 * @returns {Function|undefined} La función del componente o undefined.
 */
export const getComponent = (name) => {
  return components.get(name)
}

/**
 * Lista todos los componentes registrados.
 * @returns {Array<string>} Array con los nombres de los componentes.
 */
export const listComponents = () => {
  return Array.from(components.keys())
}