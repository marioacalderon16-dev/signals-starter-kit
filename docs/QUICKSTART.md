# Inicio rápido: tu primera app con signals-starter-kit

En unos 20 minutos vas a construir una **lista de tareas** completa: añadir, marcar, filtrar desde la URL, ver el detalle de cada tarea y conservarlo todo al recargar. Por el camino usarás casi todas las piezas del kit.

> Requisitos: Node.js `^20.19.0` o `>=22.12.0`.

## Por qué signals-starter-kit

- **Sin dependencias en producción.** El framework son unos pocos archivos en `src/` que puedes leer de principio a fin. La plantilla entera compila a ~10,7 kB de JS (4,45 kB con gzip); la app de este tutorial, a ~14 kB.
- **Reactividad de grano fino.** Cuando un signal cambia, solo se actualiza el texto, la clase o el atributo que lo usa. Nada de diffing de un DOM virtual.
- **Limpieza automática.** Los effects que crea una página se liberan solos al cambiar de ruta: no hay fugas de memoria aunque navegues mil veces.
- **Seguro por defecto.** `innerHTML` está bloqueado para evitar XSS accidental; insertar HTML exige un `dangerouslySetInnerHTML` explícito.
- **Router incluido.** Rutas con parámetros, query reactiva y enlaces `<a>` normales que navegan sin recargar.
- **Probado.** El núcleo tiene más de 60 tests con Vitest, y tu código se prueba igual.
- **Tailwind 4 listo** para dar estilo con clases utilitarias.

## Lo que vas a construir

| Ruta | Qué muestra |
|---|---|
| `/tareas` | Formulario, filtros (`Todas`, `Pendientes`, `Hechas`) y la lista |
| `/tareas?filtro=pendientes` | La misma página, filtrada desde la URL |
| `/tareas/:id` | El detalle de una tarea |

Archivos que vas a crear:

```
src/
├── features/tareas/
│   ├── tareas.state.js      # 1. Estado
│   └── tareas.test.js       # 8. Tests
└── components/
    ├── tareas/
    │   ├── TareaItem.js     # 2. Una fila
    │   ├── ListaTareas.js   # 3. La lista
    │   ├── NuevaTarea.js    # 4. El formulario
    │   └── FiltrosTareas.js # 5. Los filtros
    └── pages/
        ├── TareasPage.js    # 6. La página
        └── TareaPage.js     # 7. El detalle
```

## 0. Consigue el kit

La forma más rápida desde la terminal:

```bash
npx degit marioacalderon16-dev/signals-starter-kit mi-app
cd mi-app
npm install
cp .env.example .env
```

