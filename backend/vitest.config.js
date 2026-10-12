import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Cada arquivo inicializa um banco PGlite no beforeAll. Com a máquina ocupada (CI, várias
    // suítes ao mesmo tempo), essa inicialização foi medida em até 15 s, acima dos 10 s padrão.
    hookTimeout: 30000,
  },
});
