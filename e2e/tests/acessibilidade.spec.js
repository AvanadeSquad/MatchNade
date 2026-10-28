import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { autenticarPagina, chamar, criarPessoaPronta, entrarPorApi, identificadorUnico, interessesExclusivos } from './helpers/api.js';

// Regras WCAG 2.1 níveis A e AA. O teste falha só em violações sérias ou críticas. As moderadas e
// menores, e os resultados que o axe não conseguiu decidir sozinho (incomplete), não bloqueiam, mas
// vão anexados ao relatório do Playwright para revisão manual.
const IMPACTOS_BLOQUEANTES = ['serious', 'critical'];

const resumir = (itens) =>
  itens.map((v) => ({ regra: v.id, impacto: v.impact, ajuda: v.help, alvos: v.nodes.map((n) => n.target.join(' ')) }));

async function verificar(page, tela) {
  const resultado = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const naoBloqueantes = resultado.violations.filter((v) => !IMPACTOS_BLOQUEANTES.includes(v.impact));
  if (naoBloqueantes.length || resultado.incomplete.length) {
    await test.info().attach(`axe: ${tela}`, {
      body: JSON.stringify({ violacoes: resumir(naoBloqueantes), incompletos: resumir(resultado.incomplete) }, null, 2),
      contentType: 'application/json',
    });
  }
  const graves = resultado.violations
    .filter((v) => IMPACTOS_BLOQUEANTES.includes(v.impact))
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
  expect(graves, `violações em ${tela}`).toEqual([]);
}

const titulo = (page, nome) => expect(page.getByRole('heading', { level: 1, name: nome })).toBeVisible();

// Par com match confirmado, para as telas de perfil, conexões e chat terem conteúdo.
async function parComMatch(request) {
  const tags = interessesExclusivos();
  const a = await criarPessoaPronta(request, { nome: 'Alice Acessível', ...tags });
  const b = await criarPessoaPronta(request, { nome: 'Bento Acessível', cargo: 'Pessoa de Teste', ...tags });
  await chamar(request, a.token, 'post', '/matches', { receiver_id: b.id });
  const resposta = await chamar(request, b.token, 'post', '/matches', { receiver_id: a.id });
  const { match_id: matchId } = await resposta.json();
  return { a, b, matchId };
}

