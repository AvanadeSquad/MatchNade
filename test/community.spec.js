import { expect, test } from '@playwright/test';

test.use({ channel: 'chrome', baseURL: 'http://127.0.0.1:5173' });

test('mensagens enviadas persistem e Ana Costa abre a conversa correta', async ({ page }) => {
  await page.goto('/mensagens');
  const content = 'Vamos trocar ideias sobre acessibilidade na próxima semana?';
  await page.getByRole('textbox', { name: 'Escreva uma mensagem' }).fill(content);
  await page.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(page.locator('.community-message-row.own .community-message-bubble').last()).toHaveText(content);
  await page.reload();
  await expect(page.locator('.community-message-row.own .community-message-bubble').last()).toHaveText(content);
  await page.getByRole('textbox', { name: 'Buscar conversas' }).fill('Ana Costa');
  await expect(page.locator('.community-contact')).toHaveCount(1);
  await page.locator('.community-contact').click();
  await expect(page.locator('.community-conversation-person strong')).toHaveText('Ana Costa');
  await expect(page.locator('.community-message-bubble')).toContainText('Nosso café ficou para sexta às 10:30');
  await page.getByRole('textbox', { name: 'Buscar conversas' }).fill('');
  await page.getByRole('button', { name: 'Não lidas 1' }).click();
  await expect(page.locator('.community-contact')).toHaveCount(1);
  await expect(page.locator('.community-contact')).toContainText('Marina Costa');
});

test('aceitar convite persiste o café e mantém horário coerente', async ({ page }) => {
  await page.goto('/mensagens');
  await expect(page.locator('.community-invitation')).toContainText('terça-feira às 10:30');
  await page.getByRole('button', { name: 'Aceitar convite' }).click();
  await expect(page.locator('.community-invitation')).toContainText('Confirmado: Terça-feira, às 10:30');
  await expect(page.locator('.community-invitation')).toContainText('Café confirmado');
  await page.reload();
  await expect(page.locator('.community-invitation')).toContainText('Confirmado: Terça-feira, às 10:30');
  await page.goto('/matches');
  await expect(page.locator('.mt-row').filter({ hasText: 'Marina Costa' })).toContainText('Café agendado: Terça-feira, às 10:30');
});

test('editar perfil, interesses e preferências persiste após recarregar', async ({ page }) => {
  await page.goto('/perfil');
  await page.getByRole('button', { name: 'Editar perfil' }).click();
  const dialog = page.getByRole('dialog', { name: 'Editar perfil corporativo' });
  await dialog.getByLabel('Nome completo').fill('Ana Silva Santos');
  await dialog.getByLabel('Cidade / estado').fill('Curitiba, PR');
  await dialog.getByLabel('Telefone / Teams').fill('(41) 99999-4321');
  await dialog.getByLabel('Unidade / hub').fill('Avanade Curitiba');
  await dialog.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.locator('.community-identity h2')).toContainText('Ana Silva Santos');
  const range = page.getByRole('slider', { name: 'Percentual de foco profissional' });
  await range.focus();
  await range.press('End');
  for (let index = 0; index < 3; index += 1) await range.press('ArrowLeft');
  await expect(range).toHaveValue('85');
  await page.getByRole('button', { name: 'Continental (LATAM)', exact: true }).click();
  await page.getByRole('switch', { name: 'Notificações no Microsoft Teams' }).click();
  await page.getByRole('checkbox', { name: /^Exploração de alocação/ }).check();
  await page.getByRole('button', { name: 'Adicionar skill' }).click();
  await page.getByRole('textbox', { name: 'Adicionar Skill' }).fill('TypeScript');
  await page.getByRole('textbox', { name: 'Adicionar Skill' }).press('Enter');
  await page.getByRole('button', { name: 'Adicionar polo' }).click();
  await page.getByRole('dialog').getByLabel('Unidade', { exact: true }).fill('Avanade Curitiba');
  await page.getByRole('dialog').getByRole('button', { name: 'Adicionar unidade' }).click();
  await page.reload();
  await expect(page.locator('.community-identity h2')).toContainText('Ana Silva Santos');
  await expect(page.locator('.community-profile-location')).toContainText('Curitiba, PR');
  await expect(range).toHaveValue('85');
  await expect(page.getByRole('button', { name: 'Continental (LATAM)', exact: true })).toHaveClass(/active/);
  await expect(page.getByRole('switch', { name: 'Notificações no Microsoft Teams' })).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByRole('checkbox', { name: /^Exploração de alocação/ })).toBeChecked();
  await expect(page.locator('.community-editable-tags')).toContainText(['TypeScript', 'Jogos de Tabuleiro']);
  await expect(page.locator('.community-hub-tags')).toContainText('Avanade Curitiba');
});

test('privacidade abre e logout retorna ao login', async ({ page }) => {
  await page.goto('/perfil');
  await page.getByRole('button', { name: 'Ler diretrizes' }).click();
  await expect(page.getByRole('dialog', { name: 'Privacidade & governança' })).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('demonstração do front-end');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Sair da conta corporativa' }).click();
  await expect(page).toHaveURL(/\/entrar$/);
  await expect(page.getByRole('heading', { name: 'Acesse sua conta' })).toBeVisible();
});

test('mensagens e perfil se adaptam a 375, 768 e 1440 sem overflow', async ({ page }, testInfo) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    for (const route of ['/mensagens', '/perfil']) {
      await page.goto(route);
      await expect(page.locator('.community-page')).toBeVisible();
      if (route === '/mensagens' && width === 375) {
        await page.locator('.community-contact').filter({ hasText: 'Marina Costa' }).click();
        await expect(page.locator('.community-conversation')).toBeVisible();
        await expect(page.locator('.community-contact-sidebar')).not.toBeVisible();
        await page.getByRole('textbox', { name: 'Escreva uma mensagem' }).fill('Olá no celular!');
        await page.getByRole('button', { name: 'Enviar', exact: true }).click();
        await expect(page.locator('.community-message-row.own .community-message-bubble').last()).toHaveText('Olá no celular!');
      }
      const sizes = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: window.innerWidth }));
      expect(sizes.document, `${route} em ${width}px`).toBeLessThanOrEqual(sizes.viewport);
      await page.screenshot({ path: testInfo.outputPath(`${route.slice(1)}-${width}.png`), fullPage: true });
    }
  }
  expect(pageErrors).toEqual([]);
});
