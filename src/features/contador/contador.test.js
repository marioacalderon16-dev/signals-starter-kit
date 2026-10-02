import { describe, it, expect, beforeEach } from 'vitest'
import { contador, doble, incrementar, decrementar, reiniciar } from './contador.state.js'
import { c } from '@components/Component.js'
import '@components/contador/Contador.js'

const tick = () => new Promise(r => setTimeout(r))

describe('contador', () => {
  beforeEach(() => reiniciar())

  it('incrementar, decrementar y reiniciar; doble es derivado', () => {
    incrementar()
    incrementar()
    decrementar()
    expect([contador.get(), doble.get()]).toEqual([1, 2])
    reiniciar()
    expect(contador.get()).toBe(0)
  })

  it('el componente refleja los cambios al pulsar los botones', async () => {
    const el = c('Contador')
    const boton = (label) => el.querySelector(`button[aria-label="${label}"]`)
    boton('Sumar uno').click()
    boton('Sumar uno').click()
    boton('Restar uno').click()
    await tick()
    expect(el.textContent).toContain('Doble: 2')
    boton('Reiniciar').click()
    await tick()
    expect(el.textContent).toContain('Doble: 0')
  })
})
