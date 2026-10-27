import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Desmonta os componentes e limpa o armazenamento simulado.
afterEach(() => {
  cleanup();

  try {
    window.localStorage.clear();
  } catch {
    // O armazenamento pode não estar disponível no ambiente de teste.
  }

  try {
    window.sessionStorage.clear();
  } catch {
    // A sessão pode não estar disponível no ambiente de teste.
  }
});
