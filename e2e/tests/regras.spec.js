import { expect, test } from '@playwright/test';
import {
  API_URL,
  autenticarPagina,
  chamar,
  criarPessoaPronta,
  entrarPorApi,
  identificadorUnico,
  interessesExclusivos,
} from './helpers/api.js';

// No celular o perfil é um menu de seções; no desktop os controles ficam na própria página.
async function abrirSecao(page, nome) {
  await page.goto('/eu');
  if (page.viewportSize().width < 900) await page.getByRole('button', { name: nome, exact: true }).click();
}

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
    await page.getByRole('heading', { level: 1 }).click({ position: { x: 2, y: 2 } });
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

  test('desbloquear devolve a pessoa à lista e ao perfil', async ({ page, request }) => {
    const { a, b } = await parDePessoas(request, 'Tânia Exemplo', 'Ubirajara Exemplo');
    await chamar(request, a.token, 'post', `/employees/${b.id}/block`);
    await autenticarPagina(page, a.token);
    await abrirSecao(page, 'Privacidade');
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

    await page.goto('/matches');
    await expect(page.getByText('Vera Exemplo').first()).toBeVisible();
    await page.getByRole('button', { name: 'Recusar' }).click();
    await expect(page.getByText('Solicitação recusada.')).toBeVisible();
    await expect(page.getByText('Vera Exemplo')).toHaveCount(0);
  });
});

