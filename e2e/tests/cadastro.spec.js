import { expect, test } from '@playwright/test';
import { API_URL, autenticarPagina, entrarPorApi, identificadorUnico } from './helpers/api.js';

const noCelular = () => test.info().project.name === 'celular';

// Preenche a etapa de dados. No desktop é uma tela só; no celular são duas (pessoais e da unidade).
async function preencherDados(page, { nome, unidade, cidade, estado }) {
  await page.getByLabel(/Nome completo/).fill(nome);
  if (noCelular()) {
    await page.getByLabel('Cidade', { exact: true }).fill(cidade);
    await page.getByLabel('Estado', { exact: true }).fill(estado);
  } else {
    await page.getByLabel(/Unidade de negócio/).fill(unidade);
    await page.getByLabel(/Cidade \/ Estado/).fill(`${cidade}, ${estado}`);
  }
  await page.getByRole('checkbox', { name: /oncordo com os Termos/ }).check();
  await page.getByRole('button', { name: noCelular() ? 'Conectar-se' : 'Continuar para Interesses' }).click();
  if (noCelular()) {
    await expect(page.getByRole('heading', { name: 'Dados da unidade' })).toBeVisible();
    await page.getByLabel(/Área de atuação/).fill(unidade);
    await page.getByRole('button', { name: 'Continuar' }).click();
  }
  await expect(page).toHaveURL(/\/cadastro\/interesses$/);
}

// Leva a etapa de interesses até a de preferências, escolhendo as tags indicadas.
async function escolherInteresses(page, nomes) {
  if (noCelular()) {
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: 'Preencher interesses manualmente' }).click();
  }
  const botaoSalvar = noCelular()
    ? page.getByRole('button', { name: 'Continuar' })
    : page.getByRole('button', { name: 'Salvar e Ver Preferências' });
  await expect(botaoSalvar).toBeDisabled();
  for (const nome of nomes) {
    await page.getByRole('button', { name: nome, exact: true }).click();
  }
  await expect(botaoSalvar).toBeEnabled();
  await botaoSalvar.click();
  if (noCelular()) {
    await expect(page.getByRole('heading', { name: 'Perfil de Colaborador' })).toBeVisible();
    await page.getByRole('button', { name: 'Avançar para preferências' }).click();
  }
  await expect(page).toHaveURL(/\/cadastro\/preferencias$/);
}

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
    await expect(page.getByRole('heading', { name: /Acesse sua conta|Bem-vindo ao Global Connect/ })).toBeVisible();
    await expect(page.getByLabel('Senha', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /linkedin/i })).toHaveCount(0);
  });

  test('pessoa nova completa o cadastro pelo caminho manual', async ({ page, request }) => {
    const email = `${identificadorUnico('nova')}@exemplo.test`;
    await autenticarPagina(page, await entrarPorApi(request, email));

    // Cadastro incompleto não abre as telas do dia a dia.
    await page.goto('/descobrir');
    await expect(page).toHaveURL(/\/cadastro\/dados$/);

    await preencherDados(page, { nome: 'Pessoa Nova de Teste', unidade: 'Experience Design', cidade: 'Recife', estado: 'PE' });
    await escolherInteresses(page, ['React', 'Node.js', 'Dança']);

    await page.getByRole('button', { name: noCelular() ? 'Salvar preferências' : 'Salvar preferências e acessar plataforma' }).click();
    await expect(page).toHaveURL(/\/descobrir$/);
    if (!noCelular()) await expect(page.getByText(/Solicitações desta semana: 0 de \d/)).toBeVisible();
  });

  test('sem IA configurada, analisar o texto leva ao caminho manual', async ({ page, request }) => {
    const email = `${identificadorUnico('bio')}@exemplo.test`;
    await autenticarPagina(page, await entrarPorApi(request, email));
    await page.goto('/cadastro/interesses');

    const texto = 'Curto React e Node, jogo xadrez nos fins de semana.';
    if (noCelular()) {
      await page.getByRole('button', { name: 'Continuar' }).click();
      await page.getByLabel('Resumo para importar').fill(texto);
      await page.getByRole('button', { name: 'Importar interesses' }).click();
      await expect(page.getByRole('heading', { name: 'Não conseguimos analisar agora' })).toBeVisible({ timeout: 15_000 });
      await page.getByRole('button', { name: /Preencher|manual/i }).first().click();
      await expect(page.getByRole('heading', { name: 'Quais são seus interesses?' })).toBeVisible();
    } else {
      await page.getByLabel('Resumo para análise').fill(texto);
      await page.getByRole('button', { name: 'Analisar com IA' }).click();
      await expect(page.getByText('Não conseguimos analisar agora')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/escolha seus interesses/i)).toBeVisible();
    }
  });

  test('criar uma tag nova a seleciona e recusa cargo', async ({ page, request }) => {
    const email = `${identificadorUnico('tag')}@exemplo.test`;
    await autenticarPagina(page, await entrarPorApi(request, email));
    await page.goto('/cadastro/interesses');
    if (noCelular()) {
      await page.getByRole('button', { name: 'Continuar' }).click();
      await page.getByRole('button', { name: 'Preencher interesses manualmente' }).click();
    }

    const campo = page.getByLabel('Adicionar outra skill');
    const adicionar = campo.locator('xpath=ancestor::form').getByRole('button', { name: 'Adicionar' });
    await campo.fill('Gerente');
    await adicionar.click();
    await expect(page.getByRole('alert')).toContainText(/não é válida/i);

    const nome = `Interesse ${identificadorUnico('t')}`;
    await campo.fill(nome);
    await adicionar.click();
    await expect(page.getByRole('button', { name: nome, exact: true })).toHaveAttribute('aria-pressed', 'true');
  });
});
