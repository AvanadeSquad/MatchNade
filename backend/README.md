# Backend

API REST em Node.js 20+ com Express 5. Os dados ficam em PostgreSQL; sem `DATABASE_URL` a API usa PGlite (PostgreSQL em processo), então roda sem instalar nada.

## Rodar

No PowerShell, a partir da raiz do repositório:

```powershell
cd backend
npm install
Copy-Item .env.example .env
npm run dev
```

A API sobe em http://localhost:3000/api/v1 já com 30 pessoas fictícias. Com `AUTH_DEV_LOGIN=true` (padrão do `.env.example`) a tela de login mostra uma lista de pessoas para entrar sem Google.

## Avaliação da IA

```powershell
npm run avaliar-ia
```

Roda a extração de tags nas 20 bios fictícias de `avaliacao/bios.json`, que incluem bios com cargo (em português, em inglês e em sigla), duas tentativas de injeção de prompt, uma bio vazia e duas genéricas. Mede:

- **Precisão:** das tags devolvidas, quantas eram esperadas.
- **Cobertura:** das tags esperadas, quantas foram devolvidas.
- **Respostas com cargo:** meta zero. O script termina com erro se houver alguma.
- **Respostas que obedeceram a texto injetado:** tags que só existem no trecho injetado.

Sem chaves, usa um provedor simulado (`avaliacao/provedor-simulado.js`): um extrator ingênuo por palavras conhecidas que devolve também cargos e o texto injetado, para medir o que a normalização e os filtros seguram. Com `GEMINI_API_KEY` ou `GROQ_API_KEY` definidas, usa os provedores reais. As chaves nunca são impressas.

Números com o provedor simulado:

| Medida | Valor |
|---|---|
| Precisão | 98,4% |
| Cobertura | 96,8% |
| Respostas com cargo | 0 |
| Respostas que obedeceram a texto injetado | 1 |

Esses números medem o fluxo de normalização, não a qualidade de um modelo. As metas reais de precisão e cobertura só podem ser medidas com chaves. Os pontos que o simulado expõe:

- **Injeção:** a tag injetada "Hackeado" é uma palavra válida, então só o modelo pode recusá-la. Nenhum filtro posterior a distingue de um interesse real.
- **`.NET`:** a normalização exige que a tag comece com letra ou número, então `.NET` é descartada.
- **Vocabulário:** "marcenaria" falta porque o simulado não a conhece.

## Testes

```powershell
npm test
```

Os testes usam PGlite em memória e cobrem afinidade, IA (timeout, nova tentativa, disjuntor, saída inválida), autenticação, perfil, conexões, chat, bloqueio e as regras de cota e expiração.

## Estrutura

```
avaliacao/         bios fictícias e script de avaliação da extração de tags
src/
  app.js           monta o Express (segurança, CORS, limite de requisições, rotas)
  index.js         inicia banco, dados de exemplo e servidor
  config/env.js    leitura e validação das variáveis de ambiente
  db/              schema.sql, conexão (pg ou PGlite) e dados de exemplo
  routes/          rotas HTTP e validação das entradas (zod)
  services/        regras de negócio (afinidade, conexões, chat, bloqueios, perfil)
  ai/              provedores (Gemini, Groq), prompts, disjuntor e serviço de IA
  middlewares/     autenticação e tratamento de erros
test/              testes com vitest e supertest
```

## Regras que o código garante

- Cargo e senioridade nunca entram no cálculo de afinidade, nas recomendações, nas tags nem no texto da IA. O cargo só é devolvido nas conexões confirmadas e no perfil da pessoa depois do match.
- Mínimo de 3 interesses por perfil.
- Match só existe com interesse dos dois lados. O chat e o quebra-gelo só abrem para conexões aceitas e sem bloqueio.
- Cota semanal de solicitações (padrão 3, de 1 a 5), contada de segunda a domingo no horário de Brasília.
- Solicitações pendentes há mais de 14 dias expiram. Quem pediu pode pedir de novo.
- Uma recusa é permanente: se alguém tentar demonstrar interesse de novo em quem recusou, ou em quem foi recusado, a API devolve `409 JA_EXISTE`.
- A IA nunca bloqueia o fluxo: timeout de 2,5 s, uma nova tentativa após 500 ms, disjuntor (3 falhas em 60 s), prazo total de 8 s (dá tempo de o provedor reserva responder) e fallback para tags manuais e texto padrão.

## Variáveis de ambiente

Veja `.env.example`. Em produção a API recusa iniciar sem `JWT_SECRET` forte, `DATABASE_URL`, `GOOGLE_CLIENT_ID` e lista de e-mails liberados, e recusa `AUTH_DEV_LOGIN` e `E2E_TEST_MODE`.

A API completa está em `docs/api.md`.
