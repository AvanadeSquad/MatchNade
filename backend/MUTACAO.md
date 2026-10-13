# Teste de mutação

O Stryker altera o código de propósito (troca operadores, condições, valores e textos) e roda os testes para cada alteração. Se algum teste falha, o mutante "morreu". Se todos passam, ele "sobreviveu": existe um comportamento que nenhum teste verifica.

## Rodar

```powershell
npm run mutacao
```

Demora mais de uma hora, porque roda a suíte inteira para cada mutante, e por isso não roda no CI. O relatório fica em `reports/mutacao/index.html` (e `relatorio.json`), fora do controle de versão.

Para separar, por arquivo, os mutantes mortos por um teste dos que só estouraram o tempo:

```powershell
npm run mutacao:resumo
```

O script lê `reports/mutacao/relatorio.json` (ou o caminho passado como argumento) e imprime uma tabela com a pontuação do Stryker, a pontuação sem timeouts, e as contagens de mortos, timeouts, sobreviventes e sem cobertura. A tabela que o próprio Stryker imprime no fim da execução também tem a coluna `# timeout`.

Arquivos analisados (em `stryker.config.mjs`): `src/services/afinidade.js`, `src/utils/tags.js`, `src/services/semana.js`, `src/services/conexoes.js` e `src/services/chat.js`.

## Configuração e por quê

- **Executor de comando** (`npx vitest run`), não o `@stryker-mutator/vitest-runner`. Com a vitest 5 deste projeto, o executor próprio não ativa os mutantes: um mutante que esvazia `inicioDaSemana` aparece como sobrevivente, embora quebre o teste.
- **Limite de tempo de 30 s por teste, 2 workers por suíte e 2 suítes ao mesmo tempo.** Com o limite padrão de 5 s e mais concorrência, um teste lento estoura o tempo sob carga e o mutante é contado como detectado sem que nenhum teste tenha falhado. Nessa condição a pontuação sobe sem motivo: um mutante contado como detectado pode sobreviver quando aplicado à mão.

## Resultado

Execução completa com a configuração acima (cerca de 85 minutos):

| Arquivo | Pontuação | Detectados | Sobreviventes |
|---|---|---|---|
| afinidade.js | 87,2% | 41 | 6 |
| chat.js | 82,9% | 29 | 6 |
| conexoes.js | 89,5% | 179 | 21 |
| semana.js | 100% | 10 | 0 |
| tags.js | 97,2% | 140 | 4 |
| **Total** | **91,5%** | **399** | **37** |

**A pontuação pode estar superestimada.** "Detectados" soma os mutantes mortos por um teste e os que só estouraram o tempo (Timeout), e o Stryker conta os dois como detectados. A tabela acima não separa os dois grupos, e o relatório JSON dessa execução não está versionado. Um timeout pode ser um laço infinito criado pelo mutante, o que é uma detecção legítima, ou só lentidão sob carga, o que não é. Para conferir, rode `npm run mutacao` e depois `npm run mutacao:resumo`: a coluna "Sem timeouts" é o pior caso, contando todo timeout como não detectado. Se a diferença entre as duas colunas for grande num arquivo, aplique à mão alguns dos mutantes em Timeout (o relatório HTML mostra cada um) e veja se algum teste falha.

A tabela não inclui os dois últimos testes de `test/regras-de-borda.test.js` (selo "novo" e `mencionaHierarquia`), que matam mais dois mutantes: os dois falham quando o mutante correspondente é aplicado à mão.

## Mutantes cobertos por testes novos

`test/regras-de-borda.test.js` cobre mutantes que sobreviviam à suíte. Cada teste falha quando o mutante correspondente é aplicado à mão:

- aceitar uma solicitação com bloqueio em qualquer direção devolve 403 (sem esse teste, a checagem pode ser removida sem nenhum teste falhar);
- a recusa é permanente nas duas direções, e a solicitação expirada da outra pessoa não impede um novo interesse;
- a mensagem com exatamente 1000 caracteres é aceita;
- o quebra-gelo envia à IA os nomes dos interesses de cada pessoa;
- o selo "novo" aparece num match feito depois da última visita e some depois de ver a lista;
- cada termo genérico e ofensivo é recusado como tag, o padrão vale do primeiro ao último caractere, e o limite é de 40 caracteres;
- `mencionaHierarquia` reconhece "hierarquia", "chefe" e "subordinado".

## Sobreviventes que ficaram, e por quê

- **Textos das mensagens de erro trocados por vazio** (cerca de 20): os testes conferem o `code`, que é o contrato com o frontend, e não o texto.
- **Proteções que nunca disparam** em `calcularIdf` (`df > 0`, `totalPerfis > 0`): toda tag contada aparece em pelo menos um perfil.
- **Chave da trava consultiva** (`Math.min` e `Math.max` trocados): a serialização continua garantida pelo `FOR UPDATE` e pelo índice único do par, então os testes de corrida não distinguem.
- **Limite de 200 em `listarMensagens`**: a rota já recusa `limit` acima de 200 antes de chegar ao serviço.
- **Valor padrão de `marcarVisto`**: a rota sempre o passa explicitamente.
- **Detalhes de normalização** com o mesmo resultado (separar por `/[\s/&-]/` ou por `/[\s/&-]+/`, `toUpperCase` no lugar de `toLowerCase` em `unicas`).
