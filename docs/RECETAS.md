# Recetas: lo que puedes hacer con signals-starter-kit

Siete ejemplos cortos e independientes, cada uno con un caso distinto. Todos usan las mismas tres piezas (`signal`, `computed` y `h()`) más alguna utilidad del kit. Cópialos tal cual: no necesitan dependencias extra.

| # | Receta | Lo que demuestra |
|---|---|---|
| 1 | [Contador](#1-contador) | `signal` + `computed`, lo mínimo |
| 2 | [Mostrar / ocultar](#2-mostrar--ocultar) | Estado local y renderizado condicional |
| 3 | [Formulario con validación en vivo](#3-formulario-con-validación-en-vivo) | Validar con `computed`, botón deshabilitado reactivo |
| 4 | [Datos de una API](#4-datos-de-una-api) | `HttpClient`, estados de carga y error, cancelación |
| 5 | [Reloj](#5-reloj) | Temporizadores limpiados con `onCleanup` |
| 6 | [Tema claro / oscuro](#6-tema-claro--oscuro) | `persist` + `effect` sobre el documento |
| 7 | [Ruta con parámetros](#7-ruta-con-parámetros) | `generateUrl` y `params` decodificados |

**Cómo usarlas:** guarda cada componente en `src/components/recetas/` (se registra solo) y muéstralo desde cualquier página con `c('NombreDelComponente')`. Al final tienes una [página para probarlas todas](#pruébalas-todas-en-una-página).

> ¿Aún no tienes el kit? Empieza por el paso 0 del [tutorial de inicio rápido](QUICKSTART.md#0-consigue-el-kit).

## 1. Contador

Ya viene en el kit: lo ves en la página de inicio, en "Demo en vivo". El estado vive en su propio módulo:

```js
// src/features/contador/contador.state.js
/**
 * src/features/contador/contador.state.js
 *
 * Ejemplo básico: un signal, un computed y tres acciones
 */

import { signal, computed } from '@core/signal.js'

// - Estado -
export const contador = signal(0)

// - Valor derivado: se recalcula solo cuando cambia `contador` -
export const doble = computed(() => contador.get() * 2)

// - Acciones -
export const incrementar = () => contador.set(contador.get() + 1)
export const decrementar = () => contador.set(contador.get() - 1)
export const reiniciar = () => contador.set(0)
```

Y el componente pasa el signal y el `computed` directamente a `h()`:

```js
// src/components/contador/Contador.js
/**
 * src/components/contador/Contador.js
 *
 * Componente contador (ejemplo básico)
 */

import { define } from '@components/Component.js'
import { h } from '@features/dom/dom.js'
import { computed } from '@core/signal.js'

import { contador, doble, incrementar, decrementar, reiniciar } from '@features/contador/contador.state.js'

const boton = (texto, label, onClick) =>
    h('button', {
        className: 'flex-1 rounded-lg bg-slate-100 px-3 py-2 font-medium text-slate-700 transition hover:bg-slate-200',
        'aria-label': label,
        onClick
    }, texto)

define('Contador', () =>
    h('div', { className: 'w-72 rounded-2xl bg-white p-6 text-center shadow-lg ring-1 ring-slate-200' },
        h('span', { className: 'text-sm font-medium uppercase tracking-wide text-slate-500' }, 'Contador'),
        h('div', { className: 'mt-2 text-6xl font-bold text-slate-900' }, contador), // <- signal directo
        h('p', { className: 'mt-1 text-lg text-slate-600' }, computed(() => `Doble: ${doble.get()}`)), // <- computed
        h('div', { className: 'mt-6 flex gap-2' },
            boton('−', 'Restar uno', decrementar),
            boton('Reiniciar', 'Reiniciar', reiniciar),
            boton('+', 'Sumar uno', incrementar)
        )
    )
)
```

- Pasar `contador` (el signal) a `h()` hace que **solo ese texto** se actualice al cambiar. El componente no se vuelve a ejecutar.
- `doble` nunca se asigna a mano: se deriva solo.

## 2. Mostrar / ocultar

```js
// src/components/recetas/MostrarOcultar.js
import { define } from '@components/Component.js'
import { h } from '@features/dom/dom.js'
import { signal, computed } from '@core/signal.js'

define('MostrarOcultar', () => {
  const abierto = signal(false) // estado local: cada instancia tiene el suyo

  return h('div', { className: 'space-y-2' },
    h('button', {
      className: 'rounded-lg bg-slate-100 px-3 py-2 font-medium hover:bg-slate-200',
      onClick: () => abierto.set(!abierto.get())
    }, computed(() => (abierto.get() ? 'Ocultar detalles' : 'Mostrar detalles'))),

    // false → no se pinta nada; un nodo → se inserta
    computed(() => abierto.get() && h('p', { className: 'text-slate-600' },
      'Este párrafo solo existe en el DOM mientras está abierto.'
    ))
  )
})
```

- Un signal creado **dentro** del componente es estado local: cada `c('MostrarOcultar')` tiene el suyo.
- Un `computed` puede devolver un **nodo** o `false`. Con `false` no se pinta nada, así que `cond && h(...)` sirve como `v-if` o `{cond && <p/>}`.

## 3. Formulario con validación en vivo

```js
// src/components/recetas/FormularioEmail.js
import { define } from '@components/Component.js'
import { h } from '@features/dom/dom.js'
import { signal, computed } from '@core/signal.js'

define('FormularioEmail', () => {
  const email = signal('')
  const enviado = signal(false)
  const valido = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.get()))

  return h('form', {
    className: 'space-y-2',
    onSubmit: (event) => {
      event.preventDefault()
      enviado.set(true)
    }
  },
    h('input', {
      type: 'email',
      placeholder: 'tu@email.com',
      className: 'w-full rounded-lg border-slate-300 text-slate-900',
      onInput: (event) => email.set(event.target.value)
    }),
    h('p', { className: 'text-sm text-red-600' },
      computed(() => (email.get() && !valido.get() ? 'Ese email no parece válido.' : ''))
    ),
    h('button', {
      type: 'submit',
      disabled: computed(() => !valido.get()),
      className: 'rounded-lg bg-sky-600 px-4 py-2 font-medium text-white disabled:opacity-50'
    }, 'Suscribirme'),
    computed(() => enviado.get() && h('p', { className: 'text-green-700' }, `¡Gracias, ${email.get()}!`))
  )
})
```

- `onInput` actualiza el signal en cada tecla. `valido` se recalcula solo, y con él el mensaje de error y el `disabled` del botón.
- Cualquier atributo acepta un `computed`: aquí `disabled`. Lo mismo vale para `className`, `title`, `value`…

## 4. Datos de una API

Usa [JSONPlaceholder](https://jsonplaceholder.typicode.com), una API pública de prueba.

```js
// src/components/recetas/ListaUsuarios.js
import { define } from '@components/Component.js'
import { h } from '@features/dom/dom.js'
import { signal, computed, onCleanup } from '@core/signal.js'
import { HttpClient } from '@core/httpClient.js'

const api = new HttpClient({ baseUrl: 'https://jsonplaceholder.typicode.com', timeout: 5000 })

define('ListaUsuarios', () => {
  const estado = signal({ cargando: true, error: null, usuarios: [] })

  // Si el componente se desmonta antes de que llegue la respuesta, se cancela la petición
  const controller = new AbortController()
  onCleanup(() => controller.abort())

  api.get('/users', {}, { signal: controller.signal })
    .then(usuarios => estado.set({ cargando: false, error: null, usuarios }))
    .catch(error => {
      if (error.name !== 'AbortError') estado.set({ cargando: false, error, usuarios: [] })
    })

  return h('div', {}, computed(() => {
    const { cargando, error, usuarios } = estado.get()
    if (cargando) return h('p', { className: 'text-slate-500' }, 'Cargando…')
    if (error) return h('p', { className: 'text-red-600' }, `Error: ${error.message}`)
    return h('ul', { className: 'list-disc pl-5' }, usuarios.map(u => h('li', {}, u.name)))
  }))
})
```

- Un único signal con `{ cargando, error, usuarios }` y un `computed` que devuelve el nodo adecuado para cada estado.
- `HttpClient` aplica el `timeout` y, si la respuesta no es 2xx, lanza un error con `status` y el cuerpo en `data`.
- `onCleanup` + `AbortController`: si sales de la página antes de que llegue la respuesta, la petición se cancela.

## 5. Reloj

```js
// src/components/recetas/Reloj.js
import { define } from '@components/Component.js'
import { h } from '@features/dom/dom.js'
import { signal, computed, onCleanup } from '@core/signal.js'

define('Reloj', () => {
  const ahora = signal(new Date())

  const id = setInterval(() => ahora.set(new Date()), 1000)
  onCleanup(() => clearInterval(id)) // al salir de la página, el intervalo se detiene

  return h('p', { className: 'font-mono text-2xl' },
    computed(() => ahora.get().toLocaleTimeString())
  )
})
```

- Todo lo que el componente "enciende" (intervalos, listeners de `window`, sockets…) se apaga en `onCleanup`. El kit lo llama solo al cambiar de ruta, así que no quedan intervalos huérfanos.

## 6. Tema claro / oscuro

Primero, activa el modo oscuro por clase en `src/style.css`, debajo de los `@plugin`:

```css
/* Modo oscuro por clase: las utilidades dark: se activan con <html class="dark"> */
@custom-variant dark (&:where(.dark, .dark *));
```

El estado, con persistencia:

```js
// src/features/tema/tema.state.js
import { signal, effect } from '@core/signal.js'
import { persist } from '@shared/utils/persist.js'

export const tema = signal('claro')
persist('tema', tema) // recuerda la elección entre visitas

// Aplica la clase .dark en <html> cada vez que cambia el tema
effect(() => {
  document.documentElement.classList.toggle('dark', tema.get() === 'oscuro')
})

export const alternarTema = () => tema.set(tema.get() === 'oscuro' ? 'claro' : 'oscuro')
```

Y el botón:

```js
// src/components/recetas/BotonTema.js
import { define } from '@components/Component.js'
import { h } from '@features/dom/dom.js'
import { computed } from '@core/signal.js'
import { tema, alternarTema } from '@features/tema/tema.state.js'

define('BotonTema', () =>
  h('button', {
    className: 'rounded-lg bg-slate-100 px-3 py-2 font-medium text-slate-900 dark:bg-slate-700 dark:text-white',
    onClick: alternarTema
  }, computed(() => (tema.get() === 'oscuro' ? '☀️ Modo claro' : '🌙 Modo oscuro')))
)
```

- `persist` guarda el tema en `localStorage`: al recargar, se recupera.
- Un `effect` es la forma de sincronizar un signal con **algo fuera de tu componente**, aquí la clase de `<html>`.
- Solo cambian los elementos que tienen clases `dark:`. Añádelas donde quieras soporte de modo oscuro.

## 7. Ruta con parámetros

Registra la ruta en `src/features/router/routes.config.js`:

```js
{ path: '/saludo/:nombre', component: 'SaludoPage', name: 'saludo' }
```

Y crea la página:

```js
// src/components/pages/SaludoPage.js
import { define } from '@components/Component.js'
import { h } from '@features/dom/dom.js'
import { generateUrl } from '@features/router/routes.config.js'

define('SaludoPage', ({ params }) =>
  h('main', { className: 'mx-auto max-w-lg space-y-4 p-6' },
    h('h1', { className: 'text-2xl font-bold' }, `¡Hola, ${params.nombre}!`), // ya decodificado
    h('a', {
      href: generateUrl('saludo', { nombre: 'Ana López' }), // → /saludo/Ana%20L%C3%B3pez
      className: 'text-sky-700 hover:underline'
    }, 'Saludar a Ana López')
  )
)
```

- `generateUrl` construye la URL por el **nombre** de la ruta y codifica los valores (`Ana López` → `Ana%20L%C3%B3pez`).
- El router **decodifica** los params antes de pasarlos: la página recibe `Ana López` tal cual.
- Visitar `/saludo/Mundo` muestra "¡Hola, Mundo!".

## Pruébalas todas en una página

```js
// src/components/pages/RecetasPage.js
import { define, c } from '@components/Component.js'
import { h } from '@features/dom/dom.js'

const tarjeta = (titulo, contenido) =>
  h('section', { className: 'rounded-xl bg-white p-5 shadow ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-100' },
    h('h2', { className: 'mb-3 font-semibold' }, titulo), contenido)

define('RecetasPage', () =>
  h('main', { className: 'mx-auto grid max-w-3xl gap-4 p-6 sm:grid-cols-2' },
    tarjeta('Contador', c('Contador')),
    tarjeta('Mostrar / ocultar', c('MostrarOcultar')),
    tarjeta('Formulario', c('FormularioEmail')),
    tarjeta('API', c('ListaUsuarios')),
    tarjeta('Reloj', c('Reloj')),
    tarjeta('Tema', c('BotonTema')),
    tarjeta('Ruta con params', h('a', { href: '/saludo/Mundo', className: 'text-sky-700' }, '/saludo/Mundo'))
  )
)
```

Añade la ruta junto a la de la receta 7:

```js
{ path: '/recetas', component: 'RecetasPage', name: 'recetas' }
```

Abre http://localhost:4321/recetas.

## ¿Y ahora?

- Combina recetas: el formulario (3) puede enviar los datos con el `HttpClient` de la receta 4.
- Para una app completa paso a paso, sigue el [tutorial de inicio rápido](QUICKSTART.md).
- La referencia de todas las APIs está en el [README](../README.md).
