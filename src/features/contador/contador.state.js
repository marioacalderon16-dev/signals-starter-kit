/**
 * src/features/contador/contador.state.js
 *
 * Ejemplo básico: un signal, un computed y tres acciones
 */

import { signal, computed } from '@kit'

// - Estado -
export const contador = signal(0)

// - Valor derivado: se recalcula solo cuando cambia `contador` -
export const doble = computed(() => contador.get() * 2)

// - Acciones -
export const incrementar = () => contador.set(contador.get() + 1)
export const decrementar = () => contador.set(contador.get() - 1)
export const reiniciar = () => contador.set(0)
