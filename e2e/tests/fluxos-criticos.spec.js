const { test } = require('@playwright/test');
const { entrarComo } = require('./helpers/auth');

// Fluxos criticos do app. Cada teste esta marcado como fixme: descreve o roteiro
// e passa a valer quando as telas e os endpoints existirem. Ao implementar,
// troque test.fixme por test e complete os seletores.

test.describe('Fluxos criticos', () => {
  test.fixme('perfil novo: bio, tags e objetivos', async ({ page, request }) => {
    await entrarComo(page, request, 'ana.silva@exemplo.test');
    await page.goto('/perfil/bio');
    // 1. escrever a bio e confirmar
    // 2. escolher ao menos 3 interesses (a tela nao deixa salvar com menos)
    // 3. marcar ao menos 1 objetivo de conexao
    // 4. conferir que chega na tela de descoberta
  });

  test.fixme('match mutuo entre dois usuarios libera o chat', async ({ browser, request }) => {
    // Dois contextos separados = dois usuarios logados ao mesmo tempo.
    const contextoA = await browser.newContext();
    const contextoB = await browser.newContext();
    const paginaA = await contextoA.newPage();
    const paginaB = await contextoB.newPage();
    await entrarComo(paginaA, request, 'ana.silva@exemplo.test');
    await entrarComo(paginaB, request, 'marina.costa@exemplo.test');

    // 1. A demonstra interesse em B: a conexao fica aguardando
    // 2. B demonstra interesse em A: a conexao vira match e aparece "Deu match"
    // 3. A abre o chat e ve o icebreaker sugerido
    // 4. A envia uma mensagem e B a recebe

    await contextoA.close();
    await contextoB.close();
  });

  test.fixme('chat nao abre sem match', async ({ page, request }) => {
    await entrarComo(page, request, 'ana.silva@exemplo.test');
    // Acessar o chat de uma conexao ainda pendente deve ser negado (403)
    // e a tela nao deve mostrar o campo de mensagem.
  });

  test.fixme('bloquear faz a pessoa sumir da descoberta', async ({ page, request }) => {
    await entrarComo(page, request, 'ana.silva@exemplo.test');
    await page.goto('/descobrir');
    // 1. bloquear a pessoa exibida no cartao, confirmando no modal
    // 2. recarregar a descoberta e conferir que ela nao aparece mais
  });
});
