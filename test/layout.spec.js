import { test, expect } from '@playwright/test';
import { people } from '../src/data.js';

const pages = ['/entrar', '/cadastro', '/interesses', '/preferencias', '/descobrir', '/matches', '/mensagens', '/perfil'];
for (const width of [375, 768, 1440]) {
  test(`all eight screens render without runtime errors or overflow at ${width}px`, async ({ page }, testInfo) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height: 960 });
    for (const path of pages) {
      await page.goto(path);
      await expect(page.locator('h1')).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const dimensions = await page.evaluate(() => ({ width: window.innerWidth, page: document.documentElement.scrollWidth }));
      expect(dimensions.page, `Overflow on ${path} at ${width}px`).toBeLessThanOrEqual(dimensions.width);
      if (width === 1440 && ['/entrar', '/descobrir', '/perfil'].includes(path)) await page.screenshot({ path: testInfo.outputPath(`${path.slice(1)}-desktop.png`), fullPage: true });
    }
    expect(errors).toEqual([]);
  });
}
test('mobile navigation and global search work together', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/descobrir');
  await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
  await page.getByRole('link', { name: 'Meu Perfil', exact: true }).click();
  await expect(page).toHaveURL(/\/perfil$/);
  await page.getByRole('button', { name: 'Abrir busca' }).click();
  await page.getByRole('textbox', { name: 'Buscar por skills, projetos ou interesses' }).fill('Marina');
  await page.getByRole('textbox', { name: 'Buscar por skills, projetos ou interesses' }).press('Enter');
  await expect(page).toHaveURL(/\/descobrir$/);
  await expect(page.getByRole('heading', { name: 'Marina Costa' })).toBeVisible();
});

test('opening a later match on mobile shows that conversation directly', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.addInitScript(ids => {
    localStorage.setItem('matchnade.demo.v1', JSON.stringify({ matchIds: ids }));
  }, people.map(person => person.id));
  await page.goto('/matches');
  await page.getByRole('textbox', { name: 'Buscar matches', exact: true }).fill('Renata Campos');
  await page.locator('.mt-row').getByRole('button', { name: 'Abrir Chat', exact: true }).click();
  await expect(page).toHaveURL(/\/mensagens$/);
  await expect(page.locator('.community-conversation-heading')).toBeVisible();
  await expect(page.locator('.community-conversation-person strong')).toHaveText('Renata Campos');
  await page.getByRole('button', { name: 'Voltar para conversas', exact: true }).click();
  await expect(page.locator('.community-contact')).toHaveCount(18);
});
