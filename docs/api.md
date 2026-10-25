# API

Prefixo `/api/v1`. Todas as rotas, exceto `/health`, `/health/ready`, o login e as rotas de desenvolvimento e teste, exigem `Authorization: Bearer <jwt>`. Erros seguem o formato:

```json
{ "code": "TEXTO_CURTO", "message": "explicação para a pessoa" }
```

Dados inválidos devolvem `400 DADOS_INVALIDOS` com `details` (campo e problema). Sessão inválida ou expirada devolve `401 NAO_AUTENTICADO`. JSON malformado devolve `400 CORPO_INVALIDO`, rota inexistente `404 NAO_ENCONTRADO` e erro inesperado `500 ERRO_INTERNO`.

Limites de requisição: 600 por 15 minutos por IP em toda a API (exceto `/health/ready`) e 30 por 15 minutos nas rotas de login. Acima do limite a resposta é `429`.

## Sessão

| Método e rota | Função | Resposta | Erros |
|---|---|---|---|
| `GET /health` | Verifica se o serviço está de pé. | `200 { "status": "ok" }` | |
| `GET /health/ready` | Verifica se o banco atende. O resultado fica guardado por alguns segundos, e a rota não conta no limite de requisições. | `200 { "status": "ok", "banco": "ok" }` | `503 { "status": "indisponivel", "banco": "erro" }` |
| `POST /auth/google` | Valida o ID token do Google, cria a pessoa no primeiro acesso e devolve o JWT (8 h). Corpo: `{ "credential" }`. | `200 { token, employee, is_new }` | `401 NAO_AUTENTICADO` token inválido, `403 EMAIL_NAO_LIBERADO`, `409 CONTA_INATIVA`, `503 GOOGLE_NAO_CONFIGURADO` |

Só em desenvolvimento e testes (a API recusa iniciar em produção com estas flags):

| Rota | Flag | Função |
|---|---|---|
| `GET /auth/dev-users`, `POST /auth/dev-login` | `AUTH_DEV_LOGIN=true` | Lista pessoas e entra sem Google. |
| `POST /test/login` | `E2E_TEST_MODE=true` | Entra com qualquer e-mail (cria a pessoa se não existir). Usada pelos testes de ponta a ponta. |

## Perfil

| Método e rota | Função | Resposta | Erros |
|---|---|---|---|
| `GET /profile` | Perfil da pessoa logada, com tags, cota e `profile_complete`. | `200` | |
| `PUT /profile` | Atualiza `name`, `bio`, `position` (opcional), `department`, `location`, `connection_goals` e `max_weekly_matches` (1 a 5). | `200` perfil | `400` |
| `POST /profile/enrich-bio` | Extrai tags da bio com IA. Corpo: `{ "raw_bio" }`. Até 15 chamadas por hora por pessoa. | `200 { technical_tags, hobby_tags }`, ou com `fallback: true` e listas vazias se a IA falhar | `400 BIO_VAZIA` |
| `PUT /profile/interests` | Substitui os interesses. Corpo: `{ "interests": [{ name, category, source?, confidence? }] }`. | `200` perfil | `400 MENOS_DE_3_TAGS`, `400 TAG_INVALIDA` |
| `PATCH /profile/pause` | Pausa ou retoma a exposição. Corpo: `{ "is_paused" }`. | `200 { is_paused }` | |
| `DELETE /profile` | Exclui o perfil e tudo ligado a ele. | `204` | |
| `GET /tags?category=TECHNICAL\|HOBBY` | Catálogo de tags, da mais usada para a menos usada. | `200 { tags }` | |
| `POST /tags` | Cria uma tag (ou devolve a existente, sem diferenciar maiúsculas). Cargos e termos genéricos são recusados. | `201` | `400 TAG_INVALIDA` |

`connection_goals` aceita `NETWORKING`, `TROCA_DE_CONHECIMENTO`, `HOBBY`, `MENTORIA` e `CONHECER_GENTE`.

## Descoberta e conexões

