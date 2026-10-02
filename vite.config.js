// vite.config.js
import { defineConfig } from 'vite';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';

/* ------------------------------------------------------------------ */
/* 1.  FUNCIÓN ENVOLVENTE                                              */
/* ------------------------------------------------------------------ */
// defineConfig() NO añade funcionalidad, pero proporciona:
// · autocompletado TypeScript en IDEs
// · validación de esquema al arrancar Vite
// · mejor DX (Developer eXperience)
export default defineConfig({

  plugins: [tailwindcss()],

  // Vitest reutiliza esta config (alias incluidos). jsdom simula el DOM.
  test: {
    environment: 'jsdom',
    // Tras cada test se restauran los espías (vi.spyOn), las variables (vi.stubEnv) y los
    // globales (vi.stubGlobal): un test que falla no deja mocks puestos para los siguientes
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
  },

/* ================================================================== */
/*  I.  RUTAS Y ALIAS                                                */
/* ================================================================== */

  /* 1.1  root                                                        */
  // Qué carpeta considera Vite como “raíz” del proyecto.
  // · Por defecto es process.cwd() (donde esté el vite.config).
  // · Útil cuando tu index.html NO está al lado de package.json.
  root: './',

  /* 1.2  publicDir                                                   */
  // Carpeta cuyo contenido se copia “tal-cual” a dist/ sin procesar.
  // · Ideal para favicon, robots.txt, imágenes estáticas, etc.
  // · Se sirven en / durante dev y en / en prod.
  publicDir: 'public',

  /* 1.3  resolve.alias                                               */
  // Atajos de importación: evita ../../../../
  // · Mejora la legibilidad y el refactor.
  // · Funciona en JS, TS, CSS, Vue, etc.
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@core': path.resolve(__dirname, './src/core'),
      '@components': path.resolve(__dirname, './src/components'),
      '@features': path.resolve(__dirname, './src/features'),
      '@shared': path.resolve(__dirname, './src/shared')
    },
  },

/* ================================================================== */
/*  II.  SERVIDOR DE DESARROLLO (vite dev)                           */
/* ================================================================== */
  server: {
    port: 4321,        // Puerto fijo (por defecto 5173)
    open: true,        // Abre el navegador automáticamente
    strictPort: false, // Si 4321 está ocupado, prueba 4322, 4323…
  },

/* ================================================================== */
/*  III.  BUILD  (vite build)                                        */
/* ================================================================== */
  build: {
    outDir: 'dist',              // Carpeta de salida
    assetsDir: 'assets',         // Sub-carpeta para CSS/JS/IMG
    sourcemap: true,             // Genera .map → debugging en prod
    minify: 'esbuild',           // 'terser' | 'esbuild'. esbuild viene incluido con Vite (terser requiere instalarlo)
    rollupOptions: {
      output: {
        /* 3.1  Nombres con hash → cache-busting                           */
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
    /* 3.2  Alerta si un chunk > 500 kB                                   */
    chunkSizeWarningLimit: 500,
  },

/* ================================================================== */
/*  IV.  DEPENDENCIAS  (optimizeDeps)                                */
/* ================================================================== */
  // Vite pre-empaqueta deps de terceros para convertirlas en ESM rápidas.
  // · Casi nunca necesitas tocarlo; úsalo cuando:
  //   – una librería CommonJS da error en dev
  //   – quieres excluir algo enorme que solo usas en cierta ruta
  optimizeDeps: {
    include: [], // forzar pre-bundling de algo que no detecta
    exclude: [], // dejarlo intacto (raro)
  },

/* ================================================================== */
/*  V.  CSS                                                          */
/* ================================================================== */
  css: {
    devSourcemap: true,          // Mapea CSS a su origen en dev
    // Para SCSS: instalar `sass` y añadir preprocessorOptions.scss.additionalData
  },

/* ================================================================== */
/*  VI.  PREVIEW  (vite preview)                                    */
/* ================================================================== */
  // Sirve la carpeta dist/ tras el build para ver cómo quedaría en prod.
  preview: {
    port: 8080,
    open: true,
  },

});