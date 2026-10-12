import { expect, test } from '@playwright/test';
import { autenticarPagina, chamar, criarPessoaPronta, interessesExclusivos } from './helpers/api.js';

async function abrirComo(browser, contextOptions, baseURL, pessoa) {
  const contexto = await browser.newContext({ ...contextOptions, baseURL });
  const pagina = await contexto.newPage();
  await autenticarPagina(pagina, pessoa.token);
  return { contexto, pagina };
}

const cartaoDe = (pagina, nome) => pagina.getByRole('article', { name: `Sugestão: ${nome}` });

test.describe('conexões', () => {
  test('match mútuo libera o chat com a sugestão de abertura', async ({ browser, request, baseURL, contextOptions }) => {
    const tags = interessesExclusivos();
    const ana = await criarPessoaPronta(request, { nome: 'Ana Exemplo', ...tags });
    const bruno = await criarPessoaPronta(request, { nome: 'Bruno Exemplo', ...tags });
    const { contexto: contextoAna, pagina: paginaAna } = await abrirComo(browser, contextOptions, baseURL, ana);
    const { contexto: contextoBruno, pagina: paginaBruno } = await abrirComo(browser, contextOptions, baseURL, bruno);

    try {
      // As duas pessoas abrem a descoberta e veem uma à outra.
      await paginaAna.goto('/descobrir');
      await paginaBruno.goto('/descobrir');
      await expect(cartaoDe(paginaAna, 'Bruno Exemplo')).toBeVisible();
      await expect(cartaoDe(paginaBruno, 'Ana Exemplo')).toBeVisible();

      // Ana demonstra interesse e a conexão fica aguardando.
      await paginaAna.getByRole('button', { name: 'Demonstrar interesse' }).click();
      await expect(paginaAna.getByText(/Interesse enviado para Bruno Exemplo/)).toBeVisible();
      await expect(paginaAna.getByText('Solicitações desta semana: 1 de 3')).toBeVisible();

      // Bruno, que ainda tinha o cartão de Ana aberto, também demonstra interesse: vira match.
      await paginaBruno.getByRole('button', { name: 'Demonstrar interesse' }).click();
      await expect(paginaBruno.getByRole('heading', { name: 'É um match!' })).toBeVisible();

      // O chat abre com a sugestão de abertura, e a mensagem chega para a outra pessoa.
      await paginaBruno.getByRole('button', { name: 'Enviar mensagem' }).click();
      await expect(paginaBruno.getByLabel('Sugestão para começar a conversa')).toBeVisible();
      await paginaBruno.getByLabel('Mensagem').fill('Oi, Ana! Vi que temos interesses em comum.');
      await paginaBruno.getByRole('button', { name: 'Enviar', exact: true }).click();
      await expect(paginaBruno.getByRole('log')).toContainText('Oi, Ana! Vi que temos interesses em comum.');

      await paginaAna.goto('/conexoes');
      await paginaAna.getByRole('tab', { name: /Confirmadas/ }).click();
      await paginaAna.getByRole('link', { name: 'Enviar mensagem' }).click();
      await expect(paginaAna.getByRole('log')).toContainText('Oi, Ana! Vi que temos interesses em comum.');

      // A resposta de Ana chega a Bruno pelo polling, sem recarregar a página.
      await paginaAna.getByLabel('Mensagem').fill('Oi, Bruno! Que bom falar com você.');
      await paginaAna.getByRole('button', { name: 'Enviar', exact: true }).click();
      await expect(paginaBruno.getByRole('log')).toContainText('Que bom falar com você.', { timeout: 15_000 });
    } finally {
      await contextoAna.close();
      await contextoBruno.close();
    }
  });

  test('aceitar uma solicitação recebida abre o match', async ({ browser, request, baseURL, contextOptions }) => {
    const tags = interessesExclusivos();
    const carla = await criarPessoaPronta(request, { nome: 'Carla Exemplo', ...tags });
    const diego = await criarPessoaPronta(request, { nome: 'Diego Exemplo', ...tags });
    await chamar(request, carla.token, 'post', '/matches', { receiver_id: diego.id });

    const { contexto, pagina } = await abrirComo(browser, contextOptions, baseURL, diego);
    try {
      await pagina.goto('/conexoes');
      await expect(pagina.getByText('Carla Exemplo')).toBeVisible();
      await pagina.getByRole('button', { name: 'Aceitar' }).click();
      await expect(pagina.getByRole('heading', { name: 'É um match!' })).toBeVisible();
      await pagina.getByRole('button', { name: 'Continuar descobrindo' }).click();
      await expect(pagina).toHaveURL(/\/descobrir$/);
    } finally {
      await contexto.close();
    }
  });

  test('o chat não abre sem match', async ({ page, request }) => {
    const tags = interessesExclusivos();
    const elisa = await criarPessoaPronta(request, { nome: 'Elisa Exemplo', ...tags });
    const fabio = await criarPessoaPronta(request, { nome: 'Fábio Exemplo', ...tags });
    const pedido = await (await chamar(request, elisa.token, 'post', '/matches', { receiver_id: fabio.id })).json();

    await autenticarPagina(page, elisa.token);
    await page.goto(`/chat/${pedido.match_id}`);
    await expect(page.getByRole('heading', { name: 'Conversa indisponível' })).toBeVisible();
    await expect(page.getByLabel('Mensagem')).toHaveCount(0);

    const resposta = await chamar(request, elisa.token, 'get', `/matches/${pedido.match_id}/messages`);
    expect(resposta.status()).toBe(403);
  });

  test('bloquear faz a pessoa sumir da descoberta', async ({ page, request }) => {
    const tags = interessesExclusivos();
    const gabi = await criarPessoaPronta(request, { nome: 'Gabi Exemplo', ...tags });
    const hugo = await criarPessoaPronta(request, { nome: 'Hugo Exemplo', ...tags });

    await autenticarPagina(page, gabi.token);
    await page.goto('/descobrir');
    await expect(cartaoDe(page, 'Hugo Exemplo')).toBeVisible();

    await page.getByRole('link', { name: 'Ver perfil completo' }).click();
    await page.getByRole('button', { name: 'Mais opções' }).click();
    await page.getByRole('menuitem', { name: 'Bloquear' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Bloquear' }).click();

    await expect(page).toHaveURL(/\/descobrir$/);
    await expect(cartaoDe(page, 'Hugo Exemplo')).toHaveCount(0);
    const perfil = await chamar(request, gabi.token, 'get', `/employees/${hugo.id}`);
    expect(perfil.status()).toBe(404);
  });
});

test.describe('perfil e privacidade', () => {
  test('pausar a exposição e ajustar a cota semanal ficam salvos', async ({ page, request }) => {
    const tags = interessesExclusivos();
    const iris = await criarPessoaPronta(request, { nome: 'Íris Exemplo', ...tags });
    await autenticarPagina(page, iris.token);
    await page.goto('/eu');

    const pausa = page.getByLabel(/Pausar minha exposição/);
    await pausa.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await pausa.check();
    await page.getByRole('button', { name: 'Aumentar' }).click();
    await expect(page.getByText('Exposição pausada.')).toBeVisible();

    await page.reload();
    await expect(page.getByLabel(/Pausar minha exposição/)).toBeChecked();
    await expect(page.getByRole('group', { name: /Solicitações por semana/ }).locator('output')).toHaveText('4');
  });
});
