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

Sem banco nem chaves: a API usa PGlite com 30 pessoas fictícias, e a tela de login oferece uma lista para entrar sem Google (`AUTH_DEV_LOGIN=true` no `.env.example`). Entre como Ana Silva para ver o app com conexões de exemplo, como outra pessoa para ver a descoberta, ou escolha "Novo cadastro" e informe um e-mail para passar pelo cadastro do início.

## Testes

```powershell
cd backend;     npm test               # regras de negócio e API (PGlite em memória)
cd ..\frontend; npm run build          # confere que o app compila
cd ..\e2e;      npm install; npx playwright install chromium; npm test   # navegador, desktop e celular
```

Os testes de ponta a ponta sobem a API e o app sozinhos em portas próprias (3100 e 5174).

## Documentação

- [`docs/api.md`](docs/api.md): rotas, erros e estados de uma conexão.
- [`docs/arquitetura.md`](docs/arquitetura.md): decisões, regras que o código garante, IA e dados.
- [`docs/deploy.md`](docs/deploy.md): publicação gratuita (Neon, Render, Vercel ou Netlify).
- [`docs/design/`](docs/design/README.md): telas e tokens de referência.
- [`docs/evolucao.md`](docs/evolucao.md): o que ainda não foi exercitado e o que pode evoluir.
- [`CONTRIBUTING.md`](CONTRIBUTING.md): fluxo de branches, commits e convenções.
