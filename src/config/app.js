/**
 * src/config/app.js
 * 
 * Cargar configuración desde .env
 */

// Solo se empaqueta el campo version (Vite importa campos sueltos de un JSON)
import { version } from '../../package.json'

const config = {
  name: import.meta.env.VITE_APP_NAME || 'signals-starter-kit',
  version: import.meta.env.VITE_APP_VERSION || version,
  mode: import.meta.env.MODE || 'development',
  apiUrl: import.meta.env.VITE_API_URL || '',
  apiTimeout: Number(import.meta.env.VITE_API_TIMEOUT) || 0
}

export default config
