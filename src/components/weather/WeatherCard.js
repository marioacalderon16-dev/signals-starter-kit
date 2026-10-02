/**
 * src/components/weather/WeatherCard.js
 * 
 * Componete clima
 */

import { define } from '@components/Component.js'
import { h } from '@features/dom/dom.js'
import { signal, computed } from '@core/signal.js'

import { temperatura, cargando, descripcion, actualizar } from '@features/weather/weather.state.js'

define('WeatherCard', () => {

    // - Estados del componente -
    const ciudad = 'Fusagasuga'

    // - Construir el DOM con h() -
    const btnTexto = computed(() => cargando.get() ? 'Consultando...' : 'Actualizar')

    return h('div', { className: 'w-72 rounded-2xl bg-white p-6 text-center shadow-lg ring-1 ring-slate-200' }, 
        h('span', { className: 'text-sm font-medium uppercase tracking-wide text-slate-500' }, ciudad),
        h('div', { className: 'mt-2 text-6xl font-bold text-slate-900' },
            temperatura, // <- signal directo: se actualiza sola
            h('span', { className: 'text-2xl font-normal text-slate-400' }, ' °C')
        ),
        h('p', { className: 'mt-1 text-lg text-slate-600' }, descripcion), // <- computed
        h('button', {
            className: 'mt-6 w-full rounded-lg bg-sky-600 px-4 py-2 font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60',
            disabled: cargando,
            onClick: actualizar
        }, btnTexto) // <- computed como hijo 
    )
})