import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Testes de unidade em jsdom. Ficam ao lado do código, com o sufixo .test.js ou .test.jsx.
export default defineConfig({
  plugins: [react()],
  test: {
  environment: 'jsdom',
  environmentOptions: {
    jsdom: {
      url: 'http://localhost:5173/',
    },
  },
  setupFiles: ['./src/teste/preparar.js'],
  include: ['src/**/*.test.{js,jsx}'],
  restoreMocks: true,
},
});
