import { basename } from 'node:path';
import { expect, test } from '@playwright/test';
import { autenticarPagina, chamar, criarPessoaPronta } from './helpers/api.js';

// Regressão visual das telas principais. As linhas de base ficam em tests/visual.spec.js-snapshots
// e valem para Linux com o Chromium do Playwright, que é o ambiente do CI. Para atualizar:
//   npm run test:visual:atualizar
test.skip(process.platform !== 'linux', 'As linhas de base são geradas e comparadas no Linux, como no CI.');

// Sem repetição: a segunda tentativa encontraria no banco as pessoas da primeira, com os mesmos
// nomes e interesses, e a tela mudaria. Uma diferença visual também não some ao repetir.
test.describe.configure({ retries: 0 });

// Quando uma captura não bate com a referência (ou a referência não existe), anexa a imagem real
// com o nome exato do arquivo de referência. Assim o relatório HTML que o CI publica traz, ao lado
// das imagens esperada, real e de diferença, o arquivo pronto para copiar para a pasta de referências.
test.afterEach(async ({}, info) => {
  if (info.status === info.expectedStatus) return;
  for (const anexo of info.attachments) {
    if (!anexo.path || !anexo.name.endsWith('-actual.png')) continue;
    const referencia = basename(info.snapshotPath(anexo.name.replace(/-actual\.png$/, '.png'), { kind: 'screenshot' }));
    await info.attach(`nova-referencia/${referencia}`, { path: anexo.path, contentType: 'image/png' });
  }
});

// Fonte fixa instalada pelo "playwright install --with-deps" no Ubuntu: evita que a Inter,
// presente em algumas máquinas e ausente em outras, mude a captura.
const FONTE_FIXA = `*, *::before, *::after { font-family: 'Liberation Sans', Arial, sans-serif !important; }`;

async function capturar(page, nome) {
  await page.addStyleTag({ content: FONTE_FIXA });
  await page.evaluate(() => document.fonts.ready);
  // Tolera até 100 pixels diferentes, para a suavização de bordas que muda entre versões do
  // Chromium. Trocar só a cor do nome no cartão da descoberta já muda cerca de 850 pixels.
  await expect(page).toHaveScreenshot(`${nome}.png`, { fullPage: true, animations: 'disabled', maxDiffPixels: 100 });
}

// Nomes e interesses fixos por teste e por projeto: o banco nasce vazio a cada execução,
// então o conteúdo das telas é sempre o mesmo e não colide entre desktop e celular.
async function parVisual(request, rotulo, projeto) {
  const tags = { tecnicas: [`Tema ${rotulo} ${projeto}`, `Ferramenta ${rotulo}`], hobbies: [`Hobby ${rotulo}`] };
  const a = await criarPessoaPronta(request, { nome: 'Vera Visual', ...tags });
  const b = await criarPessoaPronta(request, { nome: 'Wagner Visual', cargo: 'Pessoa de Teste', ...tags });
  return { a, b };
}

test.describe('regressão visual', () => {
  test('login', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await capturar(page, 'login');
  });

  test('descoberta e perfil de outra pessoa antes do match', async ({ page, request }, info) => {
    const { a, b } = await parVisual(request, 'descoberta', info.project.name);
    await autenticarPagina(page, a.token);
    await page.goto('/descobrir');
    await expect(page.getByRole('article', { name: 'Sugestão: Wagner Visual' })).toBeVisible();
    await capturar(page, 'descoberta');

    await page.goto(`/pessoa/${b.id}`);
    await expect(page.getByRole('heading', { name: 'Wagner Visual' })).toBeVisible();
    await capturar(page, 'perfil-de-outra-pessoa');
  });

  test('conexões, match e chat depois do match', async ({ page, request }, info) => {
    const { a, b } = await parVisual(request, 'conexao', info.project.name);
    await chamar(request, a.token, 'post', '/matches', { receiver_id: b.id });
    const resposta = await chamar(request, b.token, 'post', '/matches', { receiver_id: a.id });
    const { match_id: matchId } = await resposta.json();
    await autenticarPagina(page, a.token);

    await page.goto(`/match/${matchId}`);
    await expect(page.getByRole('heading', { name: 'É um match!' })).toBeVisible();
    await capturar(page, 'match');

    // Marca as conexões como vistas antes de abrir a tela. Em desenvolvimento o React busca a lista
    // duas vezes e a primeira busca já marca como visto; sem isso, o selo "Novo" dependeria de qual
    // das duas respostas chega por último.
    await chamar(request, a.token, 'get', '/matches');
    await page.goto('/conexoes');
    await page.getByRole('tab', { name: /Confirmadas/ }).click();
    await expect(page.getByRole('link', { name: /Wagner Visual/ })).toBeVisible();
    await capturar(page, 'conexoes');

    await page.goto(`/chat/${matchId}`);
    await expect(page.getByRole('textbox')).toBeVisible();
    await capturar(page, 'chat');
  });

  test('perfil próprio', async ({ page, request }, info) => {
    const { a } = await parVisual(request, 'perfil', info.project.name);
    await autenticarPagina(page, a.token);
    await page.goto('/eu');
    await expect(page.getByRole('heading', { name: 'Vera Visual' })).toBeVisible();
    await capturar(page, 'perfil-proprio');
  });
});
