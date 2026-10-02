/**
 * src/main.js
 * 
 * Punto de entrada de la aplicación
 */

// 1. Importar estilos (Vite los procesa automáticamente) 
 
import './style.css'

// 2. Importar configuración y el logger
import config from './config/app.js'
import { logger } from './shared/utils/logger.js'

// 3. Registrar todos los componentes desde el barrel
import '@components/index.js'

// 4. Importar la función para renderizar y registrar las rutas de la app
import { renderApp, registerRoutes } from '@kit'
import { routes } from '@features/router/routes.config.js'

registerRoutes(routes) // v2: el router ya no importa routes.config.js por su cuenta

// Actualizar título
document.title = config.name

// 5. Arrancar la aplicación
const appContainer = document.getElementById('app')
if (appContainer) {
  renderApp('App', appContainer)
} else {
  logger.error('❌ No se encontró el contenedor #app')
}

// 6. Devtools solo en desarrollo (no llegan al build). Desactívalas con VITE_DEVTOOLS=false
if (import.meta.env.DEV && import.meta.env.VITE_DEVTOOLS !== 'false') {
  import('@shared/devtools/devtools.js').then(({ startDevtools }) => startDevtools())
}