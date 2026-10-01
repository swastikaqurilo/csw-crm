import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        target: 'https://4nq08695-5000.inc1.devtunnels.ms',   
        changeOrigin: true,
        secure: false,
      },
    },
  },
});