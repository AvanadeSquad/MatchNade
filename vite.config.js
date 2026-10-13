import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // Polling avoids transient file locks in Windows/OneDrive workspaces.
    watch: { usePolling: process.platform === 'win32', interval: 500 },
  },
  preview: { port: 4173, strictPort: true },
});
