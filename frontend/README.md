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
- `hooks/useCarregar.test.js`: descarte de respostas e erros de execuções antigas e nada atualizado depois de desmontar.
- `context/AuthContext.test.jsx`: resposta 401 encerra a sessão; falha de rede mantém a sessão e permite tentar de novo.
- `utils/formatar.test.js` e `utils/ignorados.test.js`: formatação e lista de ignorados por pessoa.
- `pages/Interesses.test.jsx`: mínimo de 3 interesses, dados enviados ao salvar, tag vinda da análise e erro ao salvar.

A API é simulada com `vi.spyOn` no objeto `API`, sem rede.

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