¿Prefieres tener tu propio repositorio en GitHub desde el principio? Usa el botón **[Use this template](https://github.com/marioacalderon16-dev/signals-starter-kit/generate)** y clona el repo que se crea. Todas las opciones están en [Crea tu proyecto](../README.md#crea-tu-proyecto).

### Guarda tu proyecto en tu GitHub (opcional)

degit copia los archivos **sin historial ni conexión con ningún repositorio**: tu trabajo se queda solo en tu ordenador. No se guarda en el repo de signals-starter-kit (ni podrías: solo su creador tiene permiso de escritura). Para tenerlo en **tu** GitHub:

1. Inicia tu propio historial y haz el primer commit:

   ```bash
   git init
   git add .
   git commit -m "Proyecto inicial desde signals-starter-kit"
   git branch -M main
   ```

2. Crea un repositorio **vacío** en https://github.com/new (por ejemplo `mi-app`). No marques las opciones de añadir README, `.gitignore` ni licencia: el proyecto ya los trae.

3. Conéctalo y súbelo (cambia `TU-USUARIO` por tu usuario de GitHub):

   ```bash
   git remote add origin https://github.com/TU-USUARIO/mi-app.git
   git push -u origin main
   ```

A partir de aquí, guarda tu avance al terminar cada paso del tutorial:

```bash
git add .
git commit -m "Paso 1: estado de las tareas"
git push
```

> Si usaste **Use this template**, tu repo ya está en tu cuenta: salta este apartado y usa directamente `git add`, `git commit` y `git push`.

Arranca el servidor y déjalo corriendo: cada vez que guardes, verás los cambios.

```bash
npm run dev
```

## 1. El estado: signals y computed

Un **signal** guarda un valor y avisa a quien lo lea cuando cambia. Un **computed** es un valor derivado de otros signals que se recalcula solo.

Crea `src/features/tareas/tareas.state.js`:

```js
/**
 * src/features/tareas/tareas.state.js
 *
 * Estado y acciones de la lista de tareas
 */

import { signal, computed } from '@core/signal.js'
import { persist } from '@shared/utils/persist.js'
import { currentQuery } from '@features/router/router.state.js'

// - Estado -
export const tareas = signal([]) // [{ id, texto, hecha }]
persist('tareas', tareas)        // se guarda en localStorage y se recupera al recargar

// - Derivados -
export const filtro = computed(() => currentQuery.get().filtro ?? 'todas')

export const visibles = computed(() => {
  const lista = tareas.get()
  if (filtro.get() === 'pendientes') return lista.filter(t => !t.hecha)
  if (filtro.get() === 'hechas') return lista.filter(t => t.hecha)
  return lista
})

export const pendientes = computed(() => tareas.get().filter(t => !t.hecha).length)

// - Acciones (siempre un array nuevo: set() ignora el mismo objeto) -
export const agregar = (texto) => {
  tareas.set([...tareas.get(), { id: crypto.randomUUID(), texto, hecha: false }])
}

export const alternar = (id) => {
  tareas.set(tareas.get().map(t => (t.id === id ? { ...t, hecha: !t.hecha } : t)))
}

export const eliminar = (id) => {
  tareas.set(tareas.get().filter(t => t.id !== id))
}

export const buscar = (id) => tareas.get().find(t => t.id === id)
```

Fíjate en tres cosas:

1. **`persist('tareas', tareas)`** guarda el signal en `localStorage` en cada cambio y lo recupera al cargar. Una línea y tus tareas sobreviven a un recargo.
2. **`filtro` sale de la URL** con `currentQuery`, que el router mantiene actualizado. El filtro no es un estado aparte: es la propia URL, así que se puede compartir y funciona con el botón atrás.
3. **Las acciones crean siempre un array nuevo.** `set()` ignora el valor si es el mismo objeto (`Object.is`), así que `tareas.get().push(...)` no avisaría a nadie. Usa `[...lista]`, `map` o `filter`.

## 2. Un componente: `TareaItem`

Los componentes son funciones que devuelven un elemento del DOM. Se registran con `define` y se usan con `c('Nombre', props)`. Para crear elementos se usa `h(etiqueta, atributos, ...hijos)`.

Crea `src/components/tareas/TareaItem.js`:

```js
/**
 * src/components/tareas/TareaItem.js
 *
 * Una fila de la lista
 */

import { define } from '@components/Component.js'
import { h } from '@features/dom/dom.js'
import { alternar, eliminar } from '@features/tareas/tareas.state.js'

define('TareaItem', ({ tarea }) =>
  h('li', { className: 'flex items-center gap-3 py-2' },
    h('input', {
      type: 'checkbox',
      checked: tarea.hecha,
      className: 'rounded text-sky-600',
      onChange: () => alternar(tarea.id)
    }),
    h('a', {
      href: `/tareas/${tarea.id}`,
      className: { 'flex-1 hover:underline': true, 'line-through text-slate-400': tarea.hecha }
    }, tarea.texto),
    h('button', {
      className: 'text-sm text-red-600 hover:text-red-800',
      onClick: () => eliminar(tarea.id)
    }, 'Eliminar')
  )
)
```

- **Eventos:** `onChange`, `onClick`… (mayúscula tras `on`). Para nombres arbitrarios existe `on:mi-evento`.
- **`className` como objeto:** cada clave se aplica si su valor es verdadero. Aquí tachamos la tarea si está hecha.
- **Enlaces normales:** el `<a href="/tareas/...">` navega **sin recargar** la página. El router intercepta los clics en enlaces internos automáticamente.

No hace falta importar este archivo en ningún sitio: todo `.js` dentro de una subcarpeta de `src/components/` se registra solo.

## 3. Una lista reactiva con `define(..., true)`

Crea `src/components/tareas/ListaTareas.js`:

```js
/**
 * src/components/tareas/ListaTareas.js
 *
 * Lista reactiva: se vuelve a renderizar cuando cambia `visibles`
 */

import { define, c } from '@components/Component.js'
import { h } from '@features/dom/dom.js'
import { visibles } from '@features/tareas/tareas.state.js'

define('ListaTareas', () => {
  const lista = visibles.get() // leído en el cuerpo → re-render al cambiar

  if (lista.length === 0) {
    return h('p', { className: 'py-6 text-center text-slate-400' }, 'No hay tareas aquí.')
  }

  return h('ul', { className: 'divide-y divide-slate-200' },
    lista.map(tarea => c('TareaItem', { tarea }))
  )
}, true) // ← true: componente reactivo
```

El `true` final convierte el componente en **reactivo**: se vuelve a renderizar cuando cambia un signal leído directamente en su cuerpo (aquí, `visibles`). Por eso puedes usar un `if` normal para el estado vacío. Al re-renderizar, los effects de la versión anterior se liberan solos.

## 4. El formulario

Crea `src/components/tareas/NuevaTarea.js`:

```js
/**
 * src/components/tareas/NuevaTarea.js
 *
 * Formulario para añadir tareas
 */

import { define } from '@components/Component.js'
import { h } from '@features/dom/dom.js'
import { agregar } from '@features/tareas/tareas.state.js'

define('NuevaTarea', () => {
  const input = h('input', {
    type: 'text',
    placeholder: '¿Qué hay que hacer?',
    className: 'flex-1 rounded-lg border-slate-300'
  })

  return h('form', {
    className: 'flex gap-2',
    onSubmit: (event) => {
      event.preventDefault()
      const texto = input.value.trim()
      if (!texto) return
      agregar(texto)
      input.value = ''
    }
  },
    input,
    h('button', {
      type: 'submit',
      className: 'rounded-lg bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-700'
    }, 'Añadir')
  )
})
```

Como `h()` devuelve elementos reales del DOM, puedes guardar el `input` en una variable y leer `input.value` cuando lo necesites. No hay refs ni magia. El plugin `@tailwindcss/forms`, ya incluido, da estilo a los inputs.

## 5. Filtros en la URL

Crea `src/components/tareas/FiltrosTareas.js`:

```js
/**
 * src/components/tareas/FiltrosTareas.js
 *
 * Filtros que viven en la URL (?filtro=pendientes)
 */

import { define } from '@components/Component.js'
import { h } from '@features/dom/dom.js'
import { computed } from '@core/signal.js'
import { filtro, pendientes } from '@features/tareas/tareas.state.js'

const opciones = [
  { valor: 'todas', texto: 'Todas' },
  { valor: 'pendientes', texto: 'Pendientes' },
  { valor: 'hechas', texto: 'Hechas' }
]

define('FiltrosTareas', () =>
  h('nav', { className: 'flex items-center gap-4 text-sm' },
    h('span', { className: 'flex-1 text-slate-500' },
      computed(() => `${pendientes.get()} pendiente(s)`)
    ),
    opciones.map(({ valor, texto }) =>
      h('a', {
        href: `?filtro=${valor}`,
        className: {
          'text-slate-500 hover:text-slate-900': true,
          'font-semibold text-sky-700': computed(() => filtro.get() === valor)
        }
      }, texto)
    )
  )
)
```

Este componente **no es reactivo** y aun así se actualiza: los `computed` que pasas a `h()` mantienen al día solo lo que los usa.

- El texto `N pendiente(s)` es un `computed` usado como hijo: solo ese texto cambia.
- La clase del filtro activo es un `computed` dentro del objeto `className`.
- `href: '?filtro=pendientes'` es un enlace normal: cambia la query sin recargar y `currentQuery` (y con ella `filtro` y `visibles`) se actualiza sola.

## 6. La página y sus rutas

Crea `src/components/pages/TareasPage.js`:

```js
/**
 * src/components/pages/TareasPage.js
 *
 * Página /tareas
 */

import { define, c } from '@components/Component.js'
import { h } from '@features/dom/dom.js'

define('TareasPage', () =>
  h('main', { className: 'mx-auto max-w-lg space-y-4 p-6' },
    h('h1', { className: 'text-2xl font-bold text-slate-900' }, 'Mis tareas'),
    c('NuevaTarea'),
    c('FiltrosTareas'),
    c('ListaTareas')
  )
)
```

Y registra las dos rutas nuevas en `src/features/router/routes.config.js`, dentro del array `routes`:

```js
export const routes = [
  { 
    path: '/',
    component: 'InitialPage',
    name: 'initial'
  },
  { path: '/tareas', component: 'TareasPage', name: 'tareas' },
  { path: '/tareas/:id', component: 'TareaPage', name: 'tarea' }
]
```

Abre http://localhost:4321/tareas y añade unas tareas.

## 7. El detalle: parámetros de ruta y `onCleanup`

Crea `src/components/pages/TareaPage.js`:

```js
/**
 * src/components/pages/TareaPage.js
 *
 * Página /tareas/:id
 */

import { define } from '@components/Component.js'
import { h } from '@features/dom/dom.js'
import { onCleanup } from '@core/signal.js'
import { buscar } from '@features/tareas/tareas.state.js'

define('TareaPage', ({ params }) => {
  const tarea = buscar(params.id)

  // Cambia el título de la pestaña y lo restaura al salir de la página
  const tituloAnterior = document.title
  document.title = tarea ? tarea.texto : 'Tarea no encontrada'
  onCleanup(() => { document.title = tituloAnterior })

  return h('main', { className: 'mx-auto max-w-lg space-y-4 p-6' },
    h('a', { href: '/tareas', className: 'text-sm text-sky-700 hover:underline' }, '← Volver'),
    tarea
      ? h('div', { className: 'rounded-xl bg-white p-6 shadow' },
          h('h1', { className: 'text-xl font-bold' }, tarea.texto),
          h('p', { className: 'mt-2 text-slate-500' }, tarea.hecha ? '✅ Hecha' : '⏳ Pendiente')
        )
      : h('p', { className: 'text-slate-500' }, 'Esa tarea no existe.')
  )
})
```

- El router pasa los parámetros de la ruta en `props.params`, **ya decodificados**: `params.id` es el `:id` de `/tareas/:id`.
- **`onCleanup`** registra una limpieza que se ejecuta cuando la página se desmonta. Aquí restaura el título de la pestaña al volver. Úsalo también para quitar listeners de `window`, parar un `setInterval`, etc.
- El enlace `← Volver` es otro `<a>` normal.

## Pruébalo

En http://localhost:4321/tareas comprueba que:

- [ ] Al añadir una tarea, aparece en la lista y el input se vacía.
- [ ] Al marcar una tarea, se tacha y el contador de pendientes baja.
- [ ] Los filtros cambian la URL (`?filtro=hechas`) sin recargar la página, y el botón atrás deshace el filtro.
- [ ] Al pulsar una tarea, el título de la pestaña cambia; al volver, se restaura.
- [ ] `/tareas/no-existe` muestra "Esa tarea no existe."
- [ ] Al recargar la página, las tareas siguen ahí.

## 8. Tests

Como el estado vive en su propio módulo, se prueba sin tocar el DOM. Crea `src/features/tareas/tareas.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest'
import { tareas, pendientes, visibles, agregar, alternar, eliminar } from './tareas.state.js'
import { navigate } from '@features/router/router.state.js'

describe('tareas', () => {
  beforeEach(() => {
    tareas.set([])
    navigate('/tareas')
  })

  it('agregar, alternar y eliminar', () => {
    agregar('Comprar pan')
    agregar('Estudiar signals')
    expect(pendientes.get()).toBe(2)

    const [primera] = tareas.get()
    alternar(primera.id)
    expect(pendientes.get()).toBe(1)

    eliminar(primera.id)
    expect(tareas.get().map(t => t.texto)).toEqual(['Estudiar signals'])
  })

  it('el filtro sale de la URL', () => {
    agregar('A')
    agregar('B')
    alternar(tareas.get()[0].id)

    navigate('/tareas?filtro=hechas')
    expect(visibles.get().map(t => t.texto)).toEqual(['A'])

    navigate('/tareas?filtro=pendientes')
    expect(visibles.get().map(t => t.texto)).toEqual(['B'])
  })
})
```

```bash
npm test
```

Vitest usa la misma configuración que Vite (alias incluidos) y jsdom para simular el navegador, así que `localStorage`, `history` y el router funcionan dentro de los tests.

## 9. Build de producción

```bash
npm run build
npm run preview
```

`npm run build` genera `dist/`, listo para subir a cualquier hosting estático. Como es una SPA con rutas en la History API, configura el hosting para que sirva `index.html` en cualquier ruta (en Netlify, Vercel o Cloudflare Pages suele llamarse *SPA fallback* o *rewrites*).

## Chuleta y trampas comunes

| Quieres… | Usa |
|---|---|
| Un valor que cambia | `signal(valor)` → `.get()` / `.set(nuevo)` |
| Un valor derivado | `computed(() => ...)` |
| Ejecutar algo al cambiar | `effect(() => ...)` (devuelve `dispose`) |
| Leer sin suscribirte | `untrack(() => s.get())` |
| Varios cambios, una notificación | `Batch.run(() => { a.set(1); b.set(2) })` |
| Limpiar al desmontar | `onCleanup(() => ...)` |
| Texto/clase/atributo reactivo | Pasa el signal o un `computed` a `h()` |
| Re-renderizar un bloque entero | `define('Nombre', fn, true)` |
| Navegar desde código | `navigate('/ruta')` |
| Leer la query | `currentQuery.get()` |
| HTML de confianza | `dangerouslySetInnerHTML: '<b>hola</b>'` |

**Trampas:**

- **Mutar en lugar de reemplazar:** `lista.get().push(x)` no notifica. Haz `lista.set([...lista.get(), x])`.
- **Leer `.get()` en el cuerpo de un componente no reactivo:** el valor queda congelado. Pasa el signal (o un `computed`) a `h()`, o marca el componente con `true`.
- **`innerHTML`:** se ignora con un aviso en consola. Es intencionado.
- **Hijos junto a `textContent`:** se ignoran (con aviso). Usa uno u otro.

## Siguientes pasos

- Explora las [recetas](RECETAS.md): siete ejemplos cortos (formulario con validación, datos de una API, reloj, tema oscuro, rutas con params…).
- Conecta una API real con `HttpClient` (`src/core/httpClient.js`): soporta timeout, cancelación con `AbortSignal` y errores con `status`.
- Lee los tests de `src/core/` y `src/features/` como documentación ejecutable de cada pieza.
- Repasa el [README](../README.md) para la referencia de todas las APIs.
