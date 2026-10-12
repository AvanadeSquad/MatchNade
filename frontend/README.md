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
