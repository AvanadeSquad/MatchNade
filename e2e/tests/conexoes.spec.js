import { expect, test } from '@playwright/test';
import { autenticarPagina, chamar, criarPessoaPronta, interessesExclusivos } from './helpers/api.js';

const noCelular = () => test.info().project.name === 'celular';

// Abre um navegador separado com o tamanho de tela do projeto atual (desktop ou celular),
// porque browser.newContext não herda viewport, isMobile e hasTouch da configuração.
async function abrirComo(browser, contextOptions, baseURL, pessoa) {
  const { viewport, isMobile, hasTouch } = test.info().project.use;
  const contexto = await browser.newContext({ ...contextOptions, viewport, isMobile, hasTouch, baseURL });
  const pagina = await contexto.newPage();
  await autenticarPagina(pagina, pessoa.token);
  return { contexto, pagina };
}

const cartaoDe = (pagina, nome) => pagina.getByRole('article', { name: `Sugestão: ${nome}` });

// No desktop o botão é "Conectar com <nome>"; no celular é o botão redondo com o nome na descrição.
const demonstrarInteresse = (pagina) =>
  noCelular()
    ? pagina.getByRole('button', { name: /Demonstrar interesse em/ })
    : pagina.getByRole('button', { name: /^Conectar com / });

const idDoMatch = (pagina) => pagina.url().match(/\/match\/(\d+)/)[1];

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
      await demonstrarInteresse(paginaAna).click();
      await expect(paginaAna.getByText(/Interesse enviado para Bruno Exemplo/)).toBeVisible();
      if (!noCelular()) await expect(paginaAna.getByText(/Solicitações desta semana: 1 de \d/)).toBeVisible();

      // Bruno, que ainda tinha o cartão de Ana aberto, também demonstra interesse: vira match.
      await demonstrarInteresse(paginaBruno).click();
      await expect(paginaBruno.getByRole('heading', { name: /É um Match( Bilateral)?!/ })).toBeVisible();
      const match = idDoMatch(paginaBruno);

      // O chat abre com a sugestão de abertura, e a mensagem chega para a outra pessoa.
      if (noCelular()) await paginaBruno.getByRole('link', { name: 'Iniciar Coffee Chat' }).waitFor();
      else await expect(paginaBruno.getByRole('link', { name: 'Enviar mensagem' })).toBeVisible();
      await paginaBruno.goto(`/chat/${match}`);
      if (!noCelular()) await expect(paginaBruno.getByRole('complementary', { name: 'Sinergia em comum' })).toBeVisible();
      await paginaBruno.getByLabel('Mensagem', { exact: true }).fill('Oi, Ana! Vi que temos interesses em comum.');
      await paginaBruno.getByRole('button', { name: 'Enviar', exact: true }).click();
      await expect(paginaBruno.getByRole('log')).toContainText('Oi, Ana! Vi que temos interesses em comum.');

      await paginaAna.goto(`/chat/${match}`);
      await expect(paginaAna.getByRole('log')).toContainText('Oi, Ana! Vi que temos interesses em comum.');

      // A resposta de Ana chega a Bruno pelo polling, sem recarregar a página.
      await paginaAna.getByLabel('Mensagem', { exact: true }).fill('Oi, Bruno! Que bom falar com você.');
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
      await pagina.goto('/matches');
      await expect(pagina.getByText('Carla Exemplo').first()).toBeVisible();
      await pagina.getByRole('button', { name: 'Aceitar' }).click();
      await expect(pagina.getByRole('heading', { name: /É um Match( Bilateral)?!/ })).toBeVisible();
      await pagina.getByRole('link', { name: /Continuar descobrindo/i }).click();
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
    await expect(page.getByLabel('Mensagem', { exact: true })).toHaveCount(0);

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

// No celular o perfil é um menu de seções; no desktop os controles ficam na própria página.
async function abrirSecao(page, nome) {
  await page.goto('/eu');
  if (noCelular()) await page.getByRole('button', { name: nome, exact: true }).click();
}

test.describe('perfil e privacidade', () => {
  test('pausar a exposição e ajustar a cota semanal ficam salvos', async ({ page, request, browser, baseURL, contextOptions }) => {
    const tags = interessesExclusivos();
    const iris = await criarPessoaPronta(request, { nome: 'Íris Exemplo', ...tags });
    const joao = await criarPessoaPronta(request, { nome: 'João Exemplo', ...tags });
    const antes = await (await chamar(request, joao.token, 'get', '/matches/recommendations')).json();
    expect(antes.recommendations.map((r) => r.employee_id)).toContain(iris.id);

    await autenticarPagina(page, iris.token);
    await abrirSecao(page, 'Privacidade');
    const visivel = page.getByRole('switch', { name: /Visível para novos matches/ });
    await expect(visivel).toBeChecked();
    // O campo do interruptor é visualmente escondido; a pessoa clica no rótulo.
    await visivel.locator('xpath=ancestor::label').click();
    await expect(visivel).not.toBeChecked();
    await expect(page.getByText(/Exposição pausada/).first()).toBeVisible();

    await abrirSecao(page, 'Preferências de Busca');
    await page.getByRole('button', { name: 'Aumentar' }).click();
    await expect(page.getByRole('group', { name: /Solicitações por semana/ }).locator('output')).toHaveText('4');

    await abrirSecao(page, 'Privacidade');
    await expect(page.getByRole('switch', { name: /Visível para novos matches/ })).not.toBeChecked();
    await abrirSecao(page, 'Preferências de Busca');
    await expect(page.getByRole('group', { name: /Solicitações por semana/ }).locator('output')).toHaveText('4');

    // Quem tem afinidade máxima com a pessoa pausada deixa de vê-la no deck.
    const { contexto, pagina } = await abrirComo(browser, contextOptions, baseURL, joao);
    try {
      await pagina.goto('/descobrir');
      // O deck mostra primeiro a maior afinidade: sem a pausa, este seria o cartão de Íris Exemplo.
      await expect(pagina.getByRole('article', { name: /^Sugestão: / }).first()).toBeVisible();
      await expect(cartaoDe(pagina, 'Íris Exemplo')).toHaveCount(0);
    } finally {
      await contexto.close();
    }
  });
});
