import { test, expect } from '@playwright/test';

test.use({ channel: 'chrome', baseURL: 'http://127.0.0.1:5173', viewport: { width: 1440, height: 900 } });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('discovery filters find the right colleagues and can recover from an empty search', async ({ page }) => {
  await page.goto('/descobrir');
  await expect(page.getByRole('heading', { name: 'Marina Costa', exact: true })).toBeVisible();
  await expect(page.locator('.dc-suggestion-pill')).toHaveText('18 sugestões hoje');
  await page.locator('.dc-segmented').getByRole('button', { name: 'Local (SP)', exact: true }).click();
  await expect(page.locator('.dc-suggestion-pill')).toHaveText('7 sugestões hoje');
  await page.getByLabel('Buscar colaboradores', { exact: true }).fill('pessoa inexistente');
  await expect(page.getByRole('heading', { name: 'Nenhum colaborador encontrado' })).toBeVisible();
  await page.locator('.dc-empty').getByRole('button', { name: 'Limpar filtros', exact: true }).click();
  await expect(page.locator('.dc-suggestion-pill')).toHaveText('18 sugestões hoje');
  await page.getByLabel('UNIDADE AVANADE', { exact: true }).selectOption('Recife');
  await expect(page.getByRole('heading', { name: 'Ana Costa', exact: true })).toBeVisible();
  await expect(page.locator('.dc-person-meta')).toContainText('Recife');
});

test('pagination changes the suggested person and connecting creates a persistent match', async ({ page }) => {
  await page.goto('/descobrir');
  await page.locator('.dc-pagination').getByRole('button', { name: 'Próximo', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ana Costa', exact: true })).toBeVisible();
  await page.locator('.dc-pagination').getByRole('button', { name: 'Anterior', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Marina Costa', exact: true })).toBeVisible();
  await page.getByLabel('Buscar colaboradores', { exact: true }).fill('Júlia Santos');
  await expect(page.getByRole('heading', { name: 'Júlia Santos', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Conectar com Júlia', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Ver conexão', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('matchnade.demo.v1')).matchIds.includes('julia'))).toBe(true);
  await page.goto('/matches');
  await expect(page.locator('.mt-row').filter({ has: page.getByRole('heading', { name: 'Júlia Santos', exact: true }) })).toBeVisible();
});

test('coffee scheduling saves the date and survives reloading the matches page', async ({ page }) => {
  await page.goto('/descobrir');
  await page.getByRole('button', { name: 'Agendar Coffee Chat', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Vamos marcar um café?' });
  await expect(dialog).toBeVisible();
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const year = nextWeek.getFullYear();
  const month = String(nextWeek.getMonth() + 1).padStart(2, '0');
  const day = String(nextWeek.getDate()).padStart(2, '0');
  await dialog.getByLabel('Data', { exact: true }).fill(`${year}-${month}-${day}`);
  await dialog.getByLabel('Horário', { exact: true }).selectOption('14:30');
  await dialog.getByRole('button', { name: 'Confirmar café', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('matchnade.demo.v1')).scheduled.marina)).toContain(`${day}/${month}/${year} às 14:30`);
  await page.goto('/matches');
  const marina = page.locator('.mt-row').filter({ has: page.getByRole('heading', { name: 'Marina Costa', exact: true }) });
  await expect(marina).toContainText(`${day}/${month}/${year} às 14:30`);
  await page.reload();
  await marina.getByRole('button', { name: 'Ver Detalhes do Encontro', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Seu Coffee Chat está agendado' })).toContainText(`${day}/${month}/${year} às 14:30`);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('matches search narrows the list and opening Ana selects her conversation', async ({ page }) => {
  await page.goto('/matches');
  await page.getByLabel('Buscar matches', { exact: true }).fill('Ana Costa');
  await expect(page.locator('.mt-row')).toHaveCount(1);
  await expect(page.locator('.mt-row')).toContainText('Ana Costa');
  await page.locator('.mt-row').getByRole('button', { name: 'Ver Perfil', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Perfil do colaborador' })).toContainText('Ana Costa');
  await page.getByRole('dialog').getByRole('button', { name: 'Abrir chat', exact: true }).click();
  await expect(page).toHaveURL(/\/mensagens$/);
  await expect(page.locator('.community-conversation-heading')).toContainText('Ana Costa');
});

test('discovery and matches fit mobile, tablet and desktop widths', async ({ page }, testInfo) => {
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of ['/descobrir', '/matches']) {
      await page.goto(route);
      await expect(page.locator('h1')).toBeVisible();
      const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
      expect(dimensions.scroll, `${route} has no horizontal overflow at ${width}px`).toBeLessThanOrEqual(dimensions.width);
    }
  }
  await page.goto('/descobrir');
  await page.screenshot({ path: testInfo.outputPath('discover-1440.png'), fullPage: true });
});
