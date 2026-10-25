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
- Os cabeçalhos de segurança, com a política de conteúdo (CSP), ficam em `frontend/vercel.json` (Vercel) e `frontend/public/_headers` (Netlify), com a mesma política nos dois. A CSP só deixa o app chamar o próprio site, o login do Google e `https://*.onrender.com`. Se a API for publicada em outro domínio, acrescente-o a `connect-src` **nos dois arquivos**; sem isso, o navegador bloqueia as chamadas à API. `npm run test:cabecalhos` confere que os dois continuam iguais.

## Conferência

1. `GET <API>/health` responde `{"status":"ok"}`.
2. Abra o frontend, entre com uma conta liberada e conclua o cadastro.
3. Entre com uma conta fora da lista e confira a mensagem "Seu e-mail ainda não está liberado".

## Depois de mesclar

Estado do repositório e o que conferir nas configurações, que não são feitas por código:

1. **Canal de vulnerabilidades:** o repositório é público. O canal é o reporte privado do GitHub (aba **Security**, **Report a vulnerability**), como diz o `SECURITY.md`; confira em Settings, Code security, se "Private vulnerability reporting" está ativo.
2. **Dependabot:** os alertas estão ativos e o `.github/dependabot.yml` propõe atualizações semanais para backend, frontend, testes de ponta a ponta e GitHub Actions.
3. **CodeQL:** `.github/workflows/codeql.yml` roda em todo pull request, em todo push em `main` e `develop` e toda semana, com o job "Análise do JavaScript". O job só roda com a variável de repositório `CODEQL_ATIVO` igual a `true`; se ela for removida, o job fica pulado.
4. **Proteção das branches:** `main` e `develop` só recebem mudanças por pull request, com 1 aprovação e conversas resolvidas. Na `develop`, os checks do CI precisam passar, inclusive "Análise do JavaScript". A lista dos checks está no `CONTRIBUTING.md`.
5. **Variáveis dos serviços:** confirme no Render as variáveis da seção 4 e no Vercel ou Netlify as da seção 5.
6. **Referências visuais:** as imagens de `e2e/tests/visual.spec.js-snapshots/` são geradas no ambiente do CI. Quando uma tela muda de propósito, atualize as referências pelo passo a passo do `e2e/README.md`.
