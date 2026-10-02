# Recetas: lo que puedes hacer con signals-starter-kit

Siete ejemplos cortos e independientes, cada uno con un caso distinto. Todos usan las mismas tres piezas (`signal`, `computed` y `h()`) más alguna utilidad del kit, y todo se importa desde un único sitio: `import { … } from '@kit'`. Cópialos tal cual: no necesitan dependencias extra.

| # | Receta | Lo que demuestra |
|---|---|---|
| 1 | [Contador](#1-contador) | `signal` + `computed`, lo mínimo |
| 2 | [Mostrar / ocultar](#2-mostrar--ocultar) | Estado local y renderizado condicional con `Show` |
| 3 | [Formulario con validación en vivo](#3-formulario-con-validación-en-vivo) | `bind:value`, validar con `computed`, botón deshabilitado reactivo |
| 4 | [Datos de una API](#4-datos-de-una-api) | `resource` + `HttpClient`: carga, error, recarga y cancelación |
| 5 | [Reloj](#5-reloj) | Temporizadores limpiados con `onCleanup` |
| 6 | [Tema claro / oscuro](#6-tema-claro--oscuro) | `persist` + `effect` sobre el documento |
| 7 | [Ruta con parámetros](#7-ruta-con-parámetros) | `Link`, `generateUrl`, `title` y `params` decodificados |

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

import { signal, computed } from '@kit'

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

import { define, h, computed } from '@kit'

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
import { define, h, signal, computed, Show } from '@kit'

define('MostrarOcultar', () => {
  const abierto = signal(false) // estado local: cada instancia tiene el suyo

  return h('div', { className: 'space-y-2' },
    h('button', {
      className: 'rounded-lg bg-slate-100 px-3 py-2 font-medium hover:bg-slate-200',
      onClick: () => abierto.set(!abierto.get())
    }, computed(() => (abierto.get() ? 'Ocultar detalles' : 'Mostrar detalles'))),

    Show(abierto, () => h('p', { className: 'text-slate-600' },
      'Este párrafo solo existe en el DOM mientras está abierto.'
    ))
  )
})
```

- Un signal creado **dentro** del componente es estado local: cada `c('MostrarOcultar')` tiene el suyo.
- `Show(condición, vista)` pinta la vista solo mientras la condición es verdadera (como `v-if` o `{cond && <p/>}`). Al ocultarse, sus effects se liberan. Acepta una tercera función para la alternativa.

## 3. Formulario con validación en vivo

```js
// src/components/recetas/FormularioEmail.js
import { define, h, signal, computed, Show } from '@kit'

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
      'bind:value': email // input ↔ signal
    }),
    h('p', { className: 'text-sm text-red-600' },
      computed(() => (email.get() && !valido.get() ? 'Ese email no parece válido.' : ''))
    ),
    h('button', {
      type: 'submit',
      disabled: computed(() => !valido.get()),
      className: 'rounded-lg bg-sky-600 px-4 py-2 font-medium text-white disabled:opacity-50'
    }, 'Suscribirme'),
    Show(enviado, () => h('p', { className: 'text-green-700' }, computed(() => `¡Gracias, ${email.get()}!`)))
  )
})
```

- `'bind:value': email` enlaza el input y el signal en los dos sentidos: al escribir se actualiza `email`, y `valido` se recalcula solo, y con él el mensaje de error y el `disabled` del botón.
- Cualquier atributo acepta un `computed`: aquí `disabled`. Lo mismo vale para `className`, `title`, `value`…

## 4. Datos de una API

Usa [JSONPlaceholder](https://jsonplaceholder.typicode.com), una API pública de prueba.

```js
// src/components/recetas/ListaUsuarios.js
import { define, h, computed, Show, For, resource, HttpClient } from '@kit'

const api = new HttpClient({ baseUrl: 'https://jsonplaceholder.typicode.com', timeout: 5000 })

define('ListaUsuarios', () => {
  // resource: carga, error y cancelación (al desmontar o al recargar) incluidos
  const usuarios = resource((_, { signal }) => api.get('/users', {}, { signal }))

  return h('div', { className: 'space-y-2' },
    Show(usuarios.loading, () => h('p', { className: 'text-slate-500' }, 'Cargando…')),
    Show(usuarios.error, () => h('p', { className: 'text-red-600' }, computed(() => `Error: ${usuarios.error.get()?.message}`))),
    h('ul', { className: 'list-disc pl-5' },
      For(() => usuarios.data.get() ?? [], u => u.id, u => h('li', {}, u.name))
    ),
    h('button', { className: 'text-sm text-sky-700 hover:underline', onClick: usuarios.refetch }, 'Recargar')
  )
})
```

- `resource(fetcher)` te da `loading`, `data` y `error` como signals, y `refetch()` para volver a pedir. No hay que escribir `AbortController` ni `.then/.catch`.
- La petición se **cancela sola** si sales de la página antes de que llegue la respuesta, o si pulsas "Recargar" mientras carga.
- Al recargar (o si falla), `data` conserva los datos anteriores: la lista no parpadea.
- `HttpClient` aplica el `timeout` y, si la respuesta no es 2xx, lanza un error con `status` y el cuerpo en `data`.
- Si la petición depende de otro signal (un id, un texto de búsqueda), pásalo como fuente: `resource(() => id.get(), (id, { signal }) => …)`. Se vuelve a pedir solo cuando cambia.

## 5. Reloj

```js
// src/components/recetas/Reloj.js
import { define, h, signal, computed, onCleanup } from '@kit'

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
import { signal, effect, persist } from '@kit'

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
import { define, h, computed } from '@kit'
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
{ path: '/saludo/:nombre', component: 'SaludoPage', name: 'saludo', title: ({ params }) => `Hola, ${params.nombre}` }
```

Y crea la página:

```js
// src/components/pages/SaludoPage.js
import { define, h, Link } from '@kit'
import { generateUrl } from '@features/router/routes.config.js'

define('SaludoPage', ({ params }) =>
  h('main', { className: 'mx-auto max-w-lg space-y-4 p-6' },
    h('h1', { className: 'text-2xl font-bold' }, `¡Hola, ${params.nombre}!`), // ya decodificado
    Link({
      to: generateUrl('saludo', { nombre: 'Ana López' }), // → /saludo/Ana%20L%C3%B3pez
      className: 'text-sky-700 hover:underline'
    }, 'Saludar a Ana López')
  )
)
```

- `generateUrl` construye la URL por el **nombre** de la ruta y codifica los valores (`Ana López` → `Ana%20L%C3%B3pez`).
- El router **decodifica** los params antes de pasarlos: la página recibe `Ana López` tal cual.
- `Link` crea el enlace (navega sin recargar y añade la base de despliegue si la hay).
- `title` pone el título de la pestaña: visitar `/saludo/Mundo` muestra "¡Hola, Mundo!" y la pestaña dice "Hola, Mundo · …".

## Pruébalas todas en una página

```js
// src/components/pages/RecetasPage.js
import { define, h, c, Link } from '@kit'

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
    tarjeta('Ruta con params', Link({ to: '/saludo/Mundo', className: 'text-sky-700' }, '/saludo/Mundo'))
  )
)
```

Añade la ruta junto a la de la receta 7:

```js
{ path: '/recetas', component: 'RecetasPage', name: 'recetas', title: 'Recetas' }
```

Abre http://localhost:4321/recetas.

## ¿Y ahora?

- Combina recetas: el formulario (3) puede enviar los datos con el `HttpClient` de la receta 4.
- Para una app completa paso a paso, sigue el [tutorial de inicio rápido](QUICKSTART.md).
- La referencia de todas las APIs está en el [README](../README.md).
