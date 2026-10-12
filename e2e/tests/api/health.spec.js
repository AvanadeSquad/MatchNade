const { test, expect } = require('@playwright/test');

// Verifica se a API esta de pe. So roda quando E2E_API_URL esta definida.
test.describe('API', () => {
  test.skip(!process.env.E2E_API_URL, 'defina E2E_API_URL para testar a API');

  test('GET /health responde 200', async ({ request }) => {
    const resposta = await request.get(`${process.env.E2E_API_URL}/health`);
    expect(resposta.status()).toBe(200);
    expect(await resposta.json()).toMatchObject({ status: 'ok' });
  });
});
