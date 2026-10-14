# Frontend

React com Vite. O layout é pensado para desktop (menu lateral e conteúdo em colunas) e se adapta a celular abaixo de 900 px, com coluna única e barra de navegação inferior. O conteúdo e o estilo seguem as telas de `docs/design/telas`.

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
- `pages/Interesses.test.jsx`: mínimo de 3 interesses, dados enviados ao salvar, tag vinda da análise e erro ao salvar.

A API é simulada com `vi.spyOn` no objeto `API`, sem rede.

### Dependências de desenvolvimento e `npm audit`

O `package.json` tem um `overrides` que fixa o `tinypool` (usado pelo Vitest para rodar os testes em paralelo) na versão 2.1.2. A versão 1.x que o Vitest 3 declara (`^1.1.1`) tem um alerta crítico no `npm audit` (poluição de protótipo nas opções do worker, com execução remota de código). A 2.1.2 fica fora do intervalo declarado pelo Vitest 3, por isso o `overrides`; a suíte roda igual com ela no Node 22 e no Node 24. Ao atualizar o Vitest para uma versão que já traga o `tinypool` corrigido, o `overrides` pode sair.

O `npm audit` completo ainda mostra alertas moderados e um alto em dependências de desenvolvimento: Vitest e `@vitest/mocker` (leitura de arquivo pelo redirecionamento de mock), Vite e esbuild (acesso ao servidor de desenvolvimento por outros sites e caminho fora da pasta). Todos afetam só o servidor de desenvolvimento e a execução de testes, que rodam na máquina de quem desenvolve; o `npm run build` gera arquivos estáticos sem nenhum deles. A correção exige versões principais novas (Vite 8, Vitest 5), com mudanças de configuração, e fica para uma atualização própria proposta pelo Dependabot. Enquanto isso, não exponha o `npm run dev` fora da máquina (não use `--host`).

O React Router, dependência de produção, também tem dois alertas moderados: redirecionamento aberto com barra invertida em `<Link>` e `useNavigate`, e injeção pela hidratação de erros do SSR. O app não usa SSR e só navega para caminhos montados pelo próprio código, então nenhum dos dois se aplica hoje; a correção é o React Router 7, também uma atualização própria. O CI falha só com alerta alto ou crítico em dependência de produção (`npm audit --audit-level=high --omit=dev`), e hoje passa.

## Estrutura

```
src/
  styles/       tokens.css (cópia de docs/design), theme.css (contraste AA) e global.css
                (desktop como base, bloco responsivo para celular no fim)
  pages/        uma página por tela: login, cadastro, bio, análise, revisão, interesses,
                objetivos, descoberta, perfil da pessoa, match, conexões, chat e perfil
  components/   navegação (menu lateral e barra inferior), ícones SVG, modal, menu de ações
  context/      sessão (token e perfil) e avisos
  hooks/        useCarregar (busca com descarte de respostas antigas)
  services/     api.js (cliente da API) e sessao.js (token)
  utils/        formatação, objetivos de conexão e pessoas ignoradas
```

## Rotas

Públicas: `/` e `/login`. As demais exigem sessão. Quem ainda não concluiu o cadastro (unidade, 3 interesses e um objetivo) é levado a `/bem-vindo`.

| Rota | Tela |
|---|---|
| `/bem-vindo`, `/perfil/bio`, `/perfil/analisando`, `/perfil/revisao`, `/perfil/interesses`, `/perfil/objetivos` | Cadastro |
| `/descobrir` | Sugestões por afinidade |
| `/pessoa/:id` | Perfil de outra pessoa |
| `/match/:id` | Tela de match |
| `/conexoes` | Recebidas, confirmadas e aguardando |
| `/chat`, `/chat/:id` | Conversas (lista e conversa lado a lado no desktop) |
| `/eu` | Perfil, privacidade e configurações |

## Regras do produto que a interface respeita

- O cartão da descoberta nunca mostra cargo ou senioridade.
- Match só existe quando os dois demonstram interesse.
- A IA nunca bloqueia o cadastro: se a análise da bio falhar, a pessoa escolhe os interesses manualmente.

## Cabeçalhos de segurança

O `vercel.json` envia, em todas as rotas, uma política de conteúdo (CSP) e os cabeçalhos `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` e `Strict-Transport-Security`. A CSP:

- só executa scripts do próprio site e o do login do Google (`https://accounts.google.com/gsi/client`), sem `unsafe-eval` nem script inline;
- aceita estilo inline (`'unsafe-inline'` em `style-src`) porque o script do Google injeta estilos no botão de login;
- só permite chamadas ao próprio site, ao Google e a `https://*.onrender.com`, onde a API é publicada. Se a API for publicada em outro domínio, troque esse endereço em `connect-src`, ou o app não consegue falar com ela;
- impede que o app seja aberto dentro de um iframe de outro site.

O `public/_redirects` (Netlify) não carrega esses cabeçalhos.
