// src/components/App.js
// Componente raíz de la aplicación

import { define, c } from '@components/Component.js'
import { h } from '@features/dom/dom.js'

define('App', () => {
    const container = h('div', {},
        h('div', { className: 'app-wrapper' },
            c('Router')
        )
    )

    return container
})