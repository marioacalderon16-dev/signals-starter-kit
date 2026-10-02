/**
 * src/components/pages/InitialPage.js
 *
 * Página inicial: presentación de signals-starter-kit con la demo del clima
 */

import { define, c } from '@components/Component.js'
import { h } from '@features/dom/dom.js'

const REPO = 'https://github.com/marioacalderon16-dev/signals-starter-kit'

const features = [
  { titulo: 'Signals de grano fino', texto: 'Solo se actualiza el texto, la clase o el atributo que usa el valor que cambió.' },
  { titulo: 'Limpieza automática', texto: 'Los effects de una página se liberan solos al cambiar de ruta.' },
  { titulo: 'Seguro por defecto', texto: 'innerHTML bloqueado: insertar HTML exige un opt-in explícito.' },
  { titulo: 'Router incluido', texto: 'Rutas con params, query reactiva y enlaces que no recargan.' }
]

define('InitialPage', () => {
  return h('div', { className: 'min-h-screen bg-white text-slate-700' },

    // - Cabecera -
    h('header', { className: 'mx-auto flex max-w-3xl items-center gap-2 px-6 py-5' },
      h('img', { src: '/favicon.svg', alt: '', className: 'h-6 w-6' }),
      h('span', { className: 'flex-1 font-semibold text-slate-900' }, 'signals-starter-kit'),
      h('a', { href: REPO, className: 'text-sm hover:text-slate-900' }, 'GitHub')
    ),

    h('main', { className: 'mx-auto max-w-3xl px-6' },

      // - Hero -
      h('section', { className: 'py-16 text-center' },
        h('h1', { className: 'text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl' }, 'signals-starter-kit'),
        h('p', { className: 'mx-auto mt-4 max-w-xl text-lg text-slate-500' },
          'Un starter kit en JavaScript vanilla con signals, componentes y router. Sin dependencias en producción.'
        ),
        h('pre', { className: 'mx-auto mt-8 max-w-max whitespace-pre-wrap break-all rounded-lg sm:whitespace-pre bg-slate-900 px-4 py-3 text-left text-sm text-slate-100' },
          h('code', {}, 'npx degit marioacalderon16-dev/signals-starter-kit mi-app')
        ),
        h('div', { className: 'mt-6 flex justify-center gap-4 text-sm font-medium' },
          h('a', {
            href: `${REPO}/blob/main/docs/QUICKSTART.md`,
            className: 'rounded-lg bg-sky-600 px-4 py-2 text-white hover:bg-sky-700'
          }, 'Tutorial de inicio rápido'),
          h('a', {
            href: REPO,
            className: 'rounded-lg px-4 py-2 ring-1 ring-slate-200 hover:bg-slate-50'
          }, 'Ver en GitHub')
        )
      ),

      // - Features -
      h('section', { className: 'grid gap-6 border-t border-slate-100 py-12 sm:grid-cols-2' },
        features.map(({ titulo, texto }) =>
          h('div', {},
            h('h2', { className: 'font-semibold text-slate-900' }, titulo),
            h('p', { className: 'mt-1 text-sm text-slate-500' }, texto)
          )
        )
      ),

      // - Demo en vivo: ejemplo básico (contador) y ejemplo del clima -
      h('section', { className: 'border-t border-slate-100 py-12' },
        h('h2', { className: 'text-center font-semibold text-slate-900' }, 'Demo en vivo'),
        h('div', { className: 'mt-6 flex flex-wrap justify-center gap-8' },
          h('div', { className: 'flex flex-col items-center gap-3' },
            c('Contador'),
            h('p', { className: 'max-w-72 text-center text-sm text-slate-500' },
              'Básico: el número es un signal y el doble un computed.'
            )
          ),
          h('div', { className: 'flex flex-col items-center gap-3' },
            c('WeatherCard'),
            h('p', { className: 'max-w-72 text-center text-sm text-slate-500' },
              'Asíncrono: la temperatura es un signal y la descripción un computed.'
            )
          )
        )
      )
    ),

    h('footer', { className: 'py-8 text-center text-xs text-slate-400' }, 'Hecho con signals-starter-kit')
  )
})
