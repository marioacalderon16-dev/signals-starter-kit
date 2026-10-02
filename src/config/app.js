/**
 * src/config/app.js
 * 
 * Cargar configuración desde .env
 */

const config = {
  name: import.meta.env.VITE_APP_NAME || 'signals-starter-kit',
  version: import.meta.env.VITE_APP_VERSION || '1.0.0',
  mode: import.meta.env.MODE || 'development'
}

export default config