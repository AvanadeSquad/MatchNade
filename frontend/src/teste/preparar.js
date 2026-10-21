import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Desmonta o que cada teste renderizou e limpa o armazenamento do navegador simulado.
afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});
