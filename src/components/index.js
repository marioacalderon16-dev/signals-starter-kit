// src/components/index.js

// Sistema de componentes: define, c (composición), renderApp
import './Component.js'
// Componente router que maneja la navegación
import './Router.js'
// Componente raíz de la aplicación
import './App.js'

// Registra los componentes de todas las subcarpetas (excluye este archivo, los tests
// y los *.lazy.js, que se cargan bajo demanda con `load` en la ruta)
const componentModules = import.meta.glob(
  ['./**/*.js', '!./index.js', '!./**/*.test.js', '!./**/*.lazy.js'],
  { eager: true }
)

// Los componentes ya se registran automáticamente a sí mismos con define()
// No necesitamos hacer nada más aquí