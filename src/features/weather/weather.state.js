/**
 * src/features/weather/weather.state.js
 * 
 * Estados y acciones
 */

import { signal, computed } from '@core/signal.js'

export const temperatura = signal(22)
export const cargando = signal(false)

// Valor derivado: descripción según la temperatura -
export const descripcion = computed(() => {
    const t = temperatura.get()
    if (t < 10) return 'Muy frío'
    if (t < 18) return 'Fresco'
    if (t < 26) return 'Agradable'
    return 'Caluroso'
})

// - Acción del botón -
export const actualizar = () => {
    cargando.set(true)

    // Simula una llamda a una API (1.5 segundos)
    setTimeout(() => {
        const nueva = Math.floor(Math.random() * 35) + 5 // <- entre 5 y 45 grados centrígrados
        temperatura.set(nueva)
        cargando.set(false)
    }, 1500)
}