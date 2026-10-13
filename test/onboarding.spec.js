import { test, expect } from '@playwright/test';

test('o fluxo de configuração valida os termos e persiste as preferências', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/entrar');
  const passwordLabelBounds = await page.locator('.login-password-label > label').boundingBox();
  const recoveryBounds = await page.getByRole('button', { name: 'Esqueceu sua senha corporativa?' }).boundingBox();
  expect(recoveryBounds.x).toBeGreaterThan(passwordLabelBounds.x + passwordLabelBounds.width + 12);
  await page.getByLabel('E-mail corporativo', { exact: true }).fill('joana.silva@avanade.com');
  const password = page.getByLabel('Senha', { exact: true });
  await password.fill('senha-demo');
  await page.getByRole('button', { name: 'Mostrar senha', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Ocultar senha', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Acessar o Global Connect' }).click();
  await expect(page).toHaveURL(/\/cadastro$/);

  await page.getByRole('button', { name: 'Continuar para Interesses' }).click();
  await expect(page.getByRole('alert')).toHaveText('Aceite os termos de convivência para continuar.');
  await expect(page).toHaveURL(/\/cadastro$/);
  await page.getByRole('textbox', { name: /Nome completo/ }).fill('Joana Silva');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Continuar para Interesses' }).click();
  await expect(page).toHaveURL(/\/interesses$/);

  const cloud = page.getByRole('button', { name: 'Cloud', exact: true });
  await expect(cloud).toHaveAttribute('aria-pressed', 'true');
  await cloud.click();
  await expect(cloud).toHaveAttribute('aria-pressed', 'false');
  await cloud.click();
  await page.getByRole('button', { name: 'Inovação', exact: true }).click();
  await page.getByRole('button', { name: 'Fotografia', exact: true }).click();
  await page.getByRole('radio', { name: /Encontrar oportunidades/ }).check();
  await page.getByRole('button', { name: 'Salvar e Ver Preferências' }).click();
  await expect(page).toHaveURL(/\/preferencias$/);
  await expect(page.getByRole('heading', { name: 'Joana Silva' })).toBeVisible();

  const slider = page.getByRole('slider', { name: 'Porcentagem de afinidade profissional' });
  await slider.focus();
  await slider.press('ArrowRight');
  await slider.press('ArrowRight');
  await expect(slider).toHaveValue('80');
  await page.getByRole('button', { name: 'Continental (LATAM)', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Continental (LATAM)', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Remover Avanade São Paulo', exact: true }).click();
  await page.getByRole('button', { name: 'Adicionar unidade', exact: true }).click();
  await page.getByRole('combobox', { name: 'Polo para adicionar' }).selectOption('Avanade Belo Horizonte');
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remover Avanade Belo Horizonte' })).toBeVisible();
  await page.getByRole('button', { name: 'Salvar preferências e acessar a plataforma' }).click();
  await expect(page).toHaveURL(/\/descobrir$/);

  const storedProfile = await page.evaluate(() => JSON.parse(localStorage.getItem('matchnade.demo.v1')).profile);
  expect(storedProfile).toMatchObject({ name: 'Joana Silva', email: 'joana.silva@avanade.com', goal: 'opportunities', balance: 80, region: 'continental' });
  expect(storedProfile.skills).toContain('Inovação');
  expect(storedProfile.hobbies).toContain('Fotografia');
  expect(storedProfile.hubs).toContain('Avanade Belo Horizonte');
  expect(storedProfile.hubs).not.toContain('Avanade São Paulo');
  await page.goto('/preferencias');
  await expect(slider).toHaveValue('80');
  await expect(page.getByRole('heading', { name: 'Joana Silva' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('o upload valida tipo e tamanho e a análise permanece demonstrativa', async ({ page }) => {
  await page.goto('/interesses');
  const uploader = page.getByLabel('Selecionar currículo PDF ou DOCX');
  await uploader.setInputFiles({ name: 'curriculo.txt', mimeType: 'text/plain', buffer: Buffer.from('arquivo inválido') });
  await expect(page.getByRole('alert')).toHaveText('Selecione um arquivo PDF ou DOCX.');
  await uploader.setInputFiles({ name: 'curriculo-grande.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(10 * 1024 * 1024 + 1) });
  await expect(page.getByRole('alert')).toHaveText('O arquivo deve ter no máximo 10 MB.');
  await uploader.setInputFiles({ name: 'curriculo-demo.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nCurrículo de demonstração') });
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByText('curriculo-demo.pdf', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Cloud', exact: true }).click();
  await page.getByRole('button', { name: 'UX Design', exact: true }).click();
  await page.getByRole('button', { name: 'Analisar com IA', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Simulando análise...' })).toBeDisabled();
  await expect(page.getByText('SIMULAÇÃO CONCLUÍDA', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cloud', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'UX Design', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Demonstração local · análise simulada', { exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Seu arquivo não foi enviado nem analisado por um serviço externo');
});

test('é necessário selecionar um interesse profissional para avançar', async ({ page }) => {
  await page.goto('/interesses');
  for (const name of ['Cloud', 'Data & AI', 'UX Design']) await page.getByRole('button', { name, exact: true }).click();
  await page.getByRole('button', { name: 'Salvar e Ver Preferências' }).click();
  await expect(page).toHaveURL(/\/interesses$/);
  await expect(page.getByRole('status')).toContainText('Selecione pelo menos um interesse profissional');
});

for (const width of [375, 768, 1440]) {
  test(`as telas de configuração cabem no viewport de ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['/entrar', '/cadastro', '/interesses', '/preferencias']) {
      await page.goto(route);
      await page.evaluate(() => document.fonts.ready);
      const dimensions = await page.evaluate(() => ({ width: window.innerWidth, content: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) }));
      expect(dimensions.content, `${route} em ${width}px`).toBeLessThanOrEqual(dimensions.width + 1);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      if (width === 1440 && route === '/entrar') await page.screenshot({ path: testInfo.outputPath('login-desktop.png'), fullPage: true });
    }
  });
}
