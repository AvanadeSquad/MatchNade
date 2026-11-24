import { expect, test } from '@playwright/test';
import { autenticarPagina, chamar, criarPessoaPronta, interessesExclusivos } from './helpers/api.js';

// No celular os dados ficam no menu do perfil e a bio e os objetivos na seção "Conta";
// no desktop tudo fica na própria página.
const celular = (page) => page.viewportSize().width < 900;

test.describe('edição de perfil', () => {
  test('editar nome, cidade, bio e objetivos persiste depois de recarregar', async ({ page, request }) => {
    const pessoa = await criarPessoaPronta(request, { nome: 'Vera Exemplo', ...interessesExclusivos() });
    await autenticarPagina(page, pessoa.token);
    await page.goto('/eu');

    await page.getByRole('button', { name: 'Editar perfil' }).first().click();
    const dados = page.getByRole('dialog', { name: 'Editar perfil' });
    await dados.getByLabel('Nome completo').fill('Vera Editada');
    await dados.getByLabel('Cidade').fill('Natal');
    await dados.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText('Perfil atualizado.')).toBeVisible();

    if (celular(page)) await page.getByRole('button', { name: 'Conta', exact: true }).click();
    await page.getByRole('button', { name: 'Editar', exact: true }).click();
    const bio = page.getByRole('dialog', { name: 'Resumo profissional' });
    await bio.getByRole('textbox').fill('Gosto de trilhas e de conversar sobre dados abertos.');
    await bio.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText('Resumo profissional salvo.')).toBeVisible();

    // O checkbox é controlado pelo perfil salvo: marca depois que a API responde.
    await page.getByRole('checkbox', { name: /Mentoria de carreira/ }).click();
    await expect(page.getByText('Objetivos de contato salvos.')).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /Mentoria de carreira/ })).toBeChecked();

    await page.reload();
    const perfil = await (await chamar(request, pessoa.token, 'get', '/profile')).json();
    expect(perfil).toMatchObject({ name: 'Vera Editada', location: 'Natal', bio: 'Gosto de trilhas e de conversar sobre dados abertos.' });
    expect(perfil.connection_goals).toEqual(expect.arrayContaining(['NETWORKING', 'MENTORIA']));
    await expect(page.locator('text=Vera Editada >> visible=true').first()).toBeVisible();
    if (celular(page)) await page.getByRole('button', { name: 'Conta', exact: true }).click();
    await expect(page.getByText('Gosto de trilhas e de conversar sobre dados abertos.')).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /Mentoria de carreira/ })).toBeChecked();
  });

  test('personalizar: avatar, pronomes, visibilidade e horários persistem e a outra pessoa vê avatar e pronomes', async ({ browser, page, request, baseURL, contextOptions }) => {
    const tags = interessesExclusivos();
    const vera = await criarPessoaPronta(request, { nome: 'Vera Personalizada', ...tags });
    const wagner = await criarPessoaPronta(request, { nome: 'Wagner Observador', ...tags });
    await autenticarPagina(page, vera.token);
    await page.goto('/eu');

    await page.getByRole('button', { name: celular(page) ? 'Personalizar perfil' : 'Personalizar', exact: true }).click();
    const dialogo = page.getByRole('dialog', { name: 'Personalizar perfil' });
    await dialogo.getByRole('button', { name: 'Avatar Sol' }).click();
    await dialogo.getByLabel(/Pronomes/).fill('ela/dela');
    await dialogo.getByRole('radio', { name: 'Só a minha unidade' }).click();
    await dialogo.getByRole('button', { name: '10:30' }).click();
    await dialogo.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText('Personalização salva.')).toBeVisible();

    const perfil = await (await chamar(request, vera.token, 'get', '/profile')).json();
    expect(perfil).toMatchObject({ avatar_id: 'sol', pronouns: 'ela/dela', visibility: 'UNIT', preferred_coffee_slots: ['10:30'] });

    // Quem é da mesma unidade continua vendo a pessoa, agora com avatar e pronomes.
    const { viewport, isMobile, hasTouch } = test.info().project.use;
    const contexto = await browser.newContext({ ...contextOptions, viewport, isMobile, hasTouch, baseURL });
    try {
      const outra = await contexto.newPage();
      await autenticarPagina(outra, wagner.token);
      await outra.goto('/descobrir');
      const cartao = outra.getByRole('article', { name: 'Sugestão: Vera Personalizada' });
      await expect(cartao).toBeVisible();
      await expect(cartao.getByText('ela/dela')).toBeVisible();
      await expect(cartao.locator('.avatar--pronto')).toBeVisible();
    } finally {
      await contexto.close();
    }
  });

  test('remover um interesse deixando menos de 3 é recusado com mensagem', async ({ page, request }) => {
    const pessoa = await criarPessoaPronta(request, { nome: 'Wagner Exemplo', ...interessesExclusivos() });
    await autenticarPagina(page, pessoa.token);
    await page.goto('/eu');
    if (celular(page)) await page.getByRole('button', { name: 'Interesses', exact: true }).click();

    await page.getByRole('button', { name: 'Adicionar skill' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Interesses profissionais' });
    const tecnicas = dialogo.getByRole('button', { pressed: true });
    await tecnicas.first().click();

    await expect(dialogo.getByText('não é possível salvar: escolha ao menos 3')).toBeVisible();
    await expect(dialogo.getByRole('button', { name: 'Salvar' })).toBeDisabled();
    const perfil = await (await chamar(request, pessoa.token, 'get', '/profile')).json();
    expect(perfil.tags.technical.length + perfil.tags.hobby.length).toBe(3);
  });
});
