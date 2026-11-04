# Teste de carga

Medição da API com o [autocannon](https://github.com/mcollina/autocannon), sem mudança no código de produção. Os números abaixo são de uma única máquina de desenvolvimento e **não representam produção**.

## Como rodar

Na pasta `backend`:

```bash
npm run carga                                   # PGlite, 30 perfis do seed
CARGA_PERFIS=1000 npm run carga                 # completa a base até 1.000 perfis
DATABASE_URL=postgresql://... CARGA_PERFIS=10000 npm run carga   # PostgreSQL vazio
```

O script `backend/carga/executar.js`:

1. Prepara o banco: aplica as migrações, roda o seed sem as conexões de demonstração e, se `CARGA_PERFIS` for maior que os 30 perfis do seed, insere perfis fictícios com 3 a 6 interesses cada, tirados do catálogo do seed. Sem `DATABASE_URL`, usa um PGlite numa pasta temporária, apagada no fim. Com `DATABASE_URL`, o banco deve estar vazio. O `npm run seed` e o seed de inicialização não mudam.
2. Sobe a API num processo próprio (porta `CARGA_PORTA`, padrão 3200) com `NODE_ENV=test`, `E2E_TEST_MODE=true` (para entrar por `/test/login`) e `RATE_LIMIT_DISABLED=true`.
3. Roda cada cenário por `CARGA_DURACAO` segundos (padrão 10), com as conexões de `CARGA_CONEXOES` (padrão `10,50`). Antes de cada cenário espera a API esvaziar a fila do anterior.
4. Imprime uma linha por cenário. Com `CARGA_SAIDA=arquivo.json`, grava também os resultados com data, máquina e banco. No fim, derruba a API.

Os percentis são calculados a partir do tempo de cada resposta. A taxa de erro soma respostas fora de 2xx, erros de conexão e timeouts (10 s).

## Cenários

| Cenário | O que faz |
|---|---|
| `GET /profile` | Perfil da pessoa logada (Ana Silva, do seed). Referência de uma rota leve. |
| `GET /matches/recommendations?limit=20` | Carrega a base de perfis e recalcula a afinidade com todos a cada chamada. Gargalo esperado. |
| `POST /matches` | Cada requisição usa um par diferente de remetente e destinatário, entre até 200 pessoas com cota semanal de 5. Quando a cota ou o par se esgotam, a API responde `403 COTA_ESGOTADA`, `409 JA_EXISTE` ou `400 RECEIVER_INVALIDO`. São recusas da regra de negócio, não falhas, mas entram na taxa de erro. |
| `GET /matches?peek=true` | Lista de conexões. Também carrega a base para calcular a afinidade de cada conexão. |
| `POST /auth/login` | Login com e-mail e senha de uma conta criada pelo script. Mede o custo do hash `scrypt`. |

## Ambiente da medição

- Data: 4 de novembro de 2026.
- Máquina: contêiner Linux com 4 vCPUs (Intel Xeon 2,10 GHz) e 16 GB de memória, Node.js 22.22.0. A API e o autocannon rodaram na mesma máquina e disputaram a CPU.
- Bancos: PGlite (padrão do desenvolvimento) e PostgreSQL 16.15 local, sem Docker, com a configuração padrão, na mesma máquina.
- O PGlite roda dentro do processo da API e atende uma consulta por vez. Os números dele mostram o limite do ambiente de desenvolvimento, não o de produção.

## Resultados

Requisições por segundo (rps), latência em milissegundos e taxa de erro, 10 s por cenário.

### PGlite

| Cenário | Perfis | Conexões | rps | p50 | p95 | p99 | Erro |
|---|---|---|---|---|---|---|---|
| GET /profile | 30 | 10 | 248 | 36 | 70 | 84 | 0% |
| GET /profile | 30 | 50 | 256 | 175 | 229 | 635 | 0% |
| GET /profile | 1.000 | 10 | 269 | 33 | 66 | 75 | 0% |
| GET /profile | 1.000 | 50 | 265 | 171 | 231 | 1.156 | 0% |
| GET /profile | 10.000 | 10 | 256 | 34 | 67 | 85 | 0% |
| GET /profile | 10.000 | 50 | 279 | 168 | 199 | 920 | 0% |
| GET /matches/recommendations | 30 | 10 | 167 | 54 | 105 | 122 | 0% |
| GET /matches/recommendations | 30 | 50 | 207 | 232 | 283 | 457 | 0% |
| GET /matches/recommendations | 1.000 | 10 | 41 | 220 | 429 | 483 | 0% |
| GET /matches/recommendations | 1.000 | 50 | 44 | 1.114 | 1.271 | 2.128 | 0% |
| GET /matches/recommendations | 10.000 | 10 | 5 | 1.630 | 3.228 | 3.455 | 0% |
| GET /matches/recommendations | 10.000 | 50 | 5 | 5.161 | 9.518 | 9.860 | 5,7% |
| POST /matches | 30 | 10 | 145 | 70 | 99 | 134 | 79,3% |
| POST /matches | 30 | 50 | 146 | 327 | 606 | 638 | 100% |
| POST /matches | 1.000 | 10 | 43 | 211 | 409 | 458 | 0% |
| POST /matches | 1.000 | 50 | 43 | 1.099 | 1.339 | 1.398 | 0% |
| POST /matches | 10.000 | 10 | 6 | 1.404 | 4.644 | 7.621 | 0% |
| POST /matches | 10.000 | 50 | 6 | 5.321 | 8.406 | 8.725 | 21,1% |
| GET /matches | 30 | 10 | 168 | 53 | 106 | 121 | 0% |
| GET /matches | 30 | 50 | 169 | 285 | 347 | 574 | 0% |
| GET /matches | 1.000 | 10 | 48 | 186 | 370 | 408 | 0% |
| GET /matches | 1.000 | 50 | 47 | 912 | 1.071 | 5.540 | 0,2% |
| GET /matches | 10.000 | 10 | 6 | 1.233 | 3.426 | 7.290 | 0% |
| GET /matches | 10.000 | 50 | 6 | 4.617 | 6.939 | 7.728 | 18,9% |
| POST /auth/login | 30 | 10 | 82 | 119 | 156 | 176 | 0% |
| POST /auth/login | 30 | 50 | 82 | 597 | 694 | 755 | 0% |
| POST /auth/login | 1.000 | 10 | 83 | 116 | 155 | 175 | 0% |
| POST /auth/login | 1.000 | 50 | 81 | 604 | 676 | 705 | 0% |
| POST /auth/login | 10.000 | 10 | 84 | 115 | 153 | 180 | 0% |
| POST /auth/login | 10.000 | 50 | 83 | 595 | 656 | 689 | 0% |

### PostgreSQL 16 local

| Cenário | Perfis | Conexões | rps | p50 | p95 | p99 | Erro |
|---|---|---|---|---|---|---|---|
| GET /profile | 30 | 10 | 1.059 | 9 | 14 | 17 | 0% |
| GET /profile | 30 | 50 | 1.187 | 41 | 61 | 87 | 0% |
| GET /profile | 1.000 | 10 | 1.028 | 9 | 14 | 19 | 0% |
| GET /profile | 1.000 | 50 | 1.194 | 41 | 56 | 72 | 0% |
| GET /profile | 10.000 | 10 | 1.074 | 9 | 14 | 17 | 0% |
| GET /profile | 10.000 | 50 | 1.145 | 44 | 58 | 66 | 0% |
| GET /matches/recommendations | 30 | 10 | 635 | 15 | 22 | 27 | 0% |
| GET /matches/recommendations | 30 | 50 | 852 | 57 | 73 | 82 | 0% |
| GET /matches/recommendations | 1.000 | 10 | 137 | 71 | 97 | 111 | 0% |
| GET /matches/recommendations | 1.000 | 50 | 194 | 252 | 293 | 339 | 0% |
| GET /matches/recommendations | 10.000 | 10 | 17 | 567 | 785 | 887 | 0% |
| GET /matches/recommendations | 10.000 | 50 | 15 | 2.881 | 3.566 | 3.698 | 0% |
| POST /matches | 30 | 10 | 771 | 12 | 19 | 26 | 96,1% |
| POST /matches | 30 | 50 | 748 | 64 | 92 | 101 | 100% |
| POST /matches | 1.000 | 10 | 203 | 47 | 72 | 84 | 50,9% |
| POST /matches | 1.000 | 50 | 191 | 254 | 320 | 341 | 100% |
| POST /matches | 10.000 | 10 | 28 | 338 | 521 | 589 | 0% |
| POST /matches | 10.000 | 50 | 24 | 1.697 | 2.405 | 2.414 | 0% |
| GET /matches | 30 | 10 | 872 | 11 | 17 | 22 | 0% |
| GET /matches | 30 | 50 | 890 | 54 | 72 | 84 | 0% |
| GET /matches | 1.000 | 10 | 208 | 45 | 71 | 89 | 0% |
| GET /matches | 1.000 | 50 | 185 | 265 | 317 | 381 | 0% |
| GET /matches | 10.000 | 10 | 28 | 339 | 440 | 614 | 0% |
| GET /matches | 10.000 | 50 | 25 | 1.764 | 2.379 | 2.382 | 0% |
| POST /auth/login | 30 | 10 | 91 | 109 | 128 | 141 | 0% |
| POST /auth/login | 30 | 50 | 91 | 548 | 583 | 596 | 0% |
| POST /auth/login | 1.000 | 10 | 87 | 114 | 137 | 146 | 0% |
| POST /auth/login | 1.000 | 50 | 87 | 568 | 609 | 624 | 0% |
| POST /auth/login | 10.000 | 10 | 91 | 108 | 127 | 136 | 0% |
| POST /auth/login | 10.000 | 50 | 88 | 564 | 604 | 621 | 0% |

Os erros de `POST /matches` com 30 e 1.000 perfis são recusas da regra de negócio: com poucas pessoas, os pares e a cota semanal (5 por pessoa) acabam em poucos segundos, e a API responde 403, 409 ou 400. Com 10.000 perfis a rota fica lenta o bastante para a cota não acabar durante o cenário. No PGlite com 10.000 perfis e 50 conexões, os erros de recomendações, `POST /matches` e `GET /matches` são timeouts de 10 s.

## Conclusões

- **Recomendações, `POST /matches` e `GET /matches` escalam com o número de perfis.** As três carregam a base inteira de perfis e interesses (`carregarBase`) e recalculam os pesos de raridade (`calcularIdf`) a cada chamada. A vazão cai quase na proporção do volume: no PostgreSQL, as recomendações saem de 635 rps com 30 perfis para 137 com 1.000 e 17 com 10.000 (10 conexões).
- **Com 1.000 perfis, o p95 das recomendações passa de 1 s só no PGlite com 50 conexões** (1.271 ms). No PostgreSQL ficou em 97 ms (10 conexões) e 293 ms (50 conexões). Com 10.000 perfis passa de 1 s nos dois bancos com 50 conexões e fica em 785 ms no PostgreSQL com 10 conexões.
- **O login é limitado pelo `scrypt`.** Fica em cerca de 85 rps em qualquer volume e banco, com p50 de 110 ms. Com 50 conexões a latência só cresce, porque o hash ocupa a CPU. Isso é esperado e desejável contra tentativa de senha por força bruta, e o limite de 30 requisições por IP em 15 minutos fica muito abaixo disso.
- **`GET /profile` não depende do volume:** cerca de 1.100 rps no PostgreSQL e 260 rps no PGlite.
- **O PGlite é o limite do desenvolvimento:** atende uma consulta por vez e fica de 4 a 5 vezes mais lento que o PostgreSQL local nas rotas leves.

## Proposta de otimização (não implementada)

Como o p95 das recomendações passou de 1 s com 1.000 perfis no PGlite com 50 conexões, e com 10.000 perfis nos dois bancos com 50 conexões:

1. **Cache da base e dos pesos de raridade.** Guardar em memória o resultado de `carregarBase` (perfis, nomes das tags e IDF) com validade curta (por exemplo 30 a 60 s) e invalidar quando alguém salvar interesses, pausar, excluir o perfil ou mudar de unidade. Recomendações, `POST /matches` e `GET /matches` passam a reaproveitar a mesma base, e o cálculo por pedido vira só a afinidade da pessoa com cada perfil. Com várias instâncias, o cache é por instância, e a validade curta limita a diferença entre elas.
2. **Calcular a afinidade só para quem precisa.** Em `POST /matches` e `GET /matches`, a afinidade é necessária só para os perfis envolvidos (o destinatário e as conexões da pessoa). Os IDF podem vir do cache, sem varrer todos os perfis.
3. **Pré-filtrar candidatos no banco.** Para as recomendações, buscar primeiro os perfis que têm ao menos um interesse em comum, com um índice em `employee_interest (interest_id)` (já existe), e calcular a afinidade só sobre esse conjunto.

Qualquer uma dessas mudanças deve manter as regras: cargo e senioridade fora do cálculo, só perfis com 3 ou mais interesses e sem pessoas pausadas ou bloqueadas.
