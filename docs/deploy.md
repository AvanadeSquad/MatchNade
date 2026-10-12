# Publicação com custo zero

Três serviços gratuitos: banco (Neon), API (Render) e frontend (Vercel ou Netlify). Confira os limites atuais de cada plano antes de depender deles.

## 1. Banco (Neon)

1. Crie um projeto no Neon e copie a string de conexão (já inclui `sslmode=require`).
2. Guarde como `DATABASE_URL`. As tabelas são criadas na primeira inicialização da API.

## 2. Login com Google

1. No Google Cloud Console, crie um ID de cliente OAuth do tipo "Aplicativo da Web".
2. Em "Origens JavaScript autorizadas", adicione a URL do frontend (e `http://localhost:5173` para testar).
3. Guarde o ID como `GOOGLE_CLIENT_ID` na API e `VITE_GOOGLE_CLIENT_ID` no frontend.
4. Defina quem pode entrar: `ALLOWED_EMAIL_DOMAINS` (por exemplo `suaempresa.com`) e/ou `ALLOWED_EMAILS`. Em produção a API não inicia sem uma das duas.

## 3. IA (opcional)

- `GEMINI_API_KEY` (Google AI Studio) e, como reserva, `GROQ_API_KEY`. Sem as chaves o cadastro usa o caminho manual e o chat usa o texto padrão.
- O modelo padrão é `gemini-flash-lite-latest`. Troque com `GEMINI_MODEL` se o nome mudar.

## 4. API (Render)

O arquivo `render.yaml` na raiz descreve o serviço. No Render, crie um "Blueprint" apontando para o repositório e preencha as variáveis marcadas como secretas:

| Variável | Valor |
|---|---|
| `DATABASE_URL` | string do Neon |
| `JWT_SECRET` | texto aleatório com 32 ou mais caracteres |
| `GOOGLE_CLIENT_ID` | ID do cliente OAuth |
| `ALLOWED_EMAIL_DOMAINS` | domínio da empresa |
| `FRONTEND_URL` | URL do frontend (aceita várias separadas por vírgula) |
| `GEMINI_API_KEY`, `GROQ_API_KEY` | opcionais |
| `ALLOWED_EMAILS`, `JWT_EXPIRES_IN`, `TRUST_PROXY` | opcionais: e-mails liberados fora do domínio, validade do JWT (padrão 8h) e número de proxies confiáveis (padrão 1 em produção) |

`NODE_ENV=production` já vem no `render.yaml`. Em produção a API recusa iniciar com `AUTH_DEV_LOGIN`, `E2E_TEST_MODE` ou `RATE_LIMIT_DISABLED` ativos, sem segredo forte, sem `GOOGLE_CLIENT_ID` ou sem banco. O serviço gratuito do Render hiberna sem uso, então o primeiro acesso depois de um tempo parado demora.

## 5. Frontend (Vercel ou Netlify)

- Diretório raiz: `frontend`. Comando de build: `npm run build`. Saída: `dist`.
- Variáveis: `VITE_API_URL` (URL da API com `/api/v1`) e `VITE_GOOGLE_CLIENT_ID`.
- As rotas do app são do navegador; `frontend/vercel.json` e `frontend/public/_redirects` já redirecionam qualquer caminho para o `index.html`.

## Conferência

1. `GET <API>/health` responde `{"status":"ok"}`.
2. Abra o frontend, entre com uma conta liberada e conclua o cadastro.
3. Entre com uma conta fora da lista e confira a mensagem "Seu e-mail ainda não está liberado".
