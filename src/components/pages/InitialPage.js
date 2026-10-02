/**
 * src/components/pages/InitialPage.js
 * 
 * Página inicial
 */

import { define, c } from '@components/Component.js'
import { h } from '@features/dom/dom.js'

define('InitialPage', () => {
  return h('main', { className: 'flex min-h-screen items-center justify-center bg-slate-100' },
    c('WeatherCard')
  )
})