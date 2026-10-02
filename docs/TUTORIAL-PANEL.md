# Tutorial profesional: panel de administración con login

Vas a construir un **backoffice real**: inicio de sesión contra una API, rutas protegidas, listado de productos con búsqueda y paginación, edición con validación, borrado optimista, tests, integración continua y despliegue en GitHub Pages.

El tutorial va **de lo macro a lo micro**: primero entiendes el sistema completo, luego levantas un esqueleto que ya funciona y después rellenas cada capa. En cada paso tendrás algo que puedes abrir en el navegador.

> **Requisitos:** haber hecho el [tutorial de inicio rápido](QUICKSTART.md) (o conocer signals, `h()` y el router del kit), Node.js `^20.19.0` o `>=22.12.0` y una cuenta de GitHub para las partes de CI y despliegue.

**Índice**

- **Parte 1 — La visión**: [1. Qué vas a construir](#1-qué-vas-a-construir) · [2. Arquitectura](#2-arquitectura)
- **Parte 2 — El esqueleto**: [3. Rutas, sesión y guards](#3-rutas-sesión-y-guards)
- **Parte 3 — Capa a capa**: [4. Configuración](#4-configuración-por-entorno) · [5. Servicios](#5-la-capa-de-servicios) · [6. Login real](#6-login-real) · [7. Listado](#7-listado-búsqueda-paginación-y-borrado-optimista) · [8. Edición](#8-edición-con-validación)
- **Parte 4 — Calidad y producción**: [9. Tests](#9-tests) · [10. CI](#10-integración-continua) · [11. Despliegue](#11-despliegue-en-github-pages)

---

# Parte 1 — La visión

## 1. Qué vas a construir

| Ruta | Qué hace |
|---|---|
| `/login` | Formulario de acceso. Si ya hay sesión, salta al panel. |
| `/admin` | Redirige a `/admin/productos`. |
| `/admin/productos` | Tabla con búsqueda (`?q=`) y paginación (`?pagina=`), botón de borrar. **Protegida.** |
| `/admin/productos/:id` | Formulario de edición con validación en vivo. **Protegida.** |

Usaremos [DummyJSON](https://dummyjson.com), una API pública de pruebas. Dos cosas que conviene saber desde ya:

- **Login:** DummyJSON publica usuarios de prueba en su [documentación de autenticación](https://dummyjson.com/docs/auth). Usaremos **usuario `emilys`** y **contraseña `emilyspass`**. Ojo: es un nombre de usuario, no un email. Hay más en https://dummyjson.com/users (campos `username` y `password`).
- **Edición y borrado son simulados:** la API responde como si hubiera guardado o borrado, pero no persiste nada. Al recargar, los datos vuelven a ser los originales. Para aprender es perfecto: la app se comporta igual que con una API real.

## 2. Arquitectura

### Las capas

```
┌─────────────────────────────────────────────────────────┐
│  Páginas y componentes      (components/)               │  ← qué se ve
│  LoginPage · AdminLayout · ProductosPage · Editar…      │
├─────────────────────────────────────────────────────────┤
│  Estado y acciones          (features/)                 │  ← qué se recuerda
│  sesion.state · auth.actions · auth.guards              │
├─────────────────────────────────────────────────────────┤
│  Servicios                  (services/)                 │  ← cómo se habla con la API
│  api (HttpClient) · auth.service · productos.service    │
├─────────────────────────────────────────────────────────┤
│  API externa                DummyJSON                   │
└─────────────────────────────────────────────────────────┘
```

La regla es que **cada capa solo conoce a la de debajo**:

- Las páginas nunca llaman a `fetch`: usan servicios.
- Los servicios no saben nada del DOM.
- El router decide qué página se ve, pero no sabe cómo se obtienen los datos.

Esto hace que cada pieza se pueda probar y cambiar por separado. Si mañana cambias DummyJSON por tu propia API, solo tocas `services/`.

### Los archivos

```
src/
├── config/app.js                       # URL de la API y timeout (desde .env)
├── services/
│   ├── api.js                          # Un único HttpClient con token automático
│   ├── auth.service.js                 # POST /auth/login
│   └── productos.service.js            # listar, obtener, actualizar, eliminar
├── features/auth/
│   ├── sesion.state.js                 # Signal de sesión, persistido
│   ├── auth.guards.js                  # requiereSesion, soloInvitados
│   └── auth.actions.js                 # iniciarSesion, cerrarSesion
└── components/
    ├── admin/AdminLayout.js            # Cabecera común del panel
    └── pages/
        ├── LoginPage.js
        ├── ProductosPage.lazy.js       # Se descarga solo al entrar en el panel
        └── ProductoEditarPage.lazy.js
```

### Los tres flujos principales

**Login**

1. El usuario visita `/admin/productos` sin sesión.
2. El guard `requiereSesion` redirige a `/login?volver=/admin/productos`.
3. `LoginPage` llama a `iniciarSesion()`, que usa `auth.service` y guarda la sesión.
4. Se vuelve a `volver`: el guard ahora deja pasar.

**Listado**

1. La URL es el estado: `?q=phone&pagina=2`.
2. Un `effect` lee `currentQuery`, llama a `productos.service.listar()` y guarda el resultado en un signal.
3. `For` pinta las filas.
4. Si la URL cambia antes de que llegue la respuesta, la petición anterior se cancela.

**Edición**

1. La página carga el producto y crea un signal por campo.
2. Un `computed` valida mientras se escribe.
3. Al guardar se llama a `actualizar()` y se vuelve al listado con un aviso.

---

# Parte 2 — El esqueleto

## 3. Rutas, sesión y guards

Antes de hablar con ninguna API, montamos la estructura completa con **páginas provisionales**. Al final de este capítulo podrás entrar al panel, ver que está protegido y cerrar sesión.

### La sesión

```js
/**
 * src/features/auth/sesion.state.js
 *
 * Sesión del usuario: un signal persistido en localStorage
 */

import { signal, computed } from '@core/signal.js'
import { persist } from '@shared/utils/persist.js'

// { token, expiraEn (ms), usuario: { id, nombre, imagen } } o null
export const sesion = signal(null)
persist('sesion', sesion)

export const usuario = computed(() => sesion.get()?.usuario ?? null)

/** ¿Hay sesión y el token no ha caducado? (se comprueba al navegar, no es reactivo) */
export const sesionValida = () => {
  const actual = sesion.get()
  return Boolean(actual && actual.expiraEn > Date.now())
}

export const guardarSesion = (datos) => sesion.set(datos)
export const borrarSesion = () => sesion.set(null)
```

`sesionValida()` es una función, no un `computed`: depende de la hora (`Date.now()`), que no es reactiva. Se comprueba al navegar, que es justo cuando la necesitamos.

### Los guards

```js
/**
 * src/features/auth/auth.guards.js
 *
 * Guards de rutas. Solo dependen de la sesión (no del router) para que
 * routes.config.js pueda importarlos sin crear dependencias circulares.
 */

import { sesionValida } from './sesion.state.js'

/** Rutas privadas: sin sesión válida → /login?volver=<ruta con su query> */
export const requiereSesion = ({ path, query }) => {
  if (sesionValida()) return true
  const qs = new URLSearchParams(query).toString()
  return `/login?volver=${encodeURIComponent(qs ? `${path}?${qs}` : path)}`
}

/** /login: si ya hay sesión, directo al panel */
export const soloInvitados = () => (sesionValida() ? '/admin' : true)
```

Los guards viven en su propio archivo y **solo importan la sesión**. Si importaran el router, `routes.config.js` → guards → router → `routes.config.js` formarían una dependencia circular.

### Las acciones (primera versión)

```js
/**
 * src/features/auth/auth.actions.js
 *
 * Acciones de sesión: combinan estado y navegación
 */

import { borrarSesion } from './sesion.state.js'
import { navigate } from '@features/router/router.state.js'

/**
 * Solo permite volver a rutas internas ('/admin/...'): evita redirecciones abiertas
 * a otros dominios a través de ?volver=https://sitio-malicioso
 */
export const destinoSeguro = (volver) =>
  typeof volver === 'string' && volver.startsWith('/') && !volver.startsWith('//') ? volver : '/admin'

export function cerrarSesion() {
  borrarSesion()
  navigate('/login')
}
```

`destinoSeguro` es una medida de seguridad: sin ella, un enlace como `/login?volver=https://sitio-malicioso.com` llevaría al usuario fuera de tu app justo después de iniciar sesión (una *open redirect*).

### Las rutas

En `src/features/router/routes.config.js`, importa los guards y añade las rutas del panel:

```js
import { requiereSesion, soloInvitados } from '@features/auth/auth.guards.js'

export const routes = [
  { 
    path: '/',
    component: 'InitialPage',
    name: 'initial'
  },
  { path: '/login', component: 'LoginPage', name: 'login', beforeEnter: soloInvitados },
  { path: '/admin', redirect: '/admin/productos' },
  {
    path: '/admin/productos',
    component: 'ProductosPage',
    name: 'productos',
    beforeEnter: requiereSesion,
    load: () => import('@components/pages/ProductosPage.lazy.js')
  },
  {
    path: '/admin/productos/:id',
    component: 'ProductoEditarPage',
    name: 'producto',
    beforeEnter: requiereSesion,
    load: () => import('@components/pages/ProductoEditarPage.lazy.js')
  }
]
```

- `beforeEnter` decide si se puede entrar. Si devuelve una ruta, redirige allí.
- `redirect` convierte `/admin` en `/admin/productos`.
- `load` descarga la página la primera vez que se visita. Por eso esos archivos se llaman `*.lazy.js`: el autoregistro de componentes los excluye para que no se incluyan en el bundle principal.

### El layout del panel

```js
/**
 * src/components/admin/AdminLayout.js
 *
 * Marco común de las páginas del panel: cabecera con usuario y cierre de sesión
 */

import { define } from '@components/Component.js'
import { h } from '@features/dom/dom.js'
import { computed } from '@core/signal.js'
import { url } from '@features/router/router.state.js'
import { usuario } from '@features/auth/sesion.state.js'
import { cerrarSesion } from '@features/auth/auth.actions.js'

define('AdminLayout', ({ titulo, contenido }) =>
  h('div', { className: 'min-h-screen bg-slate-50' },
    h('header', { className: 'border-b border-slate-200 bg-white' },
      h('div', { className: 'mx-auto flex max-w-5xl items-center gap-4 px-6 py-3' },
        h('a', { href: url('/admin/productos'), className: 'font-semibold text-slate-900' }, 'Panel'),
        h('span', { className: 'flex-1 text-right text-sm text-slate-500' }, computed(() => usuario.get()?.nombre ?? '')),
        h('button', { className: 'text-sm font-medium text-sky-700 hover:underline', onClick: cerrarSesion }, 'Cerrar sesión')
      )
    ),
    h('main', { className: 'mx-auto max-w-5xl space-y-4 px-6 py-8' },
      h('h1', { className: 'text-2xl font-bold text-slate-900' }, titulo),
      contenido
    )
  )
)
```

Fíjate en `url('/admin/productos')` en el `href`: añade la base de despliegue. Ahora no hace nada, pero en el capítulo 11 la app vivirá en `/tu-repo/` y los enlaces seguirán funcionando, también al abrirlos en una pestaña nueva.

### Páginas provisionales

`src/components/pages/LoginPage.js` (provisional: entra sin API):

```js
/**
 * src/components/pages/LoginPage.js
 *
 * Página /login — VERSIÓN PROVISIONAL: entra sin API para probar rutas y guards
 */

import { define } from '@components/Component.js'
import { h } from '@features/dom/dom.js'
import { currentQuery, navigate } from '@features/router/router.state.js'
import { guardarSesion } from '@features/auth/sesion.state.js'
import { destinoSeguro } from '@features/auth/auth.actions.js'

define('LoginPage', () =>
  h('main', { className: 'flex min-h-screen items-center justify-center bg-slate-50 p-6' },
    h('button', {
      className: 'rounded-lg bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-700',
      onClick: () => {
        guardarSesion({ token: 'demo', expiraEn: Date.now() + 60 * 60 * 1000, usuario: { id: 0, nombre: 'Modo demo' } })
        navigate(destinoSeguro(currentQuery.get().volver))
      }
    }, 'Entrar (modo demo)')
  )
)
```

`src/components/pages/ProductosPage.lazy.js` (provisional):

```js
/**
 * src/components/pages/ProductosPage.lazy.js — VERSIÓN PROVISIONAL
 */

import { define, c } from '@components/Component.js'
import { h } from '@features/dom/dom.js'
import { url } from '@features/router/router.state.js'

define('ProductosPage', () =>
  c('AdminLayout', {
    titulo: 'Productos',
    contenido: h('p', {}, 'Próximamente: el listado. ',
      h('a', { href: url('/admin/productos/1'), className: 'text-sky-700 hover:underline' }, 'Editar el producto 1')
    )
  })
)
```

`src/components/pages/ProductoEditarPage.lazy.js` (provisional):

```js
/**
 * src/components/pages/ProductoEditarPage.lazy.js — VERSIÓN PROVISIONAL
 */

import { define, c } from '@components/Component.js'
import { h } from '@features/dom/dom.js'

define('ProductoEditarPage', ({ params }) =>
  c('AdminLayout', {
    titulo: `Editar producto #${params.id}`,
    contenido: h('p', {}, 'Próximamente: el formulario.')
  })
)
```

### Pruébalo

Con `npm run dev`:

- [ ] Abre http://localhost:4321/admin/productos/1: te lleva a `/login?volver=%2Fadmin%2Fproductos%2F1`.
- [ ] Pulsa **Entrar (modo demo)**: vuelves a `/admin/productos/1` y ves "Modo demo" en la cabecera.
- [ ] Visita `/admin`: te redirige a `/admin/productos`.
- [ ] Visita `/login` con la sesión abierta: te manda al panel.
- [ ] **Cerrar sesión** te lleva a `/login`, y el panel vuelve a estar protegido.
- [ ] En las DevTools (pestaña Network), `ProductosPage.lazy.js` solo se descarga al entrar en el panel.

El sistema completo ya funciona. A partir de aquí, cada capítulo sustituye una pieza provisional por la real.

---

# Parte 3 — Capa a capa

## 4. Configuración por entorno

La URL de la API no debe estar escrita en el código: cambia entre desarrollo, pruebas y producción. En `.env` (y en `.env.example`, para que otros sepan qué variables existen), descomenta la sección de la API:

```bash
# API
VITE_API_URL=https://dummyjson.com
VITE_API_TIMEOUT=8000
```

Y léela en `src/config/app.js`:

```js
/**
 * src/config/app.js
 * 
 * Cargar configuración desde .env
 */

const config = {
  name: import.meta.env.VITE_APP_NAME || 'signals-starter-kit',
  version: import.meta.env.VITE_APP_VERSION || '1.0.0',
  mode: import.meta.env.MODE || 'development',
  apiUrl: import.meta.env.VITE_API_URL || 'https://dummyjson.com',
  apiTimeout: Number(import.meta.env.VITE_API_TIMEOUT) || 8000
}

export default config
```

Los valores por defecto (`|| 'https://dummyjson.com'`) hacen que la app funcione aunque no exista `.env`, como en el servidor de CI del capítulo 10. Recuerda reiniciar `npm run dev` después de cambiar `.env`.

## 5. La capa de servicios

### Un único cliente HTTP

```js
/**
 * src/services/api.js
 *
 * Cliente HTTP único de la app: URL base, timeout y token salen de la configuración y la sesión
 */

import { HttpClient } from '@core/httpClient.js'
import config from '@/config/app.js'
import { sesion } from '@features/auth/sesion.state.js'

export const api = new HttpClient({
  baseUrl: config.apiUrl,
  timeout: config.apiTimeout,
  auth: {
    type: 'Bearer',
    tokenGetter: () => sesion.get()?.token // se lee en cada petición
  }
})
```

Toda la app usa este cliente: el timeout, la URL base y la cabecera `Authorization: Bearer …` se configuran en un solo sitio. El token se lee en cada petición, así que en cuanto inicias sesión, todas las peticiones lo llevan.

### Autenticación

```js
/**
 * src/services/auth.service.js
 *
 * Autenticación contra la API (DummyJSON: POST /auth/login)
 */

import { api } from './api.js'

const DURACION_MIN = 60

/**
 * Inicia sesión y devuelve la sesión ya normalizada para la app.
 * @returns {Promise<{ token, expiraEn, usuario: { id, nombre, imagen } }>}
 */
export async function login(username, password) {
  const r = await api.post('/auth/login', { username, password, expiresInMins: DURACION_MIN })
  return {
    token: r.accessToken,
    expiraEn: Date.now() + DURACION_MIN * 60 * 1000,
    usuario: { id: r.id, nombre: `${r.firstName} ${r.lastName}`, imagen: r.image }
  }
}
```

El servicio **normaliza** la respuesta: la app trabaja con `{ token, expiraEn, usuario }` y no con los nombres de campos de DummyJSON (`accessToken`, `firstName`…). Si cambias de API, solo cambia este archivo.

### Productos

```js
/**
 * src/services/productos.service.js
 *
 * Productos (DummyJSON). Nota: PUT y DELETE son simulados por la API, no persisten.
 */

import { api } from './api.js'
import { buildQueryString } from '@features/router/router.utils.js'

export const POR_PAGINA = 10
const CAMPOS = 'title,price,stock,category,thumbnail'

/**
 * Lista paginada, con búsqueda opcional.
 * @returns {Promise<{ productos: Array, total: number }>}
 */
export async function listar({ q = '', pagina = 1, signal } = {}) {
  const query = buildQueryString({ limit: POR_PAGINA, skip: (pagina - 1) * POR_PAGINA, select: CAMPOS })
  const ruta = q ? `/products/search${query}&q=${encodeURIComponent(q)}` : `/products${query}`
  const r = await api.get(ruta, {}, { signal })
  return { productos: r.products, total: r.total }
}

export const obtener = (id, { signal } = {}) => api.get(`/products/${id}`, {}, { signal })

export const actualizar = (id, cambios) => api.put(`/products/${id}`, cambios)

export const eliminar = (id) => api.delete(`/products/${id}`)
```

- `select` pide solo los campos que muestra la tabla: respuestas más pequeñas.
- `signal` permite cancelar la petición desde la página (lo usaremos en el capítulo 7).

## 6. Login real

Sustituye `auth.actions.js` por la versión final, que añade `iniciarSesion`:

```js
/**
 * src/features/auth/auth.actions.js
 *
 * Acciones de sesión: combinan servicio, estado y navegación
 */

import { login } from '@/services/auth.service.js'
import { guardarSesion, borrarSesion } from './sesion.state.js'
import { navigate } from '@features/router/router.state.js'

/**
 * Solo permite volver a rutas internas ('/admin/...'): evita redirecciones abiertas
 * a otros dominios a través de ?volver=https://sitio-malicioso
 */
export const destinoSeguro = (volver) =>
  typeof volver === 'string' && volver.startsWith('/') && !volver.startsWith('//') ? volver : '/admin'

export async function iniciarSesion(username, password, volver) {
  guardarSesion(await login(username, password))
  navigate(destinoSeguro(volver))
}

export function cerrarSesion() {
  borrarSesion()
  navigate('/login')
}
```

Y la página de login provisional por el formulario real:

```js
/**
 * src/components/pages/LoginPage.js
 *
 * Página /login
 */

import { define } from '@components/Component.js'
import { h } from '@features/dom/dom.js'
import { signal, computed } from '@core/signal.js'
import { currentQuery } from '@features/router/router.state.js'
import { iniciarSesion } from '@features/auth/auth.actions.js'

const claseInput = 'w-full rounded-lg border-slate-300'

define('LoginPage', () => {
  const estado = signal({ enviando: false, error: '' })

  const usuario = h('input', { name: 'username', autocomplete: 'username', required: true, className: claseInput })
  const clave = h('input', { name: 'password', type: 'password', autocomplete: 'current-password', required: true, className: claseInput })

  const campo = (texto, input) =>
    h('label', { className: 'block space-y-1 text-sm font-medium text-slate-700' }, h('span', {}, texto), input)

  return h('main', { className: 'flex min-h-screen items-center justify-center bg-slate-50 p-6' },
    h('form', {
      className: 'w-full max-w-sm space-y-4 rounded-2xl bg-white p-8 shadow ring-1 ring-slate-200',
      onSubmit: async (event) => {
        event.preventDefault()
        estado.set({ enviando: true, error: '' })
        try {
          await iniciarSesion(usuario.value.trim(), clave.value, currentQuery.get().volver)
        } catch (error) {
          // Con status: la API respondió (credenciales incorrectas…); sin status: red o timeout
          const mensaje = error.status ? error.message : 'No se pudo conectar. Inténtalo de nuevo.'
          estado.set({ enviando: false, error: mensaje })
        }
      }
    },
      h('h1', { className: 'text-xl font-bold text-slate-900' }, 'Iniciar sesión'),
      campo('Usuario', usuario),
      campo('Contraseña', clave),
      h('p', { className: 'text-sm text-red-600', role: 'alert' }, computed(() => estado.get().error)),
      h('button', {
        type: 'submit',
        disabled: computed(() => estado.get().enviando),
        className: 'w-full rounded-lg bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-700 disabled:opacity-60'
      }, computed(() => (estado.get().enviando ? 'Entrando…' : 'Entrar')))
    )
  )
})
```

- `autocomplete="username"` y `"current-password"` permiten que el gestor de contraseñas del navegador rellene el formulario.
- El error distingue dos casos. Con `status`, la API respondió (por ejemplo, credenciales incorrectas) y mostramos su mensaje. Sin `status`, no hubo respuesta (red caída o timeout).
- `role="alert"` hace que los lectores de pantalla anuncien el error.

**Pruébalo:**

1. Abre http://localhost:4321/admin: te lleva a `/login`.
2. Entra con el usuario de prueba de DummyJSON: **usuario `emilys`**, **contraseña `emilyspass`**.
3. Vuelves a `/admin/productos` y la cabecera muestra **Emily Johnson**.
4. Cierra sesión y prueba con una contraseña incorrecta: aparece el mensaje de error que devuelve la API.

## 7. Listado: búsqueda, paginación y borrado optimista

Sustituye `ProductosPage.lazy.js` por la versión final:

```js
/**
 * src/components/pages/ProductosPage.lazy.js
 *
 * Página /admin/productos: búsqueda y paginación en la URL, eliminación optimista.
 * Es *.lazy.js: se descarga la primera vez que se visita la ruta.
 */

import { define, c } from '@components/Component.js'
import { h, For } from '@features/dom/dom.js'
import { signal, computed, effect, onCleanup, untrack } from '@core/signal.js'
import { currentQuery, navigate, url } from '@features/router/router.state.js'
import { buildQueryString } from '@features/router/router.utils.js'
import * as productosService from '@/services/productos.service.js'

const precio = new Intl.NumberFormat('es', { style: 'currency', currency: 'USD' })
const rutaListado = (params) => `/admin/productos${buildQueryString(params)}`

define('ProductosPage', () => {
  const estado = signal({ cargando: true, error: null, productos: [], total: 0 })
  const aviso = signal('')

  // - La URL es el estado de la búsqueda y la página: ?q=phone&pagina=2 -
  const q = computed(() => currentQuery.get().q ?? '')
  const pagina = computed(() => Math.max(1, Number(currentQuery.get().pagina) || 1))
  const totalPaginas = computed(() => Math.max(1, Math.ceil(estado.get().total / productosService.POR_PAGINA)))
  const productos = computed(() => estado.get().productos)

  // Mensaje al volver de la página de edición (?guardado=Título)
  const guardado = untrack(() => currentQuery.get().guardado)
  if (guardado) aviso.set(`«${guardado}» guardado (DummyJSON lo simula: no persiste).`)

  // - Carga: se repite al cambiar q o pagina; la petición anterior se cancela -
  effect(() => {
    const busqueda = q.get()
    const numero = pagina.get()
    const controller = new AbortController()
    onCleanup(() => controller.abort())

    estado.set({ ...untrack(() => estado.get()), cargando: true, error: null }) // conserva la tabla mientras carga
    productosService.listar({ q: busqueda, pagina: numero, signal: controller.signal })
      .then(({ productos, total }) => estado.set({ cargando: false, error: null, productos, total }))
      .catch((error) => {
        if (error.name !== 'AbortError') estado.set({ cargando: false, error, productos: [], total: 0 })
      })
  })

  // - Eliminación optimista: se quita de la tabla al instante y se revierte si la API falla -
  const eliminar = async (producto) => {
    const antes = estado.get()
    estado.set({ ...antes, productos: antes.productos.filter(p => p.id !== producto.id), total: antes.total - 1 })
    try {
      await productosService.eliminar(producto.id)
      aviso.set(`«${producto.title}» eliminado (DummyJSON lo simula: no persiste).`)
    } catch (error) {
      estado.set(antes)
      aviso.set(`No se pudo eliminar «${producto.title}»: ${error.message}`)
    }
  }

  // - Vista -
  const buscador = h('input', { type: 'search', value: untrack(() => q.get()), placeholder: 'Buscar productos…', className: 'flex-1 rounded-lg border-slate-300' })

  const formulario = h('form', {
    className: 'flex gap-2',
    role: 'search',
    onSubmit: (event) => {
      event.preventDefault()
      const texto = buscador.value.trim()
      navigate(rutaListado(texto ? { q: texto } : {}))
    }
  }, buscador, h('button', { type: 'submit', className: 'rounded-lg bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-700' }, 'Buscar'))

  const fila = (p) =>
    h('tr', { className: 'border-t border-slate-100' },
      h('td', { className: 'py-2 pr-4' }, h('img', { src: p.thumbnail, alt: '', className: 'h-10 w-10 rounded object-cover' })),
      h('td', { className: 'py-2 pr-4 font-medium text-slate-900' }, p.title),
      h('td', { className: 'py-2 pr-4 text-right tabular-nums' }, precio.format(p.price)),
      h('td', { className: 'py-2 pr-4 text-right tabular-nums' }, p.stock),
      h('td', { className: 'space-x-3 whitespace-nowrap py-2 text-right' },
        h('a', { href: url(`/admin/productos/${p.id}`), className: 'text-sky-700 hover:underline' }, 'Editar'),
        h('button', { className: 'text-red-600 hover:underline', onClick: () => eliminar(p) }, 'Eliminar')
      )
    )

  const tabla = h('table', { className: { 'w-full text-sm': true, 'opacity-50': computed(() => estado.get().cargando) } },
    h('thead', {},
      h('tr', { className: 'text-left text-slate-500' },
        h('th', { className: 'py-2' }, ''), h('th', {}, 'Producto'),
        h('th', { className: 'text-right' }, 'Precio'), h('th', { className: 'text-right' }, 'Stock'), h('th', {}, '')
      )
    ),
    h('tbody', {}, For(productos, p => p.id, fila))
  )

  const enlace = (texto, numero) =>
    h('a', { href: url(rutaListado({ ...(q.get() && { q: q.get() }), pagina: numero })), className: 'text-sky-700 hover:underline' }, texto)

  const contenido = h('div', { className: 'space-y-4' },
    formulario,
    computed(() => aviso.get() && h('p', { className: 'rounded-lg bg-green-50 px-4 py-2 text-sm text-green-800', role: 'status' }, aviso.get())),
    computed(() => estado.get().error && h('p', { className: 'text-red-600', role: 'alert' }, `Error al cargar: ${estado.get().error.message}`)),
    h('div', { className: 'overflow-x-auto rounded-xl bg-white p-4 shadow ring-1 ring-slate-200' }, tabla),
    computed(() => {
      const { cargando, error, productos } = estado.get()
      return !cargando && !error && productos.length === 0 && h('p', { className: 'text-slate-500' }, 'No hay productos que coincidan.')
    }),
    h('nav', { className: 'flex items-center justify-between text-sm text-slate-500' },
      h('span', {}, computed(() => `${estado.get().total} productos · página ${pagina.get()} de ${totalPaginas.get()}`)),
      h('div', { className: 'space-x-4' },
        computed(() => pagina.get() > 1 && enlace('← Anterior', pagina.get() - 1)),
        computed(() => pagina.get() < totalPaginas.get() && enlace('Siguiente →', pagina.get() + 1))
      )
    )
  )

  return c('AdminLayout', { titulo: 'Productos', contenido })
})
```

Las ideas clave:

1. **La URL es el estado.** `q` y `pagina` son `computed` sobre `currentQuery`. Buscar o paginar solo cambia la URL, y por eso:
   - funcionan los botones atrás y adelante;
   - se puede compartir un enlace a "página 2 de los resultados de phone";
   - al recargar no se pierde nada.
2. **Cargar y cancelar.** El `effect` se vuelve a ejecutar cuando cambian `q` o `pagina`. Su `onCleanup` cancela la petición anterior con `AbortController`, así que una respuesta lenta nunca pisa a una más reciente. Al salir de la página también se cancela; el kit registra esas cancelaciones como `debug`, no como errores.
3. **`untrack` dentro del effect.** Para conservar la tabla mientras carga leemos `estado`, pero con `untrack`. Si lo leyéramos normalmente, el effect dependería de `estado` y se volvería a ejecutar cada vez que lo actualiza: un bucle.
4. **`For` para las filas.** Al borrar un producto, `For` quita solo esa fila; las demás conservan su nodo.
5. **Borrado optimista.** La fila desaparece **antes** de que responda la API. Si la API falla, se restaura el estado anterior y se avisa. La interfaz se siente instantánea sin mentir al usuario.

## 8. Edición con validación

Sustituye `ProductoEditarPage.lazy.js` por la versión final:

```js
/**
 * src/components/pages/ProductoEditarPage.lazy.js
 *
 * Página /admin/productos/:id: formulario con validación en vivo
 */

import { define, c } from '@components/Component.js'
import { h } from '@features/dom/dom.js'
import { signal, computed, onCleanup, untrack } from '@core/signal.js'
import { navigate, url } from '@features/router/router.state.js'
import { buildQueryString } from '@features/router/router.utils.js'
import * as productosService from '@/services/productos.service.js'

const formulario = (producto) => {
  const titulo = signal(producto.title)
  const precio = signal(String(producto.price))
  const stock = signal(String(producto.stock))
  const guardando = signal(false)
  const errorGuardar = signal('')

  const errores = computed(() => ({
    titulo: titulo.get().trim() ? '' : 'El título es obligatorio.',
    precio: Number(precio.get()) > 0 ? '' : 'El precio debe ser mayor que 0.',
    stock: /^\d+$/.test(stock.get()) ? '' : 'El stock debe ser un número entero (0 o más).'
  }))
  const valido = computed(() => Object.values(errores.get()).every(e => !e))

  const campo = (etiqueta, sig, clave, attrs) =>
    h('label', { className: 'block space-y-1' },
      h('span', { className: 'text-sm font-medium text-slate-700' }, etiqueta),
      h('input', { ...attrs, className: 'w-full rounded-lg border-slate-300', onInput: (e) => sig.set(e.target.value) }),
      h('span', { className: 'text-sm text-red-600' }, computed(() => errores.get()[clave]))
    )

  return h('form', {
    className: 'max-w-md space-y-4 rounded-xl bg-white p-6 shadow ring-1 ring-slate-200',
    onSubmit: async (event) => {
      event.preventDefault()
      if (!valido.get()) return
      guardando.set(true)
      errorGuardar.set('')
      try {
        const actualizado = await productosService.actualizar(producto.id, {
          title: titulo.get().trim(),
          price: Number(precio.get()),
          stock: Number(stock.get())
        })
        navigate(`/admin/productos${buildQueryString({ guardado: actualizado.title })}`)
      } catch (error) {
        guardando.set(false)
        errorGuardar.set(`No se pudo guardar: ${error.message}`)
      }
    }
  },
    campo('Título', titulo, 'titulo', { value: producto.title }),
    campo('Precio (USD)', precio, 'precio', { type: 'number', step: '0.01', min: '0', value: String(producto.price) }),
    campo('Stock', stock, 'stock', { type: 'number', step: '1', min: '0', value: String(producto.stock) }),
    h('p', { className: 'text-sm text-red-600', role: 'alert' }, errorGuardar),
    h('button', {
      type: 'submit',
      disabled: computed(() => !valido.get() || guardando.get()),
      className: 'rounded-lg bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-700 disabled:opacity-50'
    }, computed(() => (guardando.get() ? 'Guardando…' : 'Guardar cambios')))
  )
}

define('ProductoEditarPage', ({ params }) => {
  const estado = signal({ cargando: true, error: null, producto: null })

  const controller = new AbortController()
  onCleanup(() => controller.abort())

  productosService.obtener(params.id, { signal: controller.signal })
    .then(producto => estado.set({ cargando: false, error: null, producto }))
    .catch(error => {
      if (error.name !== 'AbortError') estado.set({ cargando: false, error, producto: null })
    })

  const cuerpo = computed(() => {
    const { cargando, error, producto } = estado.get()
    if (cargando) return h('p', { className: 'text-slate-500' }, 'Cargando…')
    if (error) return h('p', { className: 'text-red-600', role: 'alert' }, error.status === 404 ? 'Ese producto no existe.' : `Error: ${error.message}`)
    return untrack(() => formulario(producto)) // untrack: escribir en el formulario no debe re-crearlo
  })

  return c('AdminLayout', {
    titulo: `Editar producto #${params.id}`,
    contenido: h('div', { className: 'space-y-4' },
      h('a', { href: url('/admin/productos'), className: 'text-sm text-sky-700 hover:underline' }, '← Volver al listado'),
      cuerpo
    )
  })
})
```

- **Un signal por campo** y un `computed` con todos los errores: el mensaje y el botón deshabilitado se actualizan en cada tecla.
- **`untrack(() => formulario(producto))`.** `cuerpo` es un `computed` que devuelve el nodo del formulario. Si `formulario()` leyera algún signal al construirse, `cuerpo` dependería de él y el formulario entero se recrearía al escribir, perdiendo el foco. `untrack` lo evita.
- **Los inputs usan el valor inicial** (`value: producto.title`), no el signal. El input es la fuente de verdad mientras se escribe, y `onInput` mantiene el signal sincronizado.
- **Tras guardar** se vuelve a `/admin/productos?guardado=…` y el listado muestra el aviso.

¡El panel está completo! Pruébalo de principio a fin: entrar, buscar, paginar, editar, borrar y cerrar sesión.

---

# Parte 4 — Calidad y producción

## 9. Tests

Tres niveles de tests, todos sin red: `fetch` se sustituye por un doble controlado.

### Servicios: ¿hablamos bien con la API?

`src/services/servicios.test.js`:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { login } from './auth.service.js'
import * as productos from './productos.service.js'
import { sesion } from '@features/auth/sesion.state.js'

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('servicios', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.spyOn(console, 'error').mockImplementation(() => {})
    sesion.set(null)
  })
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

  it('login normaliza la respuesta de la API', async () => {
    fetch.mockImplementation(() => Promise.resolve(json({ id: 1, firstName: 'Ana', lastName: 'López', image: 'a.png', accessToken: 'tok' })))
    const s = await login('ana', 'secreta')
    expect(s).toMatchObject({ token: 'tok', usuario: { id: 1, nombre: 'Ana López', imagen: 'a.png' } })
    expect(s.expiraEn).toBeGreaterThan(Date.now())
    const [urlLlamada, init] = fetch.mock.calls[0]
    expect(urlLlamada).toBe('https://dummyjson.com/auth/login')
    expect(JSON.parse(init.body)).toMatchObject({ username: 'ana', password: 'secreta' })
  })

  it('login con credenciales incorrectas lanza el error de la API', async () => {
    fetch.mockImplementation(() => Promise.resolve(json({ message: 'Invalid credentials' }, 400)))
    await expect(login('x', 'y')).rejects.toMatchObject({ status: 400, message: 'Invalid credentials' })
  })

  it('listar arma la URL de paginación y búsqueda', async () => {
    fetch.mockImplementation(() => Promise.resolve(json({ products: [{ id: 1 }], total: 23 })))
    await productos.listar({ pagina: 3 })
    expect(fetch.mock.calls[0][0]).toBe('https://dummyjson.com/products?limit=10&skip=20&select=title%2Cprice%2Cstock%2Ccategory%2Cthumbnail')
    const r = await productos.listar({ q: 'café', pagina: 1 })
    expect(fetch.mock.calls[1][0]).toContain('/products/search?limit=10&skip=0')
    expect(fetch.mock.calls[1][0]).toContain('&q=caf%C3%A9')
    expect(r).toEqual({ productos: [{ id: 1 }], total: 23 })
  })

  it('envía el token de la sesión en Authorization', async () => {
    sesion.set({ token: 'abc', expiraEn: Date.now() + 1000, usuario: {} })
    fetch.mockImplementation(() => Promise.resolve(json({ id: 5 })))
    await productos.obtener(5)
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer abc')
  })
})
```

### Sesión y guards: ¿las reglas de acceso son correctas?

`src/features/auth/auth.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest'
import { sesion, sesionValida } from './sesion.state.js'
import { requiereSesion, soloInvitados } from './auth.guards.js'
import { destinoSeguro } from './auth.actions.js'

const valida = () => ({ token: 't', expiraEn: Date.now() + 60_000, usuario: { nombre: 'Ana' } })

describe('sesión y guards', () => {
  beforeEach(() => sesion.set(null))

  it('una sesión caducada no es válida', () => {
    sesion.set({ ...valida(), expiraEn: Date.now() - 1 })
    expect(sesionValida()).toBe(false)
    sesion.set(valida())
    expect(sesionValida()).toBe(true)
  })

  it('requiereSesion redirige al login conservando ruta y query', () => {
    expect(requiereSesion({ path: '/admin/productos', query: { q: 'phone', pagina: '2' } }))
      .toBe('/login?volver=%2Fadmin%2Fproductos%3Fq%3Dphone%26pagina%3D2')
    sesion.set(valida())
    expect(requiereSesion({ path: '/admin/productos', query: {} })).toBe(true)
  })

  it('soloInvitados manda al panel si ya hay sesión', () => {
    expect(soloInvitados()).toBe(true)
    sesion.set(valida())
    expect(soloInvitados()).toBe('/admin')
  })

  it('destinoSeguro solo acepta rutas internas', () => {
    expect(destinoSeguro('/admin/productos?q=x')).toBe('/admin/productos?q=x')
    expect(destinoSeguro('https://malicioso.com')).toBe('/admin')
    expect(destinoSeguro('//malicioso.com')).toBe('/admin')
    expect(destinoSeguro(undefined)).toBe('/admin')
  })

  it('la sesión se persiste en localStorage', async () => {
    sesion.set(valida())
    await new Promise(r => setTimeout(r))
    expect(JSON.parse(localStorage.getItem('sesion')).token).toBe('t')
  })
})
```

### Integración: ¿funciona el panel completo?

`src/components/pages/panel.test.js`:

```js
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import '@components/index.js'
import { renderApp } from '@components/Component.js'
import { navigate } from '@features/router/router.state.js'
import { sesion } from '@features/auth/sesion.state.js'

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const settle = async () => { for (let i = 0; i < 20; i++) await new Promise(r => setTimeout(r)) }
const lista = (n, total = 23) => json({ products: Array.from({ length: n }, (_, i) => ({ id: i + 1, title: `P${i + 1}`, price: 10, stock: 5, thumbnail: '' })), total })

let root

describe('panel (integración)', () => {
  beforeAll(() => {
    root = document.createElement('div')
    renderApp('App', root)
  })
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

  it('sin sesión, /admin lleva al login con ?volver', async () => {
    sesion.set(null)
    navigate('/admin')
    await settle()
    expect(location.pathname + location.search).toBe('/login?volver=%2Fadmin%2Fproductos')
    expect(root.querySelector('h1').textContent).toBe('Iniciar sesión')
  })

  it('login correcto vuelve a la ruta pedida', async () => {
    fetch.mockImplementation((u) => Promise.resolve(u.includes('/auth/login')
      ? json({ id: 1, firstName: 'Ana', lastName: 'López', image: '', accessToken: 'tok' })
      : lista(10)))
    root.querySelector('input[name=username]').value = 'ana'
    root.querySelector('input[name=password]').value = 'x'
    root.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }))
    await settle()
    expect(location.pathname).toBe('/admin/productos')
    expect(root.textContent).toContain('Ana López')
    expect(root.querySelectorAll('tbody tr').length).toBe(10)
    expect(root.textContent).toContain('23 productos · página 1 de 3')
  })

  it('la paginación y la búsqueda van en la URL', async () => {
    fetch.mockImplementation(() => Promise.resolve(lista(3)))
    navigate('/admin/productos?pagina=3')
    await settle()
    expect(fetch.mock.calls.at(-1)[0]).toContain('skip=20')
    expect(root.textContent).toContain('página 3 de 3')
    expect(root.textContent).toContain('← Anterior')
    expect(root.textContent).not.toContain('Siguiente →')
  })

  it('eliminación optimista: quita la fila al instante y la restaura si la API falla', async () => {
    fetch.mockImplementation(() => Promise.resolve(lista(3)))
    navigate('/admin/productos?pagina=1')
    await settle()
    let rechazar
    fetch.mockImplementation(() => new Promise((_, rej) => { rechazar = rej }))
    root.querySelector('tbody tr button').click()
    await new Promise(r => setTimeout(r)) // deja correr el effect de la lista
    expect(root.querySelectorAll('tbody tr').length).toBe(2) // optimista
    rechazar(new TypeError('Failed to fetch'))
    await settle()
    expect(root.querySelectorAll('tbody tr').length).toBe(3) // revertido
    expect(root.textContent).toContain('No se pudo eliminar «P1»')
  })

  it('editar: valida en vivo y guarda', async () => {
    fetch.mockImplementation(() => Promise.resolve(json({ id: 1, title: 'P1', price: 10, stock: 5 })))
    navigate('/admin/productos/1')
    await settle()
    const [titulo] = root.querySelectorAll('form input')
    const boton = root.querySelector('form button')
    titulo.value = '  '
    titulo.dispatchEvent(new Event('input'))
    await settle()
    expect(root.textContent).toContain('El título es obligatorio.')
    expect(boton.disabled).toBe(true)
    titulo.value = 'Nuevo nombre'
    titulo.dispatchEvent(new Event('input'))
    await settle()
    expect(boton.disabled).toBe(false)

    fetch.mockImplementation((u, init) => Promise.resolve(init?.method === 'PUT'
      ? json({ id: 1, title: 'Nuevo nombre', price: 10, stock: 5 })
      : lista(10)))
    root.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }))
    await settle()
    expect(JSON.parse(fetch.mock.calls.find(c => c[1]?.method === 'PUT')[1].body).title).toBe('Nuevo nombre')
    expect(location.pathname).toBe('/admin/productos')
    expect(root.textContent).toContain('«Nuevo nombre» guardado')
  })

  it('cerrar sesión vuelve al login y protege el panel', async () => {
    fetch.mockImplementation(() => Promise.resolve(lista(1)))
    navigate('/admin/productos')
    await settle()
    ;[...root.querySelectorAll('button')].find(b => b.textContent === 'Cerrar sesión').click()
    await settle()
    expect(location.pathname).toBe('/login')
    navigate('/admin/productos')
    await settle()
    expect(location.pathname).toBe('/login')
  })
})
```

```bash
npm test
```

Los tests de integración montan la app entera en jsdom y la recorren como un usuario: login, listado, paginación, borrado optimista con fallo de la API, edición y cierre de sesión.

> Cada llamada simulada a `fetch` devuelve una `Response` **nueva** (`mockImplementation(() => Promise.resolve(json(...)))`): el cuerpo de una respuesta solo se puede leer una vez.

## 10. Integración continua

Crea `.github/workflows/ci.yml`:

```yaml
# Tests y build en cada push y pull request
name: CI

on:
  push:
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
```

En cada push y pull request, GitHub instala las dependencias exactas del `package-lock.json` (`npm ci`), pasa los tests y comprueba que la app compila. Si algo falla, lo verás en la pestaña **Actions** del repo, y en los pull requests antes de fusionar.

## 11. Despliegue en GitHub Pages

### 1. El workflow

Crea `.github/workflows/deploy.yml`:

```yaml
# Publica la app en GitHub Pages en cada push a main
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm test
      # La app vive en https://<usuario>.github.io/<repo>/: la base es el nombre del repo
      - run: npm run build -- --base "/${{ github.event.repository.name }}/"
      # SPA: GitHub Pages sirve 404.html en rutas que no existen como archivo (/admin/productos…)
      - run: cp dist/index.html dist/404.html
      - uses: actions/configure-pages@v6
      - uses: actions/upload-pages-artifact@v5
        with:
          path: dist
      - id: deployment
        uses: actions/deploy-pages@v5
```

- **`--base "/<repo>/"`.** En GitHub Pages la app vive en `https://<usuario>.github.io/<repo>/`. El router del kit lee esa base: tus rutas siguen siendo `/admin/productos`, y `url()` y `generateUrl()` la añaden a los enlaces.
- **`404.html`.** Si alguien abre directamente `/<repo>/admin/productos`, ese archivo no existe y GitHub Pages sirve `404.html`. Al ser una copia de `index.html`, la app arranca y el router muestra la página correcta. El navegador recibe un código 404 para esa primera carga, pero el usuario ve la página normal.

### 2. Activa Pages

En GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

### 3. Publica

```bash
git add .
git commit -m "Panel de administración"
git push
```

En la pestaña **Actions** verás el despliegue. Al terminar, tu panel estará en `https://<usuario>.github.io/<repo>/admin`.

---

## Checklist profesional

Lo que acabas de aplicar, para usarlo en tus proyectos:

- [x] Capas separadas: páginas → estado → servicios → API.
- [x] Configuración por entorno, con valores por defecto seguros.
- [x] Un único cliente HTTP con timeout y token.
- [x] Respuestas de la API normalizadas en los servicios.
- [x] Rutas protegidas con guards, sin redirecciones abiertas.
- [x] La URL como estado (búsqueda, paginación) y cancelación de peticiones obsoletas.
- [x] Estados de carga, vacío y error en cada pantalla.
- [x] Actualizaciones optimistas con reversión.
- [x] Accesibilidad básica (`role="alert"`, `role="status"`, `autocomplete`).
- [x] Carga diferida de las páginas pesadas.
- [x] Tests de servicios, reglas e integración.
- [x] CI y despliegue automáticos.

## Siguientes pasos

- **Renovar la sesión:** DummyJSON ofrece `POST /auth/refresh` con el `refreshToken`. Llámalo antes de que caduque `expiraEn`.
- **Tratar un `401` en un solo sitio:** envuelve `api` para que, si una petición devuelve `401`, borre la sesión y lleve a `/login`.
- **Cachear los cambios locales:** como DummyJSON no persiste, puedes guardar en un signal los productos editados y aplicarlos sobre el listado.
- **Recetas útiles:** el [tema oscuro](RECETAS.md#6-tema-claro--oscuro) encaja muy bien en un panel.
