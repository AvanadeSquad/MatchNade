import { expect, test } from '@playwright/test';
import { API_URL, autenticarPagina, entrarPorApi, identificadorUnico } from './helpers/api.js';

test.describe('acesso e cadastro', () => {
  test('API responde e rotas protegidas exigem login', async ({ request }) => {
    const saude = await request.get(`${API_URL}/health`);
    expect(saude.status()).toBe(200);
    expect(await saude.json()).toEqual({ status: 'ok' });
    expect((await request.get(`${API_URL}/profile`)).status()).toBe(401);
  });

  test('sem sessão, uma tela interna leva ao login', async ({ page }) => {
    await page.goto('/descobrir');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Boas-vindas ao Avanade Connect' })).toBeVisible();
  });

  test('pessoa nova completa o cadastro pelo caminho manual', async ({ page, request }) => {
    const email = `${identificadorUnico('nova')}@exemplo.test`;
    await autenticarPagina(page, await entrarPorApi(request, email));

    // Cadastro incompleto não abre as telas do dia a dia.
    await page.goto('/descobrir');
    await expect(page).toHaveURL(/\/bem-vindo$/);

    await page.getByLabel('Nome completo', { exact: true }).fill('Pessoa Nova de Teste');
    await page.getByLabel('Unidade', { exact: true }).fill('Experience Design');
    await page.getByLabel('Cidade', { exact: true }).fill('Recife');
    await page.getByLabel(/Li e concordo/).check();
    await page.getByRole('button', { name: 'Conectar-se' }).click();

    await expect(page).toHaveURL(/\/perfil\/bio$/);
    await page.getByRole('button', { name: 'Preencher interesses manualmente' }).click();

    await expect(page).toHaveURL(/\/perfil\/interesses$/);
    const salvar = page.getByRole('button', { name: 'Salvar interesses' });
    await expect(salvar).toBeDisabled();
    for (const nome of ['React', 'Node.js', 'Xadrez']) {
      await page.getByRole('button', { name: nome, exact: true }).click();
    }
    await expect(page.getByText('3 selecionados', { exact: true })).toBeVisible();
    await expect(salvar).toBeEnabled();
    await salvar.click();

    await expect(page).toHaveURL(/\/perfil\/objetivos$/);
    const continuar = page.getByRole('button', { name: 'Continuar' });
    await expect(continuar).toBeDisabled();
    await page.getByRole('button', { name: /Networking/ }).click();
    await continuar.click();

    await expect(page).toHaveURL(/\/descobrir$/);
    await expect(page.getByText(/Solicitações desta semana: 0 de 3/)).toBeVisible();
  });

  test('sem IA configurada, analisar a bio leva ao caminho manual', async ({ page, request }) => {
    const email = `${identificadorUnico('bio')}@exemplo.test`;
    await autenticarPagina(page, await entrarPorApi(request, email));
    await page.goto('/perfil/bio');

    const analisar = page.getByRole('button', { name: 'Analisar minha bio' });
    await expect(analisar).toBeDisabled();
    await page.getByRole('textbox').fill('Curto React e Node, jogo xadrez nos fins de semana.');
    await analisar.click();

    await expect(page.getByRole('heading', { name: 'Não conseguimos analisar agora' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Preencher manualmente' }).click();
    await expect(page).toHaveURL(/\/perfil\/interesses$/);
  });

  test('criar uma tag nova a seleciona e recusa cargo', async ({ page, request }) => {
    const email = `${identificadorUnico('tag')}@exemplo.test`;
    await autenticarPagina(page, await entrarPorApi(request, email));
    await page.goto('/perfil/interesses');

    const campo = page.getByLabel('Nome da nova tag');
    await campo.fill('Gerente');
    await page.getByRole('button', { name: 'Criar', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText(/não é válida/i);

    const nome = `Interesse ${identificadorUnico('t')}`;
    await campo.fill(nome);
    await page.getByRole('button', { name: 'Criar', exact: true }).click();
    await expect(page.getByRole('button', { name: nome, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('1 selecionado', { exact: true })).toBeVisible();
  });
});
