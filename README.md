# MatchNade

Projeto Avanade Connect: plataforma interna de conexao entre colaboradores.

## Estrutura

```
backend/        API em Node.js
  src/
    config/       configuracoes da aplicacao
    controllers/  logica de entrada das rotas
    routes/       definicao de rotas
    services/     regras de negocio
    models/       modelos de dados
    middlewares/  middlewares Express (ou equivalente)
    utils/        funcoes utilitarias
  test/         testes automatizados
frontend-web/   app React (a criar)
docs/           documentacao do projeto
```

## Como rodar o backend

```
cd backend
npm install
npm run dev
```

Copie `backend/.env.example` para `backend/.env` e ajuste os valores.
