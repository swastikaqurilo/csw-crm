// import tailwindcss from "@tailwindcss/vite";
// import { defineConfig } from 'vite';
// import react from '@vitejs/plugin-react';

// export default defineConfig({
//   plugins: [react(), tailwindcss()],
//   server: {
//     host: true,
//     strictPort: true,
//     allowedHosts: true,
//     proxy: {
//       '/api': {
//         target: 'http://127.0.0.1:5000',
        
//         changeOrigin: true,
//         secure: false,
//       },
//     },
//   },
// });

import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
  },

  plugins: [
    react(),
    tailwindcss(),

    VitePWA({
      registerType: "prompt",
      includeAssets: ["favicon.ico", "apple-touch-icon-180x180.png"],

      manifest: {
        name: "CSW CRM",
        short_name: "CSW",
        description: "Offline-capable CRM and ERP workspace",
        start_url: "/",
        display: "standalone",
        theme_color: "#ffffff",
        background_color: "#ffffff",
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },

      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],

  server: {
    host: true,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});