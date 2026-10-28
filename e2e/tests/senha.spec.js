import { expect, test } from '@playwright/test';
import { autenticarPagina, chamar, criarPessoaPronta, interessesExclusivos } from './helpers/api.js';

const SENHA = 'uma senha comprida e boa';

// No celular o perfil é um menu de seções; no desktop os controles ficam na própria página.
async function abrirSecao(page, nome) {
  await page.goto('/eu');
  if (page.viewportSize().width < 900) await page.getByRole('button', { name: nome, exact: true }).click();
}

async function pedirLogin(page, email, senha) {
  await page.goto('/login');
  await page.getByLabel(/^E-mail/).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(senha);
  await page.getByRole('button', { name: /Acessar o Global Connect/ }).click();
}

test.describe('login por senha', () => {
  test('a pessoa define a senha no perfil e depois entra só com e-mail e senha', async ({ page, request, browser, baseURL, contextOptions }) => {
    const pessoa = await criarPessoaPronta(request, { nome: 'Sônia Senha', ...interessesExclusivos() });
    await autenticarPagina(page, pessoa.token);

    await abrirSecao(page, 'Privacidade');
    await page.getByRole('button', { name: /Definir senha/ }).click();
    const dialogo = page.getByRole('dialog', { name: 'Definir senha' });
    await dialogo.getByLabel(/^Nova senha/).fill(SENHA);
    await dialogo.getByLabel('Confirmar nova senha').fill(SENHA);
    await dialogo.getByRole('button', { name: 'Salvar senha' }).click();
    await expect(page.getByText(/Senha definida/)).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Em um navegador sem a sessão anterior, só a senha leva a pessoa para dentro.
    const { viewport, isMobile, hasTouch } = test.info().project.use;
    const contexto = await browser.newContext({ ...contextOptions, viewport, isMobile, hasTouch, baseURL });
    try {
      const outra = await contexto.newPage();
      await pedirLogin(outra, pessoa.email, SENHA);
      await expect(outra).toHaveURL(/\/descobrir$/);

      // O botão do perfil agora oferece a troca.
      await abrirSecao(outra, 'Privacidade');
      await expect(outra.getByRole('button', { name: /Alterar senha/ })).toBeVisible();
    } finally {
      await contexto.close();
    }
  });

  test('senha errada recebe uma mensagem que não revela se o e-mail tem conta', async ({ page, request }) => {
    const pessoa = await criarPessoaPronta(request, { nome: 'Tadeu Senha', ...interessesExclusivos() });
    await chamar(request, pessoa.token, 'put', '/auth/senha', { nova_senha: SENHA });

    await pedirLogin(page, pessoa.email, 'senha errada de propósito');
    await expect(page.getByRole('alert')).toContainText('E-mail ou senha incorretos');
    await expect(page).toHaveURL(/\/login$/);

    await pedirLogin(page, 'ninguem@exemplo.test', 'senha errada de propósito');
    await expect(page.getByRole('alert')).toContainText('E-mail ou senha incorretos');
  });

  test('senha fraca é recusada no diálogo', async ({ page, request }) => {
    const pessoa = await criarPessoaPronta(request, { nome: 'Ugo Senha', ...interessesExclusivos() });
    await autenticarPagina(page, pessoa.token);

    await abrirSecao(page, 'Privacidade');
    await page.getByRole('button', { name: /Definir senha/ }).click();
    const dialogo = page.getByRole('dialog', { name: 'Definir senha' });
    await dialogo.getByLabel(/^Nova senha/).fill('aaaaaaaaaaaa');
    await dialogo.getByLabel('Confirmar nova senha').fill('aaaaaaaaaaaa');
    await dialogo.getByRole('button', { name: 'Salvar senha' }).click();
    await expect(dialogo.getByRole('alert')).toContainText(/repetitiva/);
  });
});
