# IA: o que acontece quando a cota do provedor acaba

Cartão E7-05. Este documento descreve o comportamento do backend quando o plano gratuito do provedor de IA esgota a cota (resposta `429`) ou fica indisponível. O que está coberto por teste automatizado vem separado do que só pode ser confirmado com chave real.

## Cadeia de decisão

Para cada chamada, `backend/src/ai` percorre os provedores configurados (Gemini principal, Groq reserva):

1. Provedor com disjuntor aberto é pulado.
2. A chamada tem timeout de 2,5 s (`AI_TIMEOUT_MS`).
3. Em `429`, erro `5xx` ou timeout, há uma nova tentativa após 0,5 s. `400` e `401` não são repetidos.
4. Se a tentativa falha, o provedor seguinte é usado.
5. Três falhas em 60 s abrem o disjuntor do provedor; um sucesso zera o histórico.
6. O prazo total é 8 s (`AI_SLA_MS`). Estourado ou sem provedor, o caminho manual entra.

## Resultado para a pessoa

| Situação | Extração de tags | Quebra-gelo |
|---|---|---|
| Cota esgotada no principal | Usa a reserva | Usa a reserva |
| Cota esgotada nos dois | Sem tags sugeridas; a pessoa escolhe as tags à mão | Texto padrão, com `fallback: true`, sem guardar |
| Resposta fora do esquema ou frase que cita cargo ou dado sensível | Sem sugestão | Texto padrão |
| Sem provedor configurado | Caminho manual direto | Texto padrão |

A IA nunca derruba a rota: o cadastro e a conexão continuam funcionando sem ela. O texto padrão não é guardado, então a próxima chamada tenta a IA de novo. O `ai_interaction_log` registra o status (`OK`, `ERRO`, `FORA_DO_SCHEMA` ou `REJEITADO`), o tempo e a versão do prompt, sem a bio.

## O que está coberto por teste

| Comportamento | Teste |
|---|---|
| `429` e `5xx` são repetíveis; `400` e `401` não | `backend/test/provedores.test.js` |
| Nova tentativa devolve o sucesso; erro não repetível passa ao próximo provedor | `backend/test/ia.test.js` |
| Timeout corta a chamada | `backend/test/ia.test.js` |
| Disjuntor abre após 3 falhas e fecha quando expiram | `backend/test/ia.test.js` |
| Provedor com disjuntor aberto é pulado | `backend/test/ia.test.js` |
| Sem provedor, vai direto ao caminho manual | `backend/test/ia.test.js` |
| IA que falha nunca lança erro | `backend/test/ia.test.js` |
| Frase fora das regras vira texto padrão | `backend/test/ia.test.js`, `backend/test/ia-prompts.test.js` |

## O que só vale com chave real

- O limite de requisições por minuto e por dia do plano gratuito de cada provedor muda com o tempo; confira na página do provedor antes de afirmar um número.
- A mensagem exata do `429` real e o cabeçalho de espera (`Retry-After`) não foram observados contra o serviço.
- O tempo da reserva sob carga real. A mediana medida do Gemini Flash-Lite foi 1,1 s em 20 bios (`npm run avaliar-ia`).

Para confirmar com a chave real, rode `npm run avaliar-ia` com `GEMINI_API_KEY` e repita em sequência até o provedor responder `429`; o esperado é a reserva assumir e, com os dois esgotados, o status `ERRO` no log e o texto padrão na tela.