| Método e rota | Função | Resposta | Erros |
|---|---|---|---|
| `GET /matches/recommendations?limit=5` | Pessoas por afinidade (máximo 20). Esconde quem já tem conexão, quem bloqueou, quem foi bloqueado, quem pausou e quem tem menos de 3 interesses. | `200 { recommendations }`; com a cota usada ou sem ninguém, lista vazia com `message` | `409 PERFIL_INCOMPLETO` |
| `POST /matches` | Demonstra interesse. Corpo: `{ "receiver_id" }`. Se a outra pessoa já tinha demonstrado, a conexão vira match. | `201 { status, match_id }`; match mútuo: `status: "ACCEPTED"` e `new: true` | `400 RECEIVER_INVALIDO`, `403 BLOQUEADO`, `403 COTA_ESGOTADA`, `409 JA_EXISTE`, `409 PERFIL_INCOMPLETO` |
| `PATCH /matches/:id` | Aceita ou recusa uma solicitação recebida. Corpo: `{ "action": "accept" \| "decline" }`. | `200 { match_id, status }` | `403 NAO_E_DESTINATARIO`, `403 BLOQUEADO`, `404`, `409 JA_RESPONDIDA` |
| `GET /matches?peek=true` | Conexões em três grupos: `recebidas`, `aguardando` e `confirmadas`. O cargo (`position`) só vem nas confirmadas. Cada consulta marca as confirmadas como vistas (some o selo `new`), exceto com `peek=true`. | `200` | |
| `GET /employees/:id` | Perfil de outra pessoa, com afinidade por eixo. `position` e `bio` só depois do match. | `200` | `404`, `409 PERFIL_INCOMPLETO` |

Estados de uma conexão:

| Estado | Quando | Próximos |
|---|---|---|
| `PENDING` | Uma pessoa demonstrou interesse e a outra ainda não respondeu. | `ACCEPTED`, `DECLINED`, `EXPIRED` |
| `ACCEPTED` | As duas demonstraram interesse, ou a solicitação foi aceita. O chat abre. | O chat fecha enquanto houver bloqueio e reabre com o desbloqueio. |
| `DECLINED` | A pessoa recusou. Ninguém vê. | Final. |
| `EXPIRED` | Pendente há mais de 14 dias. A pessoa que pediu pode refazer o pedido: a mesma conexão volta a `PENDING`. | `PENDING` |

A cota semanal conta as solicitações que a pessoa envia (de segunda a domingo, horário de Brasília). Aceitar uma solicitação recebida e o match mútuo por interesse cruzado não consomem a cota de quem aceita.

## Chat

| Método e rota | Função | Resposta | Erros |
|---|---|---|---|
| `GET /matches/:id/icebreaker` | Sugestão de abertura. Gerada uma vez e guardada. Se a IA falhar, devolve o texto padrão com `fallback: true`, sem guardar. Até 60 chamadas por hora por pessoa. | `200 { match_summary }` | `403 SEM_MATCH`, `404`, `429` |
| `GET /matches/:id/messages?after=<id>&limit=100` | Mensagens com id maior que `after`, em ordem (`limit` de 1 a 200). Usado no polling. | `200 { messages }` | `403 SEM_MATCH`, `403 BLOQUEADO`, `404` |
| `POST /matches/:id/messages` | Envia mensagem (até 1000 caracteres). Corpo: `{ "body" }`. | `201 { id, sender_id, body, created_at }` | `400 MENSAGEM_VAZIA`, `400 MENSAGEM_LONGA`, `403 SEM_MATCH`, `403 BLOQUEADO`, `404` |

## Segurança entre pessoas

| Método e rota | Função | Resposta | Erros |
|---|---|---|---|
| `POST /employees/:id/block` | Bloqueia. Some da descoberta e fecha o chat para as duas pessoas. | `204` | `400 ALVO_INVALIDO`, `404` |
| `DELETE /employees/:id/block` | Desbloqueia. Uma conexão aceita volta a ter o chat aberto. | `204` | |
| `GET /blocks` | Pessoas que você bloqueou. | `200 { blocked }` | |
| `POST /employees/:id/report` | Denuncia. Corpo: `{ "reason" }`. | `201` | `400 MOTIVO_OBRIGATORIO`, `400 ALVO_INVALIDO`, `404` |

## Exemplos

Extração de tags:

```http
POST /api/v1/profile/enrich-bio
{ "raw_bio": "Sou dev front há 3 anos, curto React e Node. Fora do trabalho jogo xadrez e corro de manhã." }

200 OK
{ "technical_tags": ["React", "Node.js"], "hobby_tags": ["Xadrez", "Corrida"] }
```

Recomendações:

```http
GET /api/v1/matches/recommendations?limit=2

200 OK
{ "recommendations": [
    { "employee_id": 42, "name": "Marina Costa", "department": "Tecnologia e Inovação",
      "city": "São Paulo", "affinity_score": 0.62, "shared_interests": ["Node.js", "Xadrez"] } ] }
```

Match mútuo:

```http
POST /api/v1/matches   { "receiver_id": 42 }

201 Created
{ "match_id": 287, "status": "ACCEPTED", "new": true }
```
