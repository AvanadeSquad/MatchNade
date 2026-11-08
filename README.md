# Avanade Connect

Plataforma interna para colaboradores da Avanade se conhecerem por interesses profissionais e pessoais. Cada pessoa descreve o que faz e do que gosta, escolhe ao menos 3 interesses, e recebe sugestões ordenadas por afinidade. Quando as duas demonstram interesse, vira match e o chat abre, com uma sugestão de abertura gerada por IA.

Cargo e senioridade nunca entram na escolha: não filtram, não pontuam e não aparecem no cartão. Só aparecem no perfil depois do match.

## Estrutura

```
backend/    API em Node.js + Express + PostgreSQL (PGlite em desenvolvimento)
frontend/   App React + Vite, pensado para desktop e responsivo para celular
e2e/        Testes de ponta a ponta com Playwright
docs/       API, arquitetura, publicação e referência de design
```

## Rodar localmente

Requer Node.js 20 ou superior. No PowerShell, a partir da raiz do repositório:

```powershell
# terminal 1: API em http://localhost:3000
cd backend
npm install
Copy-Item .env.example .env
npm run dev

# terminal 2: app em http://localhost:5173
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Sem banco nem chaves: a API usa PGlite com 30 pessoas fictícias, e a tela de login oferece uma lista para entrar sem senha (`AUTH_DEV_LOGIN=true` no `.env.example`). Entre como Ana Silva para ver o app com conexões de exemplo, como outra pessoa para ver a descoberta, ou informe um e-mail que ainda não exista para passar pelo cadastro do início.

A tela de login aceita conta com e-mail e senha, criada no próprio app, e o login corporativo com a Microsoft (Entra ID, ativo quando o aplicativo é registrado). A conta com senha tem recuperação por pergunta de segurança. As rotas, as respostas e o bloqueio por tentativas estão em [`docs/api.md`](docs/api.md), e há um exemplo de cada requisição em [`docs/exemplos-api.http`](docs/exemplos-api.http).

### Contas de demonstração (apenas desenvolvimento local)

Ao iniciar o backend com um banco **vazio**, o seed cria 30 contas fictícias com senha:

- **E-mail:** `ana.silva@exemplo.test` (ou qualquer outra conta fictícia `@exemplo.test` criada pelo seed)
- **Senha:** `1234567890`

A senha é **pública de propósito**, válida somente para essas contas de demonstração. Os hashes são criados no banco local com scrypt e salt individual; não são senhas reais nem devem ser usadas em produção. **Não publique bancos de dados, `.env` ou contas pessoais no GitHub.**

Cada pessoa que clonar o repositório terá seu próprio PGlite local. O GitHub compartilha o código que cria os usuários fictícios, não os registros reais do seu computador. Se o banco já tiver dados, o seed não os altera; para receber os usuários fictícios, use um **banco de desenvolvimento vazio separado**, sem apagar o banco existente.


## Testes

```powershell
cd backend;     npm test               # regras de negócio e API (PGlite em memória)
cd ..\frontend; npm test; npm run build   # testes dos componentes e confere que o app compila
cd ..\e2e;      npm install; npx playwright install chromium; npm test   # navegador, desktop e celular
```

Os testes de ponta a ponta sobem a API e o app sozinhos em portas próprias (3100 e 5174).

## Documentação

- [`docs/api.md`](docs/api.md): rotas, erros e estados de uma conexão.
- [`docs/arquitetura.md`](docs/arquitetura.md): decisões, regras que o código garante, IA e dados.
- [`docs/deploy.md`](docs/deploy.md): publicação gratuita (Neon, Render, Vercel ou Netlify).
- [`docs/design/`](docs/design/README.md): telas e tokens de referência.
- [`docs/desenho-exclusao-e-personalizacao.md`](docs/desenho-exclusao-e-personalizacao.md): desenho da exclusão de conta e da personalização de perfil (ainda não implementado).
- [`docs/evolucao.md`](docs/evolucao.md): o que ainda não foi exercitado e o que pode evoluir.
- [`CONTRIBUTING.md`](CONTRIBUTING.md): fluxo de branches, commits e convenções.
