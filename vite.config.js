import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ═══════════════════════════════════════════════════════════════
//  Vite config — EPJ App Globale v2.0.0
//
//  Améliorations v2.0.0 :
//   • manualChunks : sépare firebase et xlsx du bundle applicatif
//     → bundle principal réduit (chargement initial plus rapide)
//     → mise en cache navigateur plus efficace (xlsx ne change
//       presque jamais)
//   • drop_console en prod : retire les console.log/info/debug
//     du bundle prod (garde console.warn/error pour Sentry)
//   • sourcemap activée en prod : nécessaire pour que Sentry
//     puisse mapper les stack-traces minifiées
//
//  FIX PERF-1 : la condition reposait sur process.env.NODE_ENV, qui n'est
//  PAS positionné à 'production' lors de l'évaluation de ce fichier par
//  `vite build` → le drop des console.log ne s'appliquait jamais. On passe
//  à la forme fonction de defineConfig et on lit `mode` (= 'production'
//  par défaut sur `vite build`), seule source fiable ici.
// ═══════════════════════════════════════════════════════════════

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production'
  return {
    plugins: [react()],
    build: {
      sourcemap: true,
      // Minification avec esbuild (par défaut Vite), mais on configure
      // les options pour droper les console.log en prod
      minify: 'esbuild',
      rollupOptions: {
        output: {
          manualChunks: {
            // Firebase = ~400 Ko, change rarement → chunk dédié, cache long
            'vendor-firebase': [
              'firebase/app',
              'firebase/auth',
              'firebase/firestore',
              'firebase/storage',
              'firebase/functions',
            ],
            // xlsx = ~700 Ko, chargé que dans 3 écrans (catalog import,
            // outils import, Esabora export) → chunk séparé chargé à la
            // demande par Vite si l'import devient dynamique plus tard
            'vendor-xlsx': ['xlsx'],
            // React + react-dom = ~140 Ko, change rarement
            'vendor-react': ['react', 'react-dom'],
          },
        },
      },
    },
    esbuild: {
      // drop console.log/debug/info en prod (garde warn/error)
      // pour ne pas polluer la console des utilisateurs ET pour
      // alléger légèrement le bundle.
      drop: isProd ? ['debugger'] : [],
      pure: isProd
        ? ['console.log', 'console.debug', 'console.info']
        : [],
    },
  }
})
