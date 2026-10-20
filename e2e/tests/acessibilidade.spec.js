import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { autenticarPagina, chamar, criarPessoaPronta, entrarPorApi, identificadorUnico, interessesExclusivos } from './helpers/api.js';

// Regras WCAG 2.1 níveis A e AA. O teste falha só em violações sérias ou críticas. As moderadas e
// menores, e os resultados que o axe não conseguiu decidir sozinho (incomplete), não bloqueiam, mas
// vão anexados ao relatório do Playwright para revisão manual.
const IMPACTOS_BLOQUEANTES = ['serious', 'critical'];

const noCelular = () => test.info().project.name === 'celular';

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

const titulo = (page, nome) => expect(page.getByRole('heading', { name: nome }).first()).toBeVisible();

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

// No celular o perfil é um menu de seções; no desktop os controles ficam na própria página.
async function abrirSecao(page, nome) {
  await page.goto('/eu');
  if (noCelular()) await page.getByRole('button', { name: nome, exact: true }).click();
}

// Do começo do cadastro de interesses até o ponto em que o texto para a análise da IA pode ser enviado.
async function iniciarAnalise(page, texto) {
  await page.goto('/cadastro/interesses');
  if (noCelular()) {
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByLabel('Resumo para importar').fill(texto);
    await page.getByRole('button', { name: 'Importar interesses' }).click();
  } else {
    await page.getByLabel('Resumo para análise').fill(texto);
    await page.getByRole('button', { name: 'Analisar com IA' }).click();
  }
}

test.describe('acessibilidade (axe)', () => {
  test('login', async ({ page }) => {
    await page.goto('/login');
    await titulo(page, /Acesse sua conta|Bem-vindo ao Global Connect/);
    await verificar(page, 'login');
  });

  test('cadastro: dados, interesses e preferências', async ({ page, request }) => {
    const token = await entrarPorApi(request, `${identificadorUnico('cad')}@exemplo.test`);
    await autenticarPagina(page, token);
    for (const caminho of ['/cadastro/dados', '/cadastro/interesses', '/cadastro/preferencias']) {
      await page.goto(caminho);
      await expect(page.getByRole('heading').first()).toBeVisible();
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

  test('matches, match, lista de conversas e chat', async ({ page, request }) => {
    const { a, matchId } = await parComMatch(request);
    // Uma solicitação recebida e uma enviada, para as seções de recebidas e aguardando terem conteúdo.
    const tags = interessesExclusivos();
    const quemPede = await criarPessoaPronta(request, { nome: 'Caio Acessível', ...tags });
    const quemRecebe = await criarPessoaPronta(request, { nome: 'Dora Acessível', ...tags });
    await chamar(request, quemPede.token, 'post', '/matches', { receiver_id: a.id });
    await chamar(request, a.token, 'post', '/matches', { receiver_id: quemRecebe.id });
    await autenticarPagina(page, a.token);

    await page.goto('/matches');
    await titulo(page, /Matches Bilaterais|Conexões Bilaterais/);
    await expect(page.getByText('Caio Acessível').first()).toBeVisible();
    await expect(page.getByText('Bento Acessível').first()).toBeVisible();
    await verificar(page, 'matches: recebidas, ativos e aguardando');

    await page.goto(`/match/${matchId}`);
    await titulo(page, /É um Match( Bilateral)?!/);
    await verificar(page, 'match');

    await page.goto('/chat');
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await expect(page.getByText('Bento Acessível').first()).toBeVisible();
    await verificar(page, 'lista de conversas sem conversa aberta');

    await page.goto(`/chat/${matchId}`);
    await expect(page.getByLabel('Mensagem', { exact: true })).toBeVisible();
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

  test('cadastro: análise do texto e caminho manual, com a IA desligada', async ({ page, request }) => {
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
    await iniciarAnalise(page, 'Curto React e Node, jogo xadrez nos fins de semana.');
    await expect(page.getByText(/identificando (seu perfil|skills)|Lendo seu perfil/i).first()).toBeVisible();
    await verificar(page, 'análise em andamento');

    liberar();
    await expect(page.getByText('Não conseguimos analisar agora')).toBeVisible();
    await verificar(page, 'análise sem IA');
  });

  test('cadastro: interesses sugeridos pela análise', async ({ page, request }) => {
    const token = await entrarPorApi(request, `${identificadorUnico('rev')}@exemplo.test`);
    await autenticarPagina(page, token);
    // Os testes rodam com a IA desligada e as tags sugeridas só aparecem com a análise. A resposta
    // é simulada no navegador, no formato da API, só para chegar à tela.
    await page.route('**/profile/enrich-bio', (rota) =>
      rota.fulfill({ json: { technical_tags: ['React', 'Node.js'], hobby_tags: ['Dança'] } }),
    );
    await iniciarAnalise(page, 'Curto React e Node, danço nos fins de semana.');
    await expect(page.getByRole('button', { name: 'React', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await verificar(page, 'interesses sugeridos');
  });

  test('perfil próprio e seus diálogos', async ({ page, request }) => {
    const pessoa = await criarPessoaPronta(request, { nome: 'Eva Acessível', ...interessesExclusivos() });
    await autenticarPagina(page, pessoa.token);
    await page.goto('/eu');
    await expect(page.getByRole('heading', { name: 'Eva Acessível' })).toBeVisible();
    await verificar(page, 'perfil próprio');

    const dialogos = [
      { botao: 'Pessoas bloqueadas', secao: 'Privacidade' },
      { botao: 'Definir senha', secao: 'Privacidade' },
      { botao: 'Ler diretrizes', secao: 'Privacidade' },
      { botao: 'Excluir meus dados', secao: 'Conta' },
    ];
    for (const { botao, secao } of dialogos) {
      await abrirSecao(page, secao);
      await page.getByRole('button', { name: botao }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await verificar(page, `diálogo ${botao}`);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
  });
});
