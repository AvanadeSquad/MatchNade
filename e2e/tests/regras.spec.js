import { expect, test } from '@playwright/test';
import { autenticarPagina, chamar, criarPessoaPronta, entrarPorApi, identificadorUnico, interessesExclusivos } from './helpers/api.js';

const cartaoDe = (pagina, nome) => pagina.getByRole('article', { name: `Sugestão: ${nome}` });

// Cria duas pessoas com afinidade máxima entre si; a segunda tem cargo.
async function parDePessoas(request, nomeA, nomeB, cargoB = 'Gerente de Projetos Sênior') {
  const tags = interessesExclusivos();
  const a = await criarPessoaPronta(request, { nome: nomeA, ...tags });
  const b = await criarPessoaPronta(request, { nome: nomeB, ...tags, cargo: cargoB });
  return { a, b };
}

test.describe('privacidade e hierarquia', () => {
  test('o cargo não aparece antes do match e aparece depois', async ({ page, request }) => {
    const cargo = 'Gerente de Projetos Sênior';
    const { a, b } = await parDePessoas(request, 'Lia Exemplo', 'Marcos Exemplo', cargo);
    await autenticarPagina(page, a.token);

    await page.goto('/descobrir');
    await expect(cartaoDe(page, 'Marcos Exemplo')).toBeVisible();
    await expect(page.locator('body')).not.toContainText(cargo);

    await page.getByRole('link', { name: 'Ver perfil completo' }).click();
    await expect(page.getByRole('heading', { name: 'Marcos Exemplo' })).toBeVisible();
    await expect(page.locator('body')).not.toContainText(cargo);

    await chamar(request, a.token, 'post', '/matches', { receiver_id: b.id });
    await chamar(request, b.token, 'post', '/matches', { receiver_id: a.id });
    await page.reload();
    await expect(page.locator('body')).toContainText(cargo);
  });
});

