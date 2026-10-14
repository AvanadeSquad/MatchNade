import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Cada arquivo inicializa um banco PGlite no beforeAll. Com a máquina ocupada (CI, várias
    // suítes ao mesmo tempo), essa inicialização pode passar dos 10 s padrão do vitest.
    hookTimeout: 30000,
  },
});
