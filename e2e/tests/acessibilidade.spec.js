import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { autenticarPagina, chamar, criarPessoaPronta, entrarPorApi, identificadorUnico, interessesExclusivos } from './helpers/api.js';

// Regras WCAG 2.1 níveis A e AA. O teste falha só em violações sérias ou críticas;
// as moderadas e menores aparecem no relatório do axe, mas não bloqueiam.
const IMPACTOS_BLOQUEANTES = ['serious', 'critical'];

async function verificar(page, tela) {
  const resultado = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
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

  test('conexões, match e chat', async ({ page, request }) => {
    const { a, matchId } = await parComMatch(request);
    await autenticarPagina(page, a.token);

    await page.goto('/conexoes');
    await titulo(page, 'Conexões');
    await verificar(page, 'conexões');

    await page.goto(`/match/${matchId}`);
    await titulo(page, 'É um match!');
    await verificar(page, 'match');

    await page.goto(`/chat/${matchId}`);
    await expect(page.getByRole('textbox')).toBeVisible();
    await verificar(page, 'chat');
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
