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

- `tests/cadastro.spec.js`: API no ar e rotas protegidas, redirecionamento ao login, cadastro de uma pessoa nova até a descoberta (dados, interesses e preferências, nas duas versões de tela), caminho manual quando a IA falha, criação de tag e recusa de cargo, e a tela de entrada sem campo de senha nem LinkedIn.
- `tests/conexoes.spec.js`: match mútuo entre duas pessoas em navegadores separados com chat em tempo real, aceitar uma solicitação recebida, chat bloqueado sem match, bloquear e pausar a exposição.
- `tests/regras.spec.js`: cargo oculto antes do match, denúncia, foco e teclado de diálogos e menus, desbloquear, recusar, excluir dados, sessão inválida ou expirada, cota usada, menu superior no desktop e barra inferior no celular, chat em duas colunas ou uma tela por vez e ausência de rolagem horizontal.

- `tests/acessibilidade.spec.js`: varre com o axe (`@axe-core/playwright`) as telas de login, cadastro (dados, interesses e preferências, análise do texto em andamento e sem IA, interesses sugeridos), descoberta (com pessoas e com a cota da semana esgotada), perfil de outra pessoa com o menu e os diálogos de bloquear e denunciar abertos, matches com solicitações recebidas, ativas e aguardando, match, lista de conversas sem conversa aberta, chat e perfil próprio com seus diálogos. Usa as regras WCAG 2.1 A e AA e falha em violações sérias ou críticas. As violações moderadas e menores e os itens que o axe não decide sozinho (`incomplete`, como contraste sobre o fundo escurecido de um diálogo) não bloqueiam e vão anexados ao relatório (`npm run report`), um anexo `axe: <tela>` por tela. Para chegar à revisão de tags, a resposta da análise da bio é simulada no navegador, porque os testes rodam com a IA desligada.

Não cobertos ainda: o fluxo da revisão de tags com a IA real respondendo (os testes rodam com a IA desligada; a acessibilidade da tela é verificada com a resposta simulada) e o login real do Google.

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

As referências valem só para Linux, o sistema do CI. Em outros sistemas esses testes são pulados. Esses testes não são repetidos em caso de falha, mesmo no CI: a repetição encontraria no banco as pessoas da primeira tentativa e a tela mudaria.

### Primeira execução no CI

As referências versionadas vêm de uma máquina Linux de desenvolvimento, não do CI. Se o Chromium do CI desenhar alguma tela um pouco diferente, a primeira execução do CI falha nos testes visuais, mesmo sem nenhuma mudança visual, até as referências serem geradas no mesmo ambiente do CI. Para isso, siga o passo a passo abaixo com o relatório dessa execução; depois do commit das imagens, as execuções seguintes comparam com referências do próprio CI.

### Atualizar as referências com as imagens do CI

O Chromium que o CI instala pode desenhar um pouco diferente do Chromium de outra máquina. Por isso as referências devem vir do próprio CI. Quando uma captura não bate com a referência, ou a referência ainda não existe, o teste falha e anexa a imagem real com o nome exato do arquivo de referência, como `nova-referencia/descoberta-desktop-linux.png`. O relatório traz também as imagens esperada, real e de diferença.

1. Na execução do CI que falhou, baixe o artefato `relatorio-playwright` e descompacte.
2. Abra o relatório: `npx playwright show-report caminho/da/pasta/descompactada`.
3. Em cada teste visual que falhou, confira a diferença. Se a mudança é intencional, salve cada anexo `nova-referencia/<arquivo>.png` em `tests/visual.spec.js-snapshots/<arquivo>.png`, substituindo o antigo.
4. Faça o commit das imagens. A próxima execução do CI compara com elas.

Numa máquina Linux com o Chromium da versão do Playwright do projeto (instalado com `npx playwright install --with-deps chromium`, como no CI), também é possível gerar as referências localmente. O script roda só o spec visual e grava as imagens novas:

```bash
npm run test:visual:atualizar
```

Em Windows ou macOS o script não gera nada, porque os testes visuais são pulados fora do Linux.

O relatório do Playwright (`npm run report`) mostra lado a lado a referência, a captura nova e a diferença.