test.describe('segurança entre pessoas', () => {
  test('denunciar aceita o texto inteiro, envia e fecha o diálogo', async ({ page, request }) => {
    const { a, b } = await parDePessoas(request, 'Nina Exemplo', 'Otávio Exemplo');
    await autenticarPagina(page, a.token);
    await page.goto(`/pessoa/${b.id}`);

    await page.getByRole('button', { name: 'Mais opções' }).click();
    await page.getByRole('menuitem', { name: 'Denunciar' }).click();
    const campo = page.getByRole('dialog').getByRole('textbox');
    const motivo = 'Mensagens insistentes depois da recusa';
    await campo.pressSequentially(motivo);
    await expect(campo).toHaveValue(motivo);

    await page.getByRole('button', { name: 'Enviar denúncia' }).click();
    await expect(page.getByText('Denúncia enviada')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('o diálogo fecha com Esc, mantém o foco dentro e devolve o foco ao botão', async ({ page, request }) => {
    const { a, b } = await parDePessoas(request, 'Paula Exemplo', 'Quirino Exemplo');
    await autenticarPagina(page, a.token);
    await page.goto(`/pessoa/${b.id}`);

    await page.getByRole('button', { name: 'Mais opções' }).click();
    await page.getByRole('menuitem', { name: 'Bloquear' }).click();
    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();

    for (let i = 0; i < 4; i += 1) {
      await page.keyboard.press('Tab');
      expect(await dialogo.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(dialogo).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Mais opções' })).toBeFocused();
  });

  test('o menu "Mais opções" fecha com Esc e ao clicar fora', async ({ page, request }) => {
    const { a, b } = await parDePessoas(request, 'Rita Exemplo', 'Sandro Exemplo');
    await autenticarPagina(page, a.token);
    await page.goto(`/pessoa/${b.id}`);

    await page.getByRole('button', { name: 'Mais opções' }).click();
    await expect(page.getByRole('menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);

    await page.getByRole('button', { name: 'Mais opções' }).click();
    await page.locator('.cabecalho__titulo').click({ position: { x: 5, y: 5 } });
    await expect(page.getByRole('menu')).toHaveCount(0);
  });

  test('o menu "Mais opções" foca o primeiro item e navega com as setas', async ({ page, request }) => {
    const { a, b } = await parDePessoas(request, 'Vera Exemplo', 'Wagner Exemplo');
    await autenticarPagina(page, a.token);
    await page.goto(`/pessoa/${b.id}`);

    await page.getByRole('button', { name: 'Mais opções' }).click();
    await expect(page.getByRole('menuitem', { name: 'Bloquear' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', { name: 'Denunciar' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', { name: 'Bloquear' })).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(page.getByRole('menuitem', { name: 'Denunciar' })).toBeFocused();
  });

  test('as abas de Conexões aceitam Home e End', async ({ page, request }) => {
    const { a } = await parDePessoas(request, 'Xênia Exemplo', 'Yuri Exemplo');
    await autenticarPagina(page, a.token);
    await page.goto('/conexoes');

    await page.getByRole('tab', { name: /Recebidas/ }).focus();
    await page.keyboard.press('End');
    await expect(page.getByRole('tab', { name: /Aguardando/ })).toBeFocused();
    await expect(page.getByRole('tab', { name: /Aguardando/ })).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Home');
    await expect(page.getByRole('tab', { name: /Recebidas/ })).toBeFocused();
    await expect(page.getByRole('tab', { name: /Recebidas/ })).toHaveAttribute('aria-selected', 'true');
  });

  test('desbloquear devolve a pessoa à lista e ao perfil', async ({ page, request }) => {
    const { a, b } = await parDePessoas(request, 'Tânia Exemplo', 'Ubirajara Exemplo');
    await chamar(request, a.token, 'post', `/employees/${b.id}/block`);
    await autenticarPagina(page, a.token);
    await page.goto('/eu');

    await page.getByRole('button', { name: 'Pessoas bloqueadas' }).click();
    await expect(page.getByRole('dialog')).toContainText('Ubirajara Exemplo');
    await page.getByRole('button', { name: 'Desbloquear' }).click();
    await expect(page.getByRole('dialog')).toContainText('Você não bloqueou ninguém');
    expect((await chamar(request, a.token, 'get', `/employees/${b.id}`)).status()).toBe(200);
  });

  test('recusar uma solicitação a tira das recebidas', async ({ page, request }) => {
    const { a, b } = await parDePessoas(request, 'Vera Exemplo', 'Wagner Exemplo');
    await chamar(request, a.token, 'post', '/matches', { receiver_id: b.id });
    await autenticarPagina(page, b.token);

    await page.goto('/conexoes');
    await expect(page.getByText('Vera Exemplo')).toBeVisible();
    await page.getByRole('button', { name: 'Recusar' }).click();
    await expect(page.getByText('Solicitação recusada.')).toBeVisible();
    await expect(page.getByRole('tab', { name: /Recebidas \(0\)/ })).toBeVisible();
  });
});

test.describe('conta e sessão', () => {
  test('excluir os dados encerra a sessão e invalida o token', async ({ page, request }) => {
    const { a } = await parDePessoas(request, 'Xavier Exemplo', 'Yara Exemplo');
    await autenticarPagina(page, a.token);
    await page.goto('/eu');

    await page.getByRole('button', { name: 'Excluir meus dados' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Excluir tudo' }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect((await chamar(request, a.token, 'get', '/profile')).status()).toBe(401);
  });

  test('token inválido volta ao login', async ({ page }) => {
    await autenticarPagina(page, 'token-invalido');
    await page.goto('/descobrir');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('uma sessão que expira durante o uso leva ao login', async ({ page, request }) => {
    const { a } = await parDePessoas(request, 'Zélia Exemplo', 'Átila Exemplo');
    await autenticarPagina(page, a.token);
    await page.goto('/descobrir');
    await expect(page.getByRole('heading', { name: 'Descobrir' })).toBeVisible();

    await page.route('**/api/v1/matches/recommendations*', (rota) =>
      rota.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ code: 'NAO_AUTENTICADO', message: 'Sessão expirada.' }) }),
    );
    await page.reload();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('quem entrou com a conta errada consegue sair do cadastro', async ({ page, request }) => {
    const email = `${identificadorUnico('sair')}@exemplo.test`;
    await autenticarPagina(page, await entrarPorApi(request, email));
    await page.goto('/bem-vindo');
    await page.getByRole('button', { name: /sair/i }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('sem login configurado a tela de entrada avisa', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('O login ainda não está configurado neste ambiente.')).toBeVisible();
  });
});

test.describe('cota semanal', () => {
  test('com a cota usada a descoberta explica o motivo em vez de mostrar pessoas', async ({ page, request }) => {
    const tags = interessesExclusivos();
    const a = await criarPessoaPronta(request, { nome: 'Bela Exemplo', ...tags });
    const b = await criarPessoaPronta(request, { nome: 'Caio Exemplo', ...tags });
    await criarPessoaPronta(request, { nome: 'Dora Exemplo', ...tags });
    await chamar(request, a.token, 'put', '/profile', { max_weekly_matches: 1 });
    await chamar(request, a.token, 'post', '/matches', { receiver_id: b.id });

    await autenticarPagina(page, a.token);
    await page.goto('/descobrir');
    await expect(page.getByText('Solicitações desta semana: 1 de 1')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Você usou a cota da semana' })).toBeVisible();
    await expect(page.getByText(/Você já usou suas 1 solicitações/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Demonstrar interesse' })).toHaveCount(0);
  });
});

test.describe('layout por tamanho de tela', () => {
  test('menu lateral no desktop e barra inferior no celular', async ({ page, request }) => {
    const { a } = await parDePessoas(request, 'Eli Exemplo', 'Fabi Exemplo');
    await autenticarPagina(page, a.token);
    await page.goto('/descobrir');

    const largura = page.viewportSize().width;
    const lateral = page.locator('aside.lateral');
    const inferior = page.locator('nav.nav-inferior');
    if (largura >= 900) {
      await expect(lateral).toBeVisible();
      await expect(inferior).toBeHidden();
      await expect(lateral.getByRole('link', { name: 'Conexões' })).toBeVisible();
      // O conteúdo ocupa a área ao lado do menu, e não uma coluna estreita no meio da tela.
      const caixa = await page.locator('.deck').boundingBox();
      expect(caixa.x).toBeGreaterThan(240);
      expect(caixa.width).toBeGreaterThan(700);
    } else {
      await expect(lateral).toBeHidden();
      await expect(inferior).toBeVisible();
      await expect(inferior.getByRole('link', { name: 'Perfil' })).toBeVisible();
    }
  });

  test('o chat mostra lista e conversa lado a lado no desktop e uma tela por vez no celular', async ({ page, request }) => {
    const { a, b } = await parDePessoas(request, 'Gil Exemplo', 'Hana Exemplo');
    await chamar(request, a.token, 'post', '/matches', { receiver_id: b.id });
    const match = await (await chamar(request, b.token, 'post', '/matches', { receiver_id: a.id })).json();
    await autenticarPagina(page, a.token);

    const desktop = page.viewportSize().width >= 900;
    await page.goto('/chat');
    await expect(page.getByRole('link', { name: /Hana Exemplo/ })).toBeVisible();
    await expect(page.getByText('Escolha uma conversa na lista para começar.')).toBeVisible({ visible: desktop });

    await page.goto(`/chat/${match.match_id}`);
    await expect(page.getByLabel('Mensagem')).toBeVisible();
    await expect(page.getByRole('link', { name: /Hana Exemplo/ })).toBeVisible({ visible: desktop });
  });

  test('as telas não geram rolagem horizontal', async ({ page, request }) => {
    const { a, b } = await parDePessoas(request, 'Ivo Exemplo', 'Jade Exemplo');
    await chamar(request, a.token, 'post', '/matches', { receiver_id: b.id });
    const match = await (await chamar(request, b.token, 'post', '/matches', { receiver_id: a.id })).json();
    await autenticarPagina(page, a.token);

    const rotas = [
      '/descobrir', '/conexoes', '/chat', `/chat/${match.match_id}`, `/pessoa/${b.id}`, `/match/${match.match_id}`,
      '/eu', '/perfil/interesses?de=eu', '/perfil/objetivos?de=eu', '/perfil/bio', '/bem-vindo',
    ];
    for (const rota of rotas) {
      await page.goto(rota);
      await expect(page.locator('main')).toBeVisible();
      const transborda = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(transborda, `rolagem horizontal em ${rota}`).toBe(false);
    }
  });
});
