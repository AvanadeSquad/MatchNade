# Frontend

React com Vite. Há duas versões de cada tela, seguindo os layouts de desktop e de celular: acima de 900 px, cabeçalho com navegação em pílulas e conteúdo em colunas; abaixo, as telas do layout mobile, com barra de navegação inferior. Onde a estrutura muda (cadastro dividido em mais telas, cartão da descoberta, lista de conexões, menu do perfil, tela de match), a página usa o hook `useCelular`; no resto, o CSS adapta.

## Rodar

No PowerShell, a partir da raiz do repositório (com a API rodando, veja `backend/README.md`):

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Abre em http://localhost:5173. Sem `VITE_GOOGLE_CLIENT_ID`, a tela de login mostra o seletor de pessoas do ambiente de desenvolvimento da API (`AUTH_DEV_LOGIN=true`). Com o ID configurado, mostra o botão do Google.

## Testes

```powershell
npm test
```

Testes de unidade com Vitest e Testing Library, em jsdom, ao lado do código (`*.test.js` e `*.test.jsx`):

- `components/Modal.test.jsx`: foco inicial no diálogo, Tab preso nos dois sentidos, Esc fecha e devolve o foco, e nada fecha enquanto `ocupado`.
- `components/MenuPessoa.test.jsx`: foco no primeiro item, setas e Home, Esc, confirmação de bloqueio e motivo obrigatório na denúncia.
- `hooks/useCarregar.test.js`: descarte de respostas e erros de execuções antigas, e nenhuma atualização de estado pedida depois de desmontar (o teste conta os pedidos, porque o React 18 ignora em silêncio as atualizações de um componente desmontado).
- `context/AuthContext.test.jsx`: resposta 401 encerra a sessão; falha de rede mantém a sessão e permite tentar de novo.
- `utils/formatar.test.js` e `utils/ignorados.test.js`: formatação e lista de ignorados por pessoa.
- `App.celular.test.jsx`: versões de celular de todas as telas, com o cadastro em duas telas e o fluxo objetivo, importação com IA, interesses e revisão.
- `pages/CadastroInteresses.test.jsx`: mínimo de 3 interesses, interesses e objetivos enviados ao salvar, objetivos preservados quando o propósito não muda, tags vindas da análise com IA e erro ao salvar.

A API é simulada com `vi.spyOn` no objeto `API`, sem rede.

### Dependências de desenvolvimento e `npm audit`

O `package.json` tem um `overrides` que fixa o `tinypool` (usado pelo Vitest para rodar os testes em paralelo) na versão 2.1.2. A versão 1.x que o Vitest 3 declara (`^1.1.1`) tem um alerta crítico no `npm audit` (poluição de protótipo nas opções do worker, com execução remota de código). A 2.1.2 fica fora do intervalo declarado pelo Vitest 3, por isso o `overrides`; a suíte roda igual com ela no Node 22 e no Node 24. Ao atualizar o Vitest para uma versão que já traga o `tinypool` corrigido, o `overrides` pode sair.

O `npm audit` completo ainda mostra alertas moderados e um alto em dependências de desenvolvimento: Vitest e `@vitest/mocker` (leitura de arquivo pelo redirecionamento de mock), Vite e esbuild (acesso ao servidor de desenvolvimento por outros sites e caminho fora da pasta). Todos afetam só o servidor de desenvolvimento e a execução de testes, que rodam na máquina de quem desenvolve; o `npm run build` gera arquivos estáticos sem nenhum deles. A correção exige versões principais novas (Vite 8, Vitest 5), com mudanças de configuração, e fica para uma atualização própria proposta pelo Dependabot. Enquanto isso, não exponha o `npm run dev` fora da máquina (não use `--host`).

O React Router, dependência de produção, também tem dois alertas moderados: redirecionamento aberto com barra invertida em `<Link>` e `useNavigate`, e injeção pela hidratação de erros do SSR. O app não usa SSR e só navega para caminhos montados pelo próprio código, então nenhum dos dois se aplica hoje; a correção é o React Router 7, também uma atualização própria. O CI falha só com alerta alto ou crítico em dependência de produção (`npm audit --audit-level=high --omit=dev`), e hoje passa.

## Lint e formatação

```powershell
npm run lint           # ESLint recomendado e regras de hooks do React
npm run format:check   # confere a formatação do Prettier
npm run format         # aplica a formatação
```

O ESLint usa as regras recomendadas e as regras `rules-of-hooks` e `exhaustive-deps` do React. O Prettier usa aspas simples, vírgula no fim e linhas de até 140 caracteres. Os estilos em `src/styles/` e os arquivos Markdown ficam fora do Prettier: os estilos usam regras compactas, uma por linha, e no Markdown o Prettier só realinharia as tabelas.

