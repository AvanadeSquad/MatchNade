import { expect, test } from '@playwright/test';
import { autenticarPagina, criarPessoaPronta, interessesExclusivos } from './helpers/api.js';

const celular = (page) => page.viewportSize().width < 900;

// No celular os filtros ficam num diálogo aberto pelo botão "Filtros"; no desktop, na lateral.
async function abrirFiltros(page) {
  if (celular(page)) await page.getByRole('button', { name: 'Filtros', exact: true }).click();
}

async function fecharFiltros(page) {
  if (celular(page)) await page.getByRole('button', { name: /^Ver \d+ sugest/ }).click();
}

test.describe('filtro de sinergia mínima', () => {
  test('esconde quem tem sinergia abaixo do mínimo e volta ao escolher "Qualquer"', async ({ page, request }) => {
    const tags = interessesExclusivos();
    const outras = interessesExclusivos();
    // Bia tem os mesmos interesses de Ana; Caio só divide o hobby.
    const ana = await criarPessoaPronta(request, { nome: 'Ana Filtro', ...tags });
    await criarPessoaPronta(request, { nome: 'Bia Afinidade', ...tags });
    await criarPessoaPronta(request, { nome: 'Caio Distante', tecnicas: outras.tecnicas, hobbies: tags.hobbies });

    await autenticarPagina(page, ana.token);
    await page.goto('/descobrir');
    await expect(page.getByRole('article', { name: 'Sugestão: Bia Afinidade' })).toBeVisible();

    await abrirFiltros(page);
    // O banco dos testes é compartilhado: há outras pessoas, então o total é conferido de forma relativa.
    const contador = page.getByRole('status').filter({ hasText: 'sugestões' });
    await expect(contador).toHaveText(/^([2-9]|\d{2,}) de \d+ sugestões$/);
    await page.getByRole('radio', { name: '80%+' }).check({ force: true });
    await expect(contador).toHaveText(/^1 de \d+ sugestões$/);
    await fecharFiltros(page);
    await expect(page.getByRole('article', { name: 'Sugestão: Bia Afinidade' })).toBeVisible();
    await expect(page.getByRole('article', { name: 'Sugestão: Caio Distante' })).toHaveCount(0);

    await abrirFiltros(page);
    await page.getByRole('radio', { name: 'Qualquer' }).check({ force: true });
    await expect(contador).toHaveText(/^([2-9]|\d{2,}) de \d+ sugestões$/);
  });

  test('sem ninguém acima do mínimo, explica e oferece limpar os filtros', async ({ page, request }) => {
    const tags = interessesExclusivos();
    const outras = interessesExclusivos();
    await criarPessoaPronta(request, { nome: 'Bia Afinidade', ...tags });
    const caio = await criarPessoaPronta(request, { nome: 'Caio Distante', tecnicas: outras.tecnicas, hobbies: tags.hobbies });

    await autenticarPagina(page, caio.token);
    await page.goto('/descobrir');
    await expect(page.getByRole('article', { name: 'Sugestão: Bia Afinidade' })).toBeVisible();

    await abrirFiltros(page);
    await page.getByRole('radio', { name: '80%+' }).check({ force: true });
    await fecharFiltros(page);
    await expect(page.getByText('Nenhuma sugestão com esses filtros')).toBeVisible();

    await page.getByRole('button', { name: 'Limpar filtros' }).click();
    await expect(page.getByRole('article', { name: 'Sugestão: Bia Afinidade' })).toBeVisible();
  });
});
