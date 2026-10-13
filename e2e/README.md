# Testes de ponta a ponta (Playwright)

Testam o app como uma pessoa usaria, no navegador, contra a API e o frontend reais. Ficam nesta pasta, com `package.json` próprio, separados do backend e do frontend.

## Instalar e rodar

Requer Node.js 20 ou superior. No PowerShell:

```powershell
cd e2e
npm install
npx playwright install chromium
npm test
```

O `playwright.config.js` sobe sozinho a API (porta 3100, banco em memória com dados fictícios, IA desligada) e o frontend (porta 5174). Não é preciso deixar nada rodando, e o ambiente de desenvolvimento nas portas 3000 e 5173 não é afetado.

```powershell
npm run test:ui                         # modo interativo, bom para escrever e depurar
npm run test:headed                     # mostra o navegador
npm run report                          # abre o relatório da última execução
npx playwright test --project=desktop    # só o desktop (ou --project=celular)
```

Os testes rodam em dois tamanhos de tela: `desktop` (1280x800, o layout principal) e `celular` (390x844, a adaptação responsiva).

## O que está coberto

- `tests/cadastro.spec.js`: API no ar e rotas protegidas, redirecionamento ao login, cadastro de uma pessoa nova até a descoberta, caminho manual quando a IA falha, criação de tag e recusa de cargo.
- `tests/conexoes.spec.js`: match mútuo entre duas pessoas em navegadores separados com chat em tempo real, aceitar uma solicitação recebida, chat bloqueado sem match, bloquear e pausar a exposição.
- `tests/regras.spec.js`: cargo oculto antes do match, denúncia, foco e teclado de diálogos e menus, desbloquear, recusar, excluir dados, sessão inválida ou expirada, cota usada, menu lateral no desktop e barra inferior no celular, chat em duas colunas ou uma tela por vez e ausência de rolagem horizontal.

Não cobertos ainda: a revisão de tags com a IA respondendo (os testes rodam com a IA desligada) e o login real do Google.

## Como funciona o login nos testes

O Google bloqueia login automatizado. A API só registra `POST /api/v1/test/login` quando roda com `E2E_TEST_MODE=true`, e recusa iniciar em produção com essa flag. O helper `tests/helpers/api.js` usa essa rota, grava o token no `localStorage` antes de a página carregar e cria pessoas prontas pela API, com interesses exclusivos de cada teste para que as duas pessoas de um fluxo fiquem com afinidade máxima entre si.

## Escrever um teste

1. Criar as pessoas com `criarPessoaPronta` e `interessesExclusivos`.
2. Para fluxos com duas pessoas, abrir dois contextos de navegador (veja o teste de match mútuo) e fechá-los em `finally`.
3. Preferir `getByRole` e `getByLabel`, que dependem menos da estrutura do HTML.

## Boas práticas

- Poucos testes de ponta a ponta, só para os fluxos principais. Regras de negócio (cota, expiração, permissão do chat) ficam no `backend/test`, que é mais rápido e estável.
- Dados sempre fictícios.
- Os dois projetos compartilham o mesmo banco; por isso cada teste cria as próprias pessoas e roda um de cada vez.

## Regressão visual

`tests/visual.spec.js` captura login, descoberta, perfil de outra pessoa, match, conexões, chat e perfil próprio, em desktop e celular. As capturas de referência ficam em `tests/visual.spec.js-snapshots/` e são comparadas com `toHaveScreenshot`. Para as telas não variarem entre execuções:

- cada teste cria pessoas com nomes e interesses fixos por teste e por projeto, e o banco em memória nasce vazio a cada execução;
- a fonte é trocada por Liberation Sans durante a captura, porque a Inter existe em algumas máquinas e não em outras;
- as animações ficam desligadas;
- até 100 pixels diferentes são tolerados, para a suavização de bordas que muda entre versões do Chromium. Trocar a cor do nome no cartão da descoberta muda cerca de 850 pixels e é detectado.

As referências valem só para Linux, o sistema do CI. Em outros sistemas esses testes são pulados. Esses testes não são repetidos em caso de falha, mesmo no CI: a repetição encontraria no banco as pessoas da primeira tentativa e a tela mudaria. Depois de uma mudança visual intencional, gere as referências de novo no Linux, com o Chromium da versão do Playwright do projeto, e versione as imagens:

```bash
npx playwright test tests/visual.spec.js --update-snapshots
```

O relatório do Playwright (`npm run report`) mostra lado a lado a referência, a captura nova e a diferença.
