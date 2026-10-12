// Configuração do Playwright.
// Sobe sozinho a API (banco em memória, com dados fictícios) e o frontend em portas próprias,
// para os testes não dependerem de nada já rodando nem sujarem o ambiente de desenvolvimento.
import { defineConfig } from '@playwright/test';

const PORTA_API = 3100;
const PORTA_WEB = 5174;
const urlApi = `http://localhost:${PORTA_API}/api/v1`;
const urlWeb = `http://localhost:${PORTA_WEB}`;

// Os testes e os servidores compartilham o mesmo banco, então rodam em sequência.
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: urlWeb,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node src/index.js',
      cwd: '../backend',
      url: `${urlApi}/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        PORT: String(PORTA_API),
        NODE_ENV: 'test',
        FRONTEND_URL: urlWeb,
        E2E_TEST_MODE: 'true',
        AUTH_DEV_LOGIN: 'false',
        RATE_LIMIT_DISABLED: 'true',
        DATABASE_URL: '',
        PGLITE_DATA_DIR: '',
        GEMINI_API_KEY: '',
        GROQ_API_KEY: '',
      },
    },
    {
      command: `npm run dev -- --port ${PORTA_WEB} --strictPort`,
      cwd: '../frontend',
      url: urlWeb,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { VITE_API_URL: urlApi, VITE_GOOGLE_CLIENT_ID: '' },
    },
  ],
  projects: [
    {
      // layout principal: menu lateral e conteúdo em colunas
      name: 'desktop',
      use: { viewport: { width: 1280, height: 800 } },
    },
    {
      // adaptação responsiva: coluna única e barra inferior (390x844, o tamanho das telas do design)
      name: 'celular',
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
  ],
});