test.describe('acessibilidade (axe)', () => {
  test('login', async ({ page }) => {
    await page.goto('/login');
    await titulo(page, /Avanade Connect/);
    await verificar(page, 'login');
  });

  test('cadastro: boas-vindas, bio, interesses e objetivos', async ({ page, request }) => {
    const token = await entrarPorApi(request, `${identificadorUnico('cad')}@exemplo.test`);
    await autenticarPagina(page, token);
    for (const caminho of ['/bem-vindo', '/perfil/bio', '/perfil/interesses', '/perfil/objetivos']) {
      await page.goto(caminho);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      await verificar(page, caminho);
    }
  });

  test('descoberta', async ({ page, request }) => {
    const tags = interessesExclusivos();
    const pessoa = await criarPessoaPronta(request, { nome: 'Carla Acessível', ...tags });
    await criarPessoaPronta(request, { nome: 'Davi Acessível', ...tags });
    await autenticarPagina(page, pessoa.token);
    await page.goto('/descobrir');
    await expect(page.getByRole('article').first()).toBeVisible();
    await verificar(page, 'descoberta');
  });

  test('perfil de outra pessoa, com os diálogos de bloquear e denunciar abertos', async ({ page, request }) => {
    const { a, b } = await parComMatch(request);
    await autenticarPagina(page, a.token);
    await page.goto(`/pessoa/${b.id}`);
    await expect(page.getByRole('heading', { name: 'Bento Acessível' })).toBeVisible();
    await verificar(page, 'perfil de outra pessoa');

    await page.getByRole('button', { name: 'Mais opções' }).click();
    await verificar(page, 'menu Mais opções aberto');
    await page.getByRole('menuitem', { name: 'Bloquear' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await verificar(page, 'diálogo de bloquear');
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Mais opções' }).click();
    await page.getByRole('menuitem', { name: 'Denunciar' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await verificar(page, 'diálogo de denunciar');
  });

  test('conexões nas três abas, match, lista de conversas e chat', async ({ page, request }) => {
    const { a, matchId } = await parComMatch(request);
    // Uma solicitação recebida e uma enviada, para as abas Recebidas e Aguardando terem conteúdo.
    const tags = interessesExclusivos();
    const quemPede = await criarPessoaPronta(request, { nome: 'Caio Acessível', ...tags });
    const quemRecebe = await criarPessoaPronta(request, { nome: 'Dora Acessível', ...tags });
    await chamar(request, quemPede.token, 'post', '/matches', { receiver_id: a.id });
    await chamar(request, a.token, 'post', '/matches', { receiver_id: quemRecebe.id });
    await autenticarPagina(page, a.token);

    await page.goto('/conexoes');
    await titulo(page, 'Conexões');
    await expect(page.getByRole('link', { name: /Caio Acessível/ })).toBeVisible();
    await verificar(page, 'conexões: recebidas');
    await page.getByRole('tab', { name: /Confirmadas/ }).click();
    await expect(page.getByRole('link', { name: /Bento Acessível/ })).toBeVisible();
    await verificar(page, 'conexões: confirmadas');
    await page.getByRole('tab', { name: /Aguardando/ }).click();
    await expect(page.getByRole('link', { name: /Dora Acessível/ })).toBeVisible();
    await verificar(page, 'conexões: aguardando');

    await page.goto(`/match/${matchId}`);
    await titulo(page, 'É um match!');
    await verificar(page, 'match');

    await page.goto('/chat');
    await titulo(page, 'Conversas');
    await expect(page.getByRole('link', { name: /Bento Acessível/ })).toBeVisible();
    await verificar(page, 'lista de conversas sem conversa aberta');

    await page.goto(`/chat/${matchId}`);
    await expect(page.getByRole('textbox')).toBeVisible();
    await verificar(page, 'chat');
  });

  test('descoberta com a cota da semana esgotada', async ({ page, request }) => {
    const tags = interessesExclusivos();
    const pessoa = await criarPessoaPronta(request, { nome: 'Gil Acessível', ...tags });
    const outra = await criarPessoaPronta(request, { nome: 'Hana Acessível', ...tags });
    await chamar(request, pessoa.token, 'put', '/profile', { max_weekly_matches: 1 });
    await chamar(request, pessoa.token, 'post', '/matches', { receiver_id: outra.id });
    await autenticarPagina(page, pessoa.token);
    await page.goto('/descobrir');
    await expect(page.getByRole('heading', { name: 'Você usou a cota da semana' })).toBeVisible();
    await verificar(page, 'descoberta com a cota esgotada');
  });

  test('cadastro: análise da bio e caminho manual, com a IA desligada', async ({ page, request }) => {
    const token = await entrarPorApi(request, `${identificadorUnico('ana')}@exemplo.test`);
    await autenticarPagina(page, token);
    // Segura a resposta da análise para a tela de andamento ficar parada durante a verificação;
    // depois a requisição segue para a API, que responde sem IA.
    let liberar;
    const segurada = new Promise((resolver) => {
      liberar = resolver;
    });
    await page.route('**/profile/enrich-bio', async (rota) => {
      await segurada;
      await rota.continue();
    });
    await page.goto('/perfil/bio');
    await page.getByRole('textbox').fill('Curto React e Node, jogo xadrez nos fins de semana.');
    await page.getByRole('button', { name: 'Analisar minha bio' }).click();
    await expect(page).toHaveURL(/\/perfil\/analisando$/);
    await titulo(page, 'Identificando seu perfil');
    await verificar(page, '/perfil/analisando em andamento');

    liberar();
    await titulo(page, 'Não conseguimos analisar agora');
    await verificar(page, '/perfil/analisando sem IA');
  });

  test('cadastro: revisão das tags sugeridas', async ({ page, request }) => {
    const token = await entrarPorApi(request, `${identificadorUnico('rev')}@exemplo.test`);
    await autenticarPagina(page, token);
    // Os testes rodam com a IA desligada, e a revisão só abre com tags sugeridas. A resposta da
    // análise é simulada no navegador, no formato da API, só para chegar à tela.
    await page.route('**/profile/enrich-bio', (rota) =>
      rota.fulfill({ json: { technical_tags: ['React', 'Node.js'], hobby_tags: ['Xadrez'] } }),
    );
    await page.goto('/perfil/bio');
    await page.getByRole('textbox').fill('Curto React e Node, jogo xadrez nos fins de semana.');
    await page.getByRole('button', { name: 'Analisar minha bio' }).click();
    await expect(page).toHaveURL(/\/perfil\/revisao$/);
    await expect(page.getByRole('button', { name: 'Remover React' })).toBeVisible();
    await verificar(page, '/perfil/revisao');
  });

  test('perfil próprio e seus diálogos', async ({ page, request }) => {
    const pessoa = await criarPessoaPronta(request, { nome: 'Eva Acessível', ...interessesExclusivos() });
    await autenticarPagina(page, pessoa.token);
    await page.goto('/eu');
    await expect(page.getByRole('heading', { name: 'Eva Acessível' })).toBeVisible();
    await verificar(page, 'perfil próprio');

    for (const botao of ['Pessoas bloqueadas', 'Sobre o Avanade Connect', 'Excluir meus dados']) {
      await page.getByRole('button', { name: botao }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await verificar(page, `diálogo ${botao}`);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
  });
});
