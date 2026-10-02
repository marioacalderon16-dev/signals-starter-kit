# Changelog

## 2.1.0

Funciones nuevas y un ajuste de comportamiento en `buildQueryString` (ver "Cambiado"). Para la mayoría de proyectos, actualizar no requiere tocar nada.

### Añadido

- **`debounced(fuente, ms)`** (en `'@kit'`): un signal que toma el valor de la fuente cuando esta lleva `ms` sin cambiar. Con `resource`, una búsqueda mientras se escribe hace una sola petición. Ver "Esperar a que el usuario pare de escribir" en el README.
- **`setQuery(params, { replace })`** (en `'@kit'`): cambia la query de la ruta actual combinándola con la existente; `null`, `undefined` o `''` quitan un parámetro. No navega si la URL no cambia. Si la ruta tiene un `title` que depende de `query`, se actualiza. Ver "La query como estado" en el README.
- **`buildQueryString`** ahora también se exporta desde `'@kit'` (antes había que importarlo de `@features/router/router.utils.js`, que sigue funcionando).

### Cambiado

- `buildQueryString` omite los valores `null`, `undefined` y `''`: `{ q: '' }` da `''` en vez de `'?q='`. `0` y `false` se mantienen. Si dependías de `?q=` vacío en la URL, construye esa URL a mano.

## 2.0.0

Versión mayor: **un cambio incompatible**, con migración de una línea.

### Cambio incompatible: las rutas se registran en `main.js`

Hasta la 1.x, el router importaba `src/features/router/routes.config.js` por su cuenta. Eso creaba un ciclo de importación cuando un guard de la app (o algo que este use, como el estado de la sesión) importaba `'@kit'`:

```
routes.config.js → guard → '@kit' → router → routes.config.js
```

Desde la 2.0, el router **no importa** `routes.config.js`: las rutas se registran al arrancar, con `registerRoutes`.

#### Cómo migrar

En `src/main.js`, antes de `renderApp(...)`:

```js
// Antes (1.x)
import { renderApp } from '@components/Component.js'

renderApp('App', appContainer)
```

```js
// Después (2.0)
import { renderApp, registerRoutes } from '@kit'
import { routes } from '@features/router/routes.config.js'

registerRoutes(routes)
renderApp('App', appContainer)
```

En los **tests** que montan el `Router` (o usan `matchRoute`/`Link` con prefetch), registra también las rutas: `registerRoutes(routes)`, o una tabla de prueba `registerRoutes([...])`.

> ⚠️ Si tus tests simulaban rutas con `vi.mock('…/routes.config.js', …)`, ese mock **deja de tener efecto sin dar error** (el router ya no importa ese archivo). Sustitúyelo por `registerRoutes([...])` con tu tabla de prueba:
>
> ```js
> // Antes (1.x)
> vi.mock('@features/router/routes.config.js', () => ({ routes: [{ path: '/', component: 'Inicio' }] }))
>
> // Después (2.0)
> import { registerRoutes } from '@kit'
> registerRoutes([{ path: '/', component: 'Inicio' }])
> ```

#### ¿Me afecta?

Te afecta si actualizas un proyecto creado con la 1.x. Lo notarás porque:

- la página muestra **"No hay rutas registradas: añade registerRoutes(routes)…"** en lugar de tu app;
- la consola muestra el aviso `[ROUTER] No hay rutas registradas…` con la línea exacta que falta;
- o tus tests que usaban `vi.mock` de `routes.config.js` empiezan a fallar con ese mismo mensaje.

Lo que **no** cambia: `routes.config.js` se escribe igual (mismo formato de rutas, guards, `load`, `title`, `layout`…) y `generateUrl` sigue exportándose desde ahí.

#### Ventajas

- Los guards y el estado que usan pueden importar `'@kit'` sin restricciones: desaparece la regla de "importar del núcleo".
- El orden de las exportaciones de `src/kit.js` ya no importa.

### Añadido

- `registerRoutes(routes)` en `'@kit'`. Lanza `TypeError` si no recibe un array. Guarda la referencia al array (no una copia).
- Las rutas registradas **después** de montar el `Router` se aplican al momento, sin esperar a navegar (el registro es reactivo).
- Aviso en consola y mensaje en pantalla cuando no hay rutas registradas.
- `CHANGELOG.md` (este archivo).

### Retirado

- La regla "lo que importa `routes.config.js` debe importar del núcleo (`@core/…`), no de `'@kit'`": ya no hace falta. Los guards, el estado que usan y las plantillas de `npm run new` importan de `'@kit'`.
- El orden especial de las exportaciones de `src/kit.js` (ya no importa).

## 1.x

Última versión 1.x: etiqueta **`v1.0.0`** (signals, componentes, router con guards/lazy/layout, `For`, `Show`, `resource`, `bind:value`, `Link`, devtools, generador `npm run new` y punto de entrada `'@kit'`).

Si necesitas empezar un proyecto con la 1.x:

```bash
npx degit marioacalderon16-dev/signals-starter-kit#v1.0.0 mi-app
```
