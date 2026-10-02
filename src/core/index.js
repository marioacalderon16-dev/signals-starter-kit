/**
 * src/core/index.js
 * 
 * Barrel export del framework completo
 */

export { 
  signal, 
  computed, 
  effect, 
  untrack, 
  createRoot, 
  onCleanup, 
  getOwner, 
  getStats, 
  Signal, 
  Computed, 
  Effect, 
  Batch 
} from './signal.js'

export { resource } from './resource.js'
export { debounced } from './debounced.js'
