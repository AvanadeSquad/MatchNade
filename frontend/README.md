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
