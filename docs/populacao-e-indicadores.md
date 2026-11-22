# População fictícia e indicadores

Duas ferramentas de apoio para demonstração, carga e análise. Nenhuma altera o código de produção.

## Popular a base com pessoas fictícias

Na pasta `backend`:

```bash
npm run popular -- --perfis 1000                    # 1.000 pessoas com histórico
npm run popular -- --perfis 5000 --semente 7        # outra semente gera outra população
npm run popular -- --perfis 2000 --sem-historico    # só pessoas e interesses
```

O comando usa o banco de `DATABASE_URL` (PostgreSQL) ou de `PGLITE_DATA_DIR` (PGlite em pasta). Sem nenhum dos dois, o PGlite é em memória e some ao fim do comando.

### O que é gerado

Cada pessoa tem cadastro completo, igual ao que o produto exige:

| Campo | Como é gerado |
|---|---|
| Nome e e-mail | Combinação de 60 nomes e 60 sobrenomes; acima de 3.600 pessoas entra uma inicial do meio. E-mail único `@exemplo.test`. |
| Trilha, cargo e unidade | 8 trilhas (dados, nuvem, web, design, produto, segurança, ERP e CRM, qualidade e mobile) com pesos diferentes. 80% ficam na unidade da trilha. |
| Cidade | 8 cidades com peso (São Paulo 30%, Recife 16%, entre outras). |
| Interesses técnicos | 3 a 5 da trilha, mais 1 a 2 de outra trilha em 30% dos casos. Popularidade decrescente dentro da trilha. |
| Hobbies | 1 a 2 típicos da trilha e 1 a 3 do catálogo geral, também por popularidade. |
| Bio | Texto montado a partir dos interesses da pessoa. |
| Objetivos, cota semanal | 1 a 3 objetivos; cota de 2 a 5. |
| Personalização | Pronomes (35%), avatar (45%), visibilidade só da unidade (8%), horários de café preferidos (40%). |
| Conta | 4% pausadas, senha e pergunta de segurança preenchidas. A senha comum é pública e só serve para demonstração. |

O catálogo resultante tem 168 tags. A popularidade segue uma curva de potência: poucas tags aparecem em muita gente e há uma cauda de tags raras, que é o cenário em que o peso de raridade da afinidade faz diferença.

### Histórico (a menos que use `--sem-historico`)

- **Conexões** com desfecho sorteado (34% aceitas, 28% pendentes, 20% recusadas, 18% expiradas) e datas coerentes com as regras: pendente com menos de 14 dias, expirada com mais de 14 e sem resposta, aceita e recusada com `responded_at` depois do pedido.
- Respeita pares únicos, cota semanal do remetente, pessoa pausada e visibilidade só da unidade. O `match_score` é calculado com a fórmula real de afinidade.
- **Mensagens** só nas conexões aceitas, com convites e aceites de Coffee Chat no formato que a tela entende.
- **Bloqueios e denúncias** em pequena quantidade.

### O que não é gerado, de propósito

- Nenhuma linha em `ai_interaction_log` e nenhum interesse com origem `AI`. Os indicadores de IA só mostram o que a IA de fato fez; inventar esses números enganaria quem os lê.
- O desfecho das conexões é sorteado e **não depende da afinidade**. Por isso, num banco populado, a afinidade média das conexões aceitas e das recusadas sai igual. Esse indicador só tem leitura real com uso real.

### Salvaguardas

- Recusa `NODE_ENV=production`.
- Recusa banco que tenha qualquer pessoa com e-mail fora de `@exemplo.test`, sem alterar nada.
- Pode rodar de novo sobre uma base já populada: continua a numeração de nomes e evita e-mails repetidos.
- Determinístico: a mesma semente e o mesmo número de perfis geram as mesmas pessoas (as datas são relativas ao momento da execução).

### Tempo medido (PGlite, notebook de desenvolvimento)

| Perfis | Interesses | Conexões | Mensagens | Tempo |
|---|---|---|---|---|
| 1.000 | 7.954 | 1.285 | 2.358 | 0,9 s |
| 5.000 | 39.390 | 6.205 | 10.529 | 4,7 s |

## Indicadores

```bash
npm run metricas                                          # imprime o relatório em Markdown
npm run metricas -- --saida indicadores.md --desempenho   # grava em arquivo e mede as rotas
npm run metricas -- --json                                # mesmos dados em JSON
npm run metricas -- --amostra 500                         # pessoas usadas na análise de afinidade (padrão 200)
```

É somente leitura e não inclui nome, e-mail nem texto de ninguém: só contagens, proporções e tempos. Um teste automatizado confere isso.

| Bloco | O que mostra | De onde vem |
|---|---|---|
| Base | Pessoas ativas e vistas nos últimos 7 e 30 dias; completude (bio, 3 ou mais interesses, avatar, pronomes, horários); interesses por pessoa; origem dos interesses (manual ou IA) | `employee`, `employee_interest` |
| Catálogo | Tags no catálogo e em uso, tags de uma pessoa só, mais e menos usadas | `interest_tag` |
| Distribuição | Unidades, cidades e objetivos de conexão | `employee` |
| Afinidade | Em uma amostra de pessoas contra todas as outras: pares sem interesse em comum, histograma por faixa, afinidade da melhor e da 20ª sugestão, quanto do top 20 cruza unidades | Fórmula de produção (`calcularAfinidade`) |
| Conexões | Funil por status, taxa de aceite, tempo de resposta (mediana e p90), mensagens por conexão aceita, Coffee Chat | `connection_match`, `chat_message` |
| Privacidade e moderação | Pausadas, visibilidade só da unidade, exclusões pedidas, bloqueios, denúncias | `employee`, `employee_block`, `employee_report` |
| IA | Chamadas por tipo, versão, modelo e status, com p50 e p95 de latência. Vazio se a IA nunca foi chamada | `ai_interaction_log` |
| Banco | Linhas por tabela | contagens |
| Desempenho (`--desempenho`) | Mediana e p90 das rotas que carregam a base, medidas no processo, sem rede | serviços da API |

### Resultado numa base de 5.000 pessoas (PGlite)

Amostra de 200 pessoas, 960.400 pares avaliados:

| Indicador | Valor |
|---|---|
| Pares sem nenhum interesse em comum | 55,3% |
| Afinidade da melhor sugestão (mediana) | 55,6% |
| Afinidade da 20ª sugestão (mediana) | 37,8% |
| Pares com afinidade que cruzam unidades | 75,5% |
| Top 20 que cruza unidades | 49,6% |
| Faixa com mais pares | 10% a 20% (263.467 pares) |
| Pares acima de 60% | 128 de 960.400 |

Desempenho medido no processo, sem rede, 20 repetições: recomendações 338 ms (p90 372), lista de conexões 283 ms (p90 321), perfil de outra pessoa 296 ms (p90 375).

Como ler: a maior parte dos pares tem pouca coisa em comum e poucos passam de 60%, então a cauda alta é onde o filtro de sinergia mínima mais corta. O percentual do top 20 que cruza unidades mostra o efeito do bônus para unidades diferentes sem que o ranking vire só "gente de outras áreas".
