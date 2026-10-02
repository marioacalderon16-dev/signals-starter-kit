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
