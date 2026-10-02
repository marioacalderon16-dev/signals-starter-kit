# signals-starter-kit

Starter kit para construir SPAs en JavaScript vanilla con un mini-framework reactivo propio: **signals**, una función `h()` para crear DOM, componentes registrados por nombre y un router basado en la History API. Sin React ni Vue: todo el framework son unos pocos archivos que puedes leer y modificar.

Incluye una demo (tarjeta del clima) y 65 tests.

👉 **¿Empiezas?** Sigue el [tutorial de inicio rápido](docs/QUICKSTART.md): construyes una lista de tareas paso a paso en unos 20 minutos.

## Stack

- [Vite 7](https://vite.dev): servidor de desarrollo y build
- [Tailwind CSS 4](https://tailwindcss.com) con los plugins `forms` y `typography`
- [Vitest](https://vitest.dev) + jsdom para los tests

## Requisitos

Node.js `^20.19.0` o `>=22.12.0` (lo exige Vite 7).

## Crea tu proyecto

Elige una de estas formas de obtener el kit (cambia `mi-app` por el nombre de tu proyecto).

**Opción A — Plantilla de GitHub (recomendada).** Pulsa **[Use this template](https://github.com/marioacalderon16-dev/signals-starter-kit/generate)** en la página del repo. GitHub crea un repositorio nuevo en tu cuenta con una copia limpia, sin el historial de este. Después clónalo:

```bash
git clone https://github.com/TU-USUARIO/mi-app.git
cd mi-app
```

**Opción B — degit (solo terminal, sin historial de git).**

```bash
npx degit marioacalderon16-dev/signals-starter-kit mi-app
cd mi-app
git init
```

**Opción C — git clone.** Clona y empieza un historial propio (si no, tu proyecto seguiría apuntando a este repo):

```bash
git clone https://github.com/marioacalderon16-dev/signals-starter-kit.git mi-app
cd mi-app
rm -rf .git
git init
```

**Opción D — ZIP.** En GitHub, *Code → Download ZIP* y descomprímelo.

## Puesta en marcha

Dentro de la carpeta del proyecto:

```bash
npm install
cp .env.example .env
npm run dev
```

La app se abre en http://localhost:4321. Cambia `"name"` en `package.json` y `VITE_APP_NAME` en `.env` por el nombre de tu app.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo en el puerto 4321 (`npm run dev -- --host` lo expone en tu red local) |
| `npm run build` | Build de producción en `dist/` |
| `npm run preview` | Sirve el build de `dist/` |
| `npm test` | Ejecuta los tests una vez |
| `npm run test:watch` | Tests en modo watch |

## Variables de entorno

Definidas en `.env` (no se versiona; usa `.env.example` como plantilla):

| Variable | Uso |
|---|---|
| `VITE_APP_NAME` | Título de la página |
| `VITE_APP_VERSION` | Versión de la app |
| `VITE_DEV_MODE` | Activa el modo desarrollo del logger |
| `VITE_LOG_LEVEL` | `TRACE`, `DEBUG`, `INFO`, `WARN`, `ERROR` o `SILENT` |

## Estructura

```
src/
├── main.js                  # Punto de entrada: monta el componente App en #app
├── style.css                # Tailwind
├── config/app.js            # Configuración leída de .env
├── core/
│   ├── signal.js            # Reactividad: signal, computed, effect, Batch, untrack, createRoot, onCleanup
│   └── httpClient.js        # Cliente HTTP sobre fetch (timeout, AbortSignal, errores con status)
├── components/
│   ├── Component.js         # define, c, render, renderApp
│   ├── App.js, Router.js    # Componente raíz y router
│   ├── index.js             # Autoregistra los componentes de todas las subcarpetas
│   ├── pages/               # Páginas (una por ruta)
│   └── weather/             # Componentes de la demo
├── features/
│   ├── dom/dom.js           # h(), fragment, bindings reactivos
│   ├── router/              # Estado, utilidades y tabla de rutas
│   └── weather/             # Estado de la demo
└── shared/utils/            # logger, persist (signals en localStorage)
```

Alias de importación: `@` (src), `@core`, `@components`, `@features`, `@shared`.

## Conceptos

### Signals

```js
import { signal, computed, effect } from '@core/signal.js'

const contador = signal(0)
const doble = computed(() => contador.get() * 2)

const dispose = effect(() => {
  console.log(`contador=${contador.get()} doble=${doble.get()}`)
})

contador.set(1) // el effect se vuelve a ejecutar en la siguiente microtask
dispose()       // detiene el effect
```

- `effect()` devuelve una función `dispose`. Si la función del effect devuelve otra función, se usa como limpieza.
- `onCleanup(fn)` registra una limpieza en el effect o root actual.
- `untrack(fn)` lee signals sin suscribirse.
- `Batch.run(fn)` agrupa varios cambios en una sola notificación.
- Los effects creados dentro de otro effect (o de un `createRoot`) se liberan automáticamente cuando su dueño se re-ejecuta o se destruye.

### Crear DOM con `h()`

```js
import { h } from '@features/dom/dom.js'

h('button', {
  className: 'rounded bg-sky-600 px-4 py-2 text-white',
  disabled: cargando,          // signal → se actualiza solo
  onClick: () => contador.set(contador.get() + 1),
}, 'Clics: ', contador)        // signal como hijo → texto reactivo
```

- Eventos: `onClick` (mayúscula tras `on`) u `on:evento` para nombres arbitrarios.
- Hijos `false`, `true`, `null` y `undefined` no se pintan, así que funciona `cond && h(...)`.
- Un signal hijo puede contener texto o un nodo DOM.
- `innerHTML` está bloqueado para evitar XSS. Para insertar HTML de confianza usa `dangerouslySetInnerHTML`.

### Componentes

```js
import { define, c } from '@components/Component.js'

define('Saludo', ({ nombre }) => h('p', {}, `Hola, ${nombre}`))

h('div', {}, c('Saludo', { nombre: 'Ana' }))
```

Cualquier archivo `.js` dentro de una subcarpeta de `src/components/` se registra automáticamente (los `*.test.js` se excluyen).

`define(nombre, fn, true)` crea un componente reactivo: se vuelve a renderizar cuando cambia un signal leído directamente en su cuerpo. Los signals pasados a `h()` se actualizan solos, sin re-render.

### Router

Las rutas se declaran en `src/features/router/routes.config.js`:

```js
export const routes = [
  { path: '/', component: 'InitialPage', name: 'initial' },
  { path: '/products/:id', component: 'ProductPage', name: 'product' },
]
```

La página recibe los parámetros como `props.params` (ya decodificados):

```js
define('ProductPage', ({ params }) => h('h1', {}, `Producto ${params.id}`))
```

Para navegar:

```js
import { navigate, currentQuery } from '@features/router/router.state.js'

navigate('/products/7?color=rojo')
currentQuery.get() // { color: 'rojo' } — reactivo
```

- Los enlaces internos `<a href="/...">` navegan sin recargar la página. Los externos, `target="_blank"`, `download` y los clics con modificadores (Ctrl/Cmd…) se dejan al navegador.
- Las rutas ignoran la query, el hash y la barra final: `/products/7/?x=1` coincide con `/products/:id`.
- `generateUrl('product', { id: 7 })` construye la URL de una ruta por su nombre.

## Convenciones

- Estado de cada funcionalidad en `src/features/<nombre>/<nombre>.state.js`.
- Componentes en `src/components/<carpeta>/`, registrados con `define('NombreEnPascalCase', fn)`.
- Tests junto al código que prueban, con el sufijo `.test.js`.
- Código y comentarios en español, sin punto y coma.
