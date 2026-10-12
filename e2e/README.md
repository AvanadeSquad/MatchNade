# Testes de ponta a ponta (Playwright)

Testam o app como uma pessoa usaria, no navegador. Ficam nesta pasta, com `package.json` proprio, separados do backend e do frontend.

## Instalar

Requer Node 18 ou superior.

```
cd e2e
npm install
npx playwright install chromium
```

Copie `.env.example` para `.env` e ajuste as URLs se necessario. As variaveis tambem podem ser passadas pelo terminal.

## Rodar

```
npm test              # roda tudo, em segundo plano
npm run test:ui       # modo interativo, bom para escrever e depurar
npm run test:headed   # mostra o navegador
npm run report        # abre o relatorio da ultima execucao
```

Os testes rodam em dois tamanhos de tela: `celular` (390x844, igual as telas do design) e `desktop`. Para rodar so um: `npx playwright test --project=celular`.

## O que ha aqui

- `playwright.config.js`: configuracao (URLs, tamanhos de tela, relatorio, captura de falhas).
- `tests/api/health.spec.js`: confere se a API responde. So roda com `E2E_API_URL` definida.
- `tests/fluxos-criticos.spec.js`: roteiro dos 4 fluxos principais, marcados como `fixme` ate as telas existirem.
- `tests/helpers/auth.js`: login de teste, sem passar pelo Google.

## Login nos testes

O Google bloqueia login automatizado. Por isso o backend precisa de um endpoint de teste, ativo somente quando `E2E_TEST_MODE=true`:

```
POST /api/v1/test/login   { "email": "ana.silva@exemplo.test" }   ->   { "token": "..." }
```

Esse endpoint ainda nao existe. Nunca deve estar disponivel em producao.

## Escrever um teste

1. Trocar `test.fixme` por `test` no fluxo que ficou pronto.
2. Preencher os seletores (preferir `getByRole` e `getByText`, que dependem menos da estrutura do HTML).
3. Para fluxos com duas pessoas, usar dois contextos de navegador, como no teste de match mutuo.

## Boas praticas

- Poucos testes de ponta a ponta, so para os fluxos principais. Regras de negocio (cota, bloqueio, permissao do chat) ficam melhor em testes de API no backend: sao mais rapidos e estaveis.
- Dados de teste ficticios, nunca dados reais.
