import { describe, it, expect } from 'vitest'
import * as kit from '@kit'
import * as signal from '@core/signal.js'
import { resource } from '@core/resource.js'
import { HttpClient } from '@core/httpClient.js'
import * as dom from '@features/dom/dom.js'
import * as componentes from '@components/Component.js'
import * as router from '@features/router/router.state.js'
import { Link } from '@features/router/Link.js'
import { persist } from '@shared/utils/persist.js'

describe("punto de entrada único '@kit'", () => {
  it('reexporta la API pública (los mismos objetos, no copias)', () => {
    const esperado = {
      signal: signal.signal, computed: signal.computed, effect: signal.effect, untrack: signal.untrack,
      createRoot: signal.createRoot, onCleanup: signal.onCleanup, getOwner: signal.getOwner,
      getStats: signal.getStats, Batch: signal.Batch,
      resource, HttpClient, persist,
      h: dom.h, For: dom.For, Show: dom.Show, fragment: dom.fragment, text: dom.text,
      define: componentes.define, c: componentes.c, render: componentes.render, renderApp: componentes.renderApp,
      Link, navigate: router.navigate, replace: router.replace, url: router.url,
      currentPath: router.currentPath, currentQuery: router.currentQuery
    }
    for (const [nombre, valor] of Object.entries(esperado)) {
      expect(kit[nombre], nombre).toBe(valor)
    }
  })
})