test.describe('conta e sessão', () => {
  test('excluir os dados encerra a sessão e invalida o token', async ({ page, request }) => {
    const { a } = await parDePessoas(request, 'Xavier Exemplo', 'Yara Exemplo');
    await autenticarPagina(page, a.token);
    await abrirSecao(page, 'Conta');
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
    await expect(page).toHaveURL(/\/descobrir$/);
    await expect(page.getByRole('main')).toBeVisible();

    await page.route('**/api/v1/matches/recommendations*', (rota) =>
      rota.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ code: 'NAO_AUTENTICADO', message: 'Sessão expirada.' }) }),
    );
    await page.reload();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('quem entrou com a conta errada consegue sair do cadastro', async ({ page, request }) => {
    const email = `${identificadorUnico('sair')}@exemplo.test`;
    await autenticarPagina(page, await entrarPorApi(request, email));
    await page.goto('/cadastro/dados');
    await page.getByRole('button', { name: /Cancelar|conta errada/ }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('senha incorreta mostra o erro e não entra', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail corporativo').fill('ana.silva@exemplo.test');
    await page.getByLabel('Senha', { exact: true }).fill('senha-incorreta-123');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('E-mail ou senha incorretos.');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('conta com senha entra e chega à descoberta', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail corporativo').fill('ana.silva@exemplo.test');
    await page.getByLabel('Senha', { exact: true }).fill('1234567890');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page).toHaveURL(/\/descobrir$/);
  });

  test('criar conta leva ao cadastro de dados', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
    await page.getByLabel('Nome completo').fill('Pessoa Nova de Teste');
    await page.getByLabel('E-mail corporativo').fill(`${identificadorUnico('conta')}@exemplo.test`);
    await page.getByLabel('Senha', { exact: true }).fill('senha-de-teste-123');
    await page.getByLabel('Confirmar senha').fill('senha-de-teste-123');
    await page.getByLabel('Pergunta de segurança').selectOption({ label: 'Qual era o nome do seu primeiro animal de estimação?' });
    await page.getByLabel('Resposta de segurança').fill('Rex');
    await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
    await expect(page).toHaveURL(/\/cadastro\/dados$/);
  });

  test('criar conta recusa senhas diferentes', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
    await page.getByLabel('Nome completo').fill('Pessoa Nova de Teste');
    await page.getByLabel('E-mail corporativo').fill(`${identificadorUnico('conta')}@exemplo.test`);
    await page.getByLabel('Senha', { exact: true }).fill('senha-de-teste-123');
    await page.getByLabel('Confirmar senha').fill('senha-diferente-123');
    await page.getByLabel('Pergunta de segurança').selectOption({ label: 'Qual era o nome do seu primeiro animal de estimação?' });
    await page.getByLabel('Resposta de segurança').fill('Rex');
    await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('As senhas não coincidem.');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('recuperar a senha pela pergunta de segurança e entrar com a nova', async ({ page, request }) => {
    const email = `${identificadorUnico('recuperar')}@exemplo.test`;
    const cadastro = await request.post(`${API_URL}/auth/register`, {
      data: {
        name: 'Pessoa Recupera',
        email,
        password: 'senha-antiga-123',
        security_question_id: 'cidade_nascimento',
        security_answer: 'Recife',
      },
    });
    expect(cadastro.status()).toBe(201);

    await page.goto('/login');
    await page.getByRole('button', { name: 'Esqueci minha senha' }).click();
    await page.getByLabel('E-mail corporativo').fill(email);
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByText('Em qual cidade você nasceu?')).toBeVisible();
    await page.getByLabel('Resposta de segurança').fill('recife');
    await page.getByLabel('Nova senha').fill('senha-nova-456');
    await page.getByLabel('Confirmar senha').fill('senha-nova-456');
    await page.getByRole('button', { name: 'Redefinir senha', exact: true }).click();
    await expect(page.getByText('Senha redefinida. Entre com sua nova senha.')).toBeVisible();

    await page.getByLabel('E-mail corporativo').fill(email);
    await page.getByLabel('Senha', { exact: true }).fill('senha-nova-456');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page).toHaveURL(/\/cadastro\/dados$/);
  });

  test('e-mail sem cadastro vê uma pergunta e a redefinição falha com a mensagem genérica', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Esqueci minha senha' }).click();
    await page.getByLabel('E-mail corporativo').fill('ninguem@exemplo.test');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByLabel('Resposta de segurança')).toBeVisible();
    await page.getByLabel('Resposta de segurança').fill('qualquer');
    await page.getByLabel('Nova senha').fill('senha-nova-456');
    await page.getByLabel('Confirmar senha').fill('senha-nova-456');
    await page.getByRole('button', { name: 'Redefinir senha', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Não foi possível validar a recuperação.');
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
    if (page.viewportSize().width >= 900) await expect(page.getByText('Solicitações desta semana: 1 de 1')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Você usou a cota da semana' })).toBeVisible();
    await expect(page.getByText(/Você já usou suas 1 solicitações/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Demonstrar interesse' })).toHaveCount(0);
  });
});

test.describe('layout por tamanho de tela', () => {
  test('menu superior no desktop e barra inferior no celular', async ({ page, request }) => {
    const { a } = await parDePessoas(request, 'Eli Exemplo', 'Fabi Exemplo');
    await autenticarPagina(page, a.token);
    await page.goto('/descobrir');

    const largura = page.viewportSize().width;
    const superior = page.getByRole('navigation', { name: 'Navegação principal', exact: true });
    const inferior = page.getByRole('navigation', { name: 'Navegação principal (celular)' });
    if (largura >= 900) {
      await expect(superior).toBeVisible();
      await expect(inferior).toBeHidden();
      await expect(superior.getByRole('link', { name: 'Matches Bilaterais' })).toBeVisible();
      // O conteúdo ocupa a largura útil da tela, e não uma coluna estreita no meio.
      const caixa = await page.locator('main').boundingBox();
      expect(caixa.width).toBeGreaterThan(700);
    } else {
      await expect(superior).toBeHidden();
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
    await expect(page.getByRole('link', { name: /^Hana Exemplo/ })).toBeVisible();
    await expect(page.getByText('Escolha uma conversa na lista para começar.')).toBeVisible({ visible: desktop });

    await page.goto(`/chat/${match.match_id}`);
    await expect(page.getByLabel('Mensagem', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Hana Exemplo/ })).toBeVisible({ visible: desktop });
  });

  test('as telas não geram rolagem horizontal', async ({ page, request }) => {
    const { a, b } = await parDePessoas(request, 'Ivo Exemplo', 'Jade Exemplo');
    await chamar(request, a.token, 'post', '/matches', { receiver_id: b.id });
    const match = await (await chamar(request, b.token, 'post', '/matches', { receiver_id: a.id })).json();
    await autenticarPagina(page, a.token);

    const rotas = [
      '/descobrir', '/matches', '/chat', `/chat/${match.match_id}`, `/pessoa/${b.id}`, `/match/${match.match_id}`,
      '/eu', '/cadastro/dados', '/cadastro/interesses', '/cadastro/preferencias',
    ];
    for (const rota of rotas) {
      await page.goto(rota);
      await expect(page.locator('main')).toBeVisible();
      const transborda = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(transborda, `rolagem horizontal em ${rota}`).toBe(false);
    }
  });
});
