// Settings for Vite, the tool that runs the game while we build it (npm run dev)
// and packs it up for the web and the phone app (npm run build).
import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // relative paths, so the packed game also works inside the phone app
  server: { port: 5173, host: true }, // host: true lets a phone on the same Wi-Fi open it too
  build: { outDir: 'dist', chunkSizeWarningLimit: 1500 }
});