## Estrutura

```
src/
  styles/       tokens.css, theme.css e global.css (visual "Global Connect": desktop como base,
                blocos responsivos para telas médias e celular no fim)
  pages/        login, cadastro em 3 etapas (dados, interesses & IA, preferências), descobrir,
                matches bilaterais, mensagens & chat, meu perfil, perfil de outra pessoa e match
  components/   Layout (cabeçalho com navegação em pílulas, sino, rodapé e barra inferior no celular),
                Passos, SeletorTags, Controles (segmentado, equilíbrio, polos, interruptor), EdicaoPerfil,
                ícones SVG, modal e menu de ações
  context/      sessão (token e perfil) e avisos
  hooks/        useCarregar (busca com descarte de respostas antigas) e usePreferencias
  services/     api.js (cliente da API) e sessao.js (token)
  utils/        formatação, objetivos, preferências locais, convites de café, lidas e ignorados
```

## Rotas

Públicas: `/` (redireciona) e `/login`. As demais exigem sessão. Quem ainda não concluiu o cadastro (unidade, 3 interesses e um objetivo) é levado a `/cadastro/dados`.

| Rota | Tela |
|---|---|
| `/cadastro/dados`, `/cadastro/interesses`, `/cadastro/preferencias` | Cadastro em 3 etapas |
| `/descobrir` (`?q=` filtra pela busca do cabeçalho) | Sugestões por afinidade, com filtros |
| `/matches` | Destaque do match novo, solicitações recebidas, matches ativos e aguardando |
| `/chat`, `/chat/:id` (`?cafe=1` abre a proposta de café) | Conversas lado a lado no desktop |
| `/eu` | Perfil, parâmetros, objetivos, privacidade e sessão |
| `/pessoa/:id`, `/match/:id` | Perfil de outra pessoa e comemoração do match |

`/bem-vindo`, `/perfil/*` e `/conexoes` redirecionam para as rotas novas.

## O que fica só no navegador

A API não tem campos para alguns itens das telas. Eles ficam no `localStorage`, separados por conta:

- telefone, hub e CEP (cadastro), equilíbrio profissional x pessoal, alcance geográfico, polos habilitados e o aviso do sino (`utils/preferencias.js`). O equilíbrio reordena as sugestões usando a afinidade por eixo que a API devolve; o alcance "Local" filtra pela cidade; polos dão um pequeno bônus;
- conversas lidas (`utils/lidas.js`) e cafés agendados por conversa (`utils/cafe.js`).

Convites de Coffee Chat são mensagens comuns do chat com o prefixo `[Coffee Chat]`, então as duas pessoas veem o convite e o aceite sem rota nova na API.

Login: a API aceita o Google (`/auth/google`), e-mail e senha (`/auth/senha`) e, em desenvolvimento, só o e-mail (`/auth/dev-login`, com a senha em branco). A senha é definida depois do primeiro acesso, em Meu Perfil, Privacidade (diálogo `DefinirSenha`). O botão Microsoft 365 avisa que o SSO ainda não está habilitado.

## Regras do produto que a interface respeita

- O cartão da descoberta nunca mostra cargo ou senioridade.
- Match só existe quando os dois demonstram interesse.
- A IA nunca bloqueia o cadastro: se a análise da bio falhar, a pessoa escolhe os interesses manualmente.

## Cabeçalhos de segurança

O `vercel.json` (Vercel) e o `public/_headers` (Netlify) enviam, em todas as rotas, uma política de conteúdo (CSP) e os cabeçalhos `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` e `Strict-Transport-Security`. A CSP:

- só executa scripts do próprio site e o do login do Google (`https://accounts.google.com/gsi/client`), sem `unsafe-eval` nem script inline;
- aceita estilo inline (`'unsafe-inline'` em `style-src`) porque o script do Google injeta estilos no botão de login;
- só permite chamadas ao próprio site, ao Google e a `https://*.onrender.com`, onde a API é publicada. Se a API for publicada em outro domínio, troque esse endereço em `connect-src`, ou o app não consegue falar com ela;
- impede que o app seja aberto dentro de um iframe de outro site.

No Netlify, os mesmos cabeçalhos ficam em `public/_headers`, que o build copia para `dist/`. Os dois arquivos precisam ter a mesma política; `npm run test:cabecalhos` confere. Se a API for publicada fora de `*.onrender.com`, acrescente o domínio a `connect-src` nos dois.

O `npm run test:cabecalhos` ainda não roda no CI; rode-o depois de mexer em `vercel.json` ou `public/_headers`. Ele aceita os arquivos com fim de linha LF ou CRLF. Para entrar no CI, basta um passo `- run: npm run test:cabecalhos` no job do frontend, depois do `npm ci`: o teste usa só o `node:test`, sem dependências.
