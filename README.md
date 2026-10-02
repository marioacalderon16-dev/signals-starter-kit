# signals-starter-kit

Starter kit para construir SPAs en JavaScript vanilla con un mini-framework reactivo propio: **signals**, una función `h()` para crear DOM, componentes registrados por nombre y un router basado en la History API. Sin React ni Vue: todo el framework son unos pocos archivos que puedes leer y modificar.

> **Versión 2.0.** Si vienes de la 1.x, la migración es una línea en `main.js`: mira el [CHANGELOG](CHANGELOG.md). La 1.x sigue disponible con la etiqueta `v1.0.0`.

Incluye una página de presentación con dos ejemplos en vivo (un contador básico y una tarjeta del clima) y 68 tests.

👉 **¿Empiezas?** Sigue el [tutorial de inicio rápido](docs/QUICKSTART.md): construyes una lista de tareas paso a paso en unos 20 minutos. ¿Quieres ver de qué es capaz? Mira las [recetas](docs/RECETAS.md): siete ejemplos cortos, de un formulario con validación a datos de una API o un tema oscuro. Y cuando quieras algo de nivel profesional, el [tutorial del panel de administración](docs/TUTORIAL-PANEL.md) cubre login, rutas protegidas, CRUD, tests, CI y despliegue en GitHub Pages.

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
| `npm run new …` | Genera páginas, componentes y features (ver [Generador de código](#generador-de-código)) |

## Variables de entorno

Definidas en `.env` (no se versiona; usa `.env.example` como plantilla):

| Variable | Uso |
|---|---|
| `VITE_APP_NAME` | Título de la página |
| `VITE_APP_VERSION` | Versión de la app |
| `VITE_DEV_MODE` | Activa el modo desarrollo del logger |
| `VITE_LOG_LEVEL` | `TRACE`, `DEBUG`, `INFO`, `WARN`, `ERROR` o `SILENT` |
| `VITE_DEVTOOLS` | Pon `false` para ocultar el [panel de devtools](#devtools) en desarrollo |

## Estructura

```
src/
├── main.js                  # Punto de entrada: registra las rutas y monta App en #app
├── kit.js                   # API pública del kit: import { … } from '@kit'
├── style.css                # Tailwind
├── config/app.js            # Configuración leída de .env
├── core/
│   ├── signal.js            # Reactividad: signal, computed, effect, Batch, untrack, createRoot, onCleanup, getOwner
│   ├── resource.js          # resource(): datos asíncronos con carga, error y cancelación
│   └── httpClient.js        # Cliente HTTP sobre fetch (timeout, AbortSignal, errores con status)
├── components/
│   ├── Component.js         # define, c, render, renderApp
│   ├── App.js, Router.js    # Componente raíz y router
│   ├── index.js             # Autoregistra los componentes de todas las subcarpetas
│   ├── pages/               # Páginas (una por ruta)
│   ├── contador/            # Ejemplo básico: contador
│   └── weather/             # Ejemplo: tarjeta del clima
├── features/
│   ├── dom/dom.js           # h(), fragment, bindings reactivos
│   ├── router/              # Estado, utilidades y tabla de rutas
│   ├── contador/            # Estado del contador
│   └── weather/             # Estado del clima
├── shared/
│   ├── utils/               # logger, persist (signals en localStorage)
│   └── devtools/            # Panel de desarrollo (solo en npm run dev)
scripts/new.js               # Generador de código: npm run new
```

Alias de importación: `@kit` (la API pública), `@` (src), `@core`, `@components`, `@features`, `@shared`.

## Conceptos

Todo lo público se importa desde un único sitio:

```js
import { signal, computed, effect, resource, h, For, Show, define, c, Link, navigate, currentQuery } from '@kit'
```

`@kit` (`src/kit.js`) reexporta la reactividad, el DOM, los componentes, el router, `HttpClient` y `persist`. Los módulos internos (`@core/…`, `@features/…`) siguen disponibles para usos avanzados. `generateUrl` se importa de `@features/router/routes.config.js`.

> **Novedad de la 2.0:** las rutas se registran en `main.js` con `registerRoutes(routes)` (ver [Router](#router) y el [CHANGELOG](CHANGELOG.md)). Gracias a eso, los guards y todo tu código pueden importar `'@kit'` sin restricciones.

### Signals

```js
import { signal, computed, effect } from '@kit'

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
- `getOwner()` devuelve el effect o root actual (o `null`), por ejemplo para registrar `onCleanup` solo si hay dueño.
- `getStats()` devuelve `{ effects }`: cuántos effects hay vivos (útil para detectar fugas).

#### Datos asíncronos: `resource`

```js
import { resource } from '@kit'

const usuario = resource(
  () => id.get(),                                            // fuente: se rastrea
  (id, { signal }) => api.get(`/users/${id}`, {}, { signal }) // fetcher: devuelve una promesa
)

usuario.loading.get() // true mientras carga
usuario.data.get()    // el último valor recibido
usuario.error.get()   // el último error (o null)
usuario.refetch()     // vuelve a pedir
usuario.mutate(v)     // cambia data en local (p.ej. actualización optimista)
```

- Cuando cambia la fuente, se vuelve a pedir **y se cancela la petición anterior**: una respuesta lenta nunca pisa a una más reciente. También se cancela al desmontar.
- Si la fuente devuelve `false`, `null` o `undefined`, no se pide nada (útil para "busca a partir de 2 letras"). Sin fuente, `resource(fetcher)` pide una sola vez.
- Mientras recarga y si falla, `data` conserva el valor anterior. Un `AbortError` no cuenta como error.
- Los effects creados dentro de otro effect (o de un `createRoot`) se liberan automáticamente cuando su dueño se re-ejecuta o se destruye.

#### Esperar a que el usuario pare de escribir: `debounced`

```js
import { signal, debounced, resource } from '@kit'

const texto = signal('')                  // se actualiza en cada tecla (bind:value)
const busqueda = debounced(texto, 300)    // cambia cuando texto lleva 300 ms quieto
const libros = resource(
  () => busqueda.get() || null,           // vacío: no se pide nada
  (q, { signal }) => api.get(`/search.json?q=${encodeURIComponent(q)}`, {}, { signal })
)
```

- Escribir "dune" hace **una** petición, no cuatro. Si llega otra búsqueda, `resource` cancela la anterior.
- Empieza con el valor actual de la fuente (sin esperar). La fuente puede ser un signal, un computed o una función.
- El temporizador pendiente se cancela al desmontar: créalo dentro de un componente o de un `createRoot`.

### Crear DOM con `h()`

```js
import { h } from '@kit'

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

#### Listas con clave: `For`

Para listas que cambian, `For` reutiliza los nodos de los elementos que no cambian en lugar de repintar la lista entera:

```js
import { h, For } from '@kit'

h('ul', {},
  For(tareas, t => t.id, t => h('li', {}, t.texto))
)
```

- `For(lista, clave, render)`: `lista` es un signal, un `computed` o una función que devuelve un array; `clave` debe ser única y estable; `render` devuelve un elemento o un fragmento (por ejemplo un `Show`, o varios nodos), que se mueve como un bloque.
- Mismo `id` y mismo objeto → se conserva el nodo (solo se mueve si cambia el orden). Mismo `id` con un objeto nuevo (actualización inmutable) → se re-renderiza solo ese elemento.
- Los effects de cada elemento se liberan al quitarlo o al desmontar la lista.

#### Mostrar u ocultar: `Show`

```js
import { h, Show } from '@kit'

Show(usuario.loading, () => h('p', {}, 'Cargando…'))
Show(() => carrito.get().length > 0, () => h('ul', {}, '…'), () => h('p', {}, 'El carrito está vacío'))
```

- La condición es un signal, un `computed` o una función. La segunda vista es opcional.
- Solo reconstruye cuando la condición pasa de verdadera a falsa (o al revés). Mientras siga siendo verdadera, la vista conserva su nodo y su estado, y sus effects se liberan al ocultarse.

#### Formularios: `bind:value` y `bind:checked`

```js
const email = signal('')
const acepto = signal(false)

h('input', { type: 'email', 'bind:value': email })            // input ↔ signal
h('input', { type: 'checkbox', 'bind:checked': acepto })
h('select', { 'bind:value': pais }, h('option', { value: 'es' }, 'España'))
```

- Enlace en los dos sentidos: al escribir se actualiza el signal; al cambiar el signal se actualiza el campo. Funciona en `input`, `textarea` y `select`.
- Solo reescribe el campo si el valor es distinto, así que no mueve el cursor mientras escribes.

### Componentes

```js
import { define, c } from '@kit'

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

y se registran al arrancar, en `src/main.js` (el kit ya trae esta línea):

```js
import { renderApp, registerRoutes } from '@kit'
import { routes } from '@features/router/routes.config.js'

registerRoutes(routes)
renderApp('App', document.getElementById('app'))
```

En los tests que montan el `Router`, registra las rutas igual (o una tabla de prueba: `registerRoutes([...])`). Si se te olvida, la app muestra "No hay rutas registradas…" y la consola indica la línea que falta.

La página recibe los parámetros como `props.params` (ya decodificados):

```js
define('ProductPage', ({ params }) => h('h1', {}, `Producto ${params.id}`))
```

Para navegar:

```js
import { navigate, currentQuery } from '@kit'

navigate('/products/7?color=rojo')
currentQuery.get() // { color: 'rojo' } — reactivo
```

- Los enlaces internos `<a href="/...">` navegan sin recargar la página. Los externos, `target="_blank"`, `download` y los clics con modificadores (Ctrl/Cmd…) se dejan al navegador.
- Las rutas ignoran la query, el hash y la barra final: `/products/7/?x=1` coincide con `/products/:id`.
- `generateUrl('product', { id: 7 })` construye la URL de una ruta por su nombre.

#### La query como estado: `setQuery`

```js
import { setQuery, buildQueryString } from '@kit'

// En /libros?q=dune&pagina=2
setQuery({ pagina: 3 })                  // → /libros?q=dune&pagina=3 (nueva entrada en el historial)
setQuery({ q: 'tolkien', pagina: null }) // → /libros?q=tolkien (null, undefined o '' quitan el parámetro)
setQuery({ q: texto }, { replace: true }) // sin entrada nueva: ideal mientras se escribe

buildQueryString({ q: 'a b', vacio: '' }) // '?q=a%20b'
```

- Combina con la query actual y conserva la ruta y el hash. Si la URL no cambia, no hace nada.
- La página no se vuelve a montar: solo cambia `currentQuery`, que es reactivo. Así la URL es la fuente de verdad y se puede compartir o recargar. Un `title` que depende de `query` se actualiza; `beforeEnter` y `redirect` no se vuelven a evaluar (solo al cambiar de ruta).
- Un parámetro repetido (`?tag=a&tag=b`) conserva solo su último valor.
- Desde un effect no crea dependencias de la query (no hay bucles).

#### Enlaces: `Link`

```js
import { Link } from '@kit'

Link({ to: '/admin/productos', activeClass: 'font-bold', prefetch: true }, 'Productos')
h(Link, { to: '/acerca', className: 'text-sm' }, 'Acerca')
```

- Genera un `<a>` con la base de despliegue en el `href`; el clic navega sin recargar.
- `activeClass` se aplica cuando la ruta actual es `to` o cuelga de ella (`/admin` está activo en `/admin/usuarios`). Con `exact: true`, solo si coincide; `'/'` es exacto por defecto. La página exacta lleva además `aria-current="page"`.
- `prefetch: true` descarga la página diferida (`load`) al pasar el ratón o enfocar el enlace: al hacer clic ya está lista.

#### Título y layout por ruta

```js
{ path: '/admin/productos', component: 'ProductosPage', title: 'Productos', layout: 'AdminLayout' },
{ path: '/admin/productos/:id', component: 'EditarPage', title: ({ params }) => `Producto ${params.id}`, layout: 'AdminLayout' }
```

```js
define('AdminLayout', ({ content, title }) =>
  h('div', {},
    h('header', {}, /* menú, usuario… */),
    h('h1', {}, title),   // title es un signal: cambia con cada página
    content               // aquí se monta la página
  )
)
```

- `title` (texto o función) pone `Título · nombre de la app` en la pestaña. Las rutas sin `title` muestran el nombre de la app.
- `layout` envuelve la página: el componente recibe `content` (el hueco donde va la página; `contenido` sigue funcionando como alias) y `title` (un signal). Si dos rutas seguidas comparten layout, **no se vuelve a montar**: solo cambia la página, y la cabecera conserva su estado (un buscador, un menú abierto…).

#### Transiciones entre páginas

Si el navegador soporta la [View Transitions API](https://developer.mozilla.org/docs/Web/API/View_Transition_API), el cambio de página se anima con un fundido, sin escribir nada. Se omite si el usuario tiene activado "reducir movimiento", al cambiar solo los parámetros de la misma página o en rutas con `transition: false`. La animación se personaliza con CSS (`::view-transition-old(root)`, `::view-transition-new(root)`).

#### Redirecciones y rutas protegidas

```js
export const routes = [
  { path: '/viejo', redirect: '/nuevo' },
  { path: '/u/:id', redirect: ({ params }) => `/usuarios/${params.id}` },
  {
    path: '/admin',
    component: 'AdminPage',
    beforeEnter: ({ path }) => (sesion.get() ? true : `/login?volver=${path}`)
  },
]
```

- `redirect` (texto o función) y `beforeEnter` (devuelve una ruta para redirigir; cualquier otro valor deja pasar) reciben `{ path, params, query }`.
- Las redirecciones usan `replace`: no dejan entradas extra en el historial. Los bucles se cortan a las 10 redirecciones.
- El guard se evalúa al navegar, no cuando cambia un signal que lee: tras cerrar sesión, llama a `navigate('/login')`.

#### Carga diferida de páginas

```js
{ path: '/admin', component: 'AdminPage', load: () => import('@components/pages/Admin.lazy.js') }
```

- La página se descarga en su propio archivo JS la primera vez que se visita la ruta (mientras, se muestra "Cargando…").
- Nombra esos archivos `*.lazy.js`: el autoregistro de componentes los excluye para que no se incluyan en el bundle principal.

#### Desplegar en una subruta

Si la app vive en una subruta (por ejemplo GitHub Pages: `https://usuario.github.io/mi-app/`), configura `base: '/mi-app/'` en `vite.config.js`. El router la tiene en cuenta: las rutas de la app siguen siendo `/`, `/tareas`…

- `navigate('/tareas')` añade la base sola.
- Para los `href`, usa `Link`, `url('/tareas')` (los dos en `'@kit'`) o `generateUrl(...)`, que ya incluyen la base. Así los enlaces también funcionan al abrirlos en una pestaña nueva.
- Para recursos de `public/` desde JS, usa `` `${import.meta.env.BASE_URL}favicon.svg` ``.

## Generador de código

Crea archivos que siguen las convenciones del kit, sin sobrescribir nunca nada existente:

```bash
npm run new page Productos
npm run new -- page Admin --lazy
npm run new -- page MisPedidos --path /cuenta/pedidos
npm run new component TarjetaProducto
npm run new feature carrito
```

| Comando | Crea |
|---|---|
| `page Productos` | `components/pages/ProductosPage.js` y la ruta `/productos` (con `title`) en `routes.config.js` |
| `page Admin --lazy` | `AdminPage.lazy.js` y su ruta con `load` (se descarga bajo demanda) |
| `page … --path /ruta` | La ruta con el path que elijas |
| `component TarjetaProducto` | `components/tarjeta-producto/TarjetaProducto.js` y su test |
| `feature carrito` | `features/carrito/carrito.state.js` y su test |

Las opciones que empiezan por `--` necesitan el `--` de npm delante (`npm run new -- page Admin --lazy`); si no, npm se las queda y el script no las recibe.

## Devtools

En `npm run dev` aparece una insignia en la esquina inferior derecha:

- **⚡ N effects:** cuántos effects hay vivos. Si al navegar de un lado a otro el número no para de crecer, hay una fuga.
- **Resaltado:** cada elemento que actualiza un signal parpadea en ámbar. Al pulsar `+` en el contador, verás que solo cambian el número y el "Doble": la reactividad de grano fino, a la vista. Un clic en la insignia activa o desactiva el resaltado; la preferencia se recuerda.

No se incluye en el build de producción. Para ocultarla también en desarrollo, pon `VITE_DEVTOOLS=false` en `.env`.

## Convenciones

- Estado de cada funcionalidad en `src/features/<nombre>/<nombre>.state.js`.
- Componentes en `src/components/<carpeta>/`, registrados con `define('NombreEnPascalCase', fn)`.
- Tests junto al código que prueban, con el sufijo `.test.js`.
- Código y comentarios en español, sin punto y coma.
