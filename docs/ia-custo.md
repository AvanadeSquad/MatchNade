# IA: custo e viabilidade econômica

Estimativa de 27/11/2026 para a Entrega Final (item 2.2). Os tokens foram **medidos** em chamadas reais; o custo é uma **estimativa** com o preço oficial de 27/11/2026, que pode mudar.

## Tokens por chamada (medidos)

Seis chamadas reais ao Gemini com os prompts em uso (`extracao-v3` com o catálogo de 150 tags e `quebra-gelo-v2`). O apelido `gemini-flash-lite-latest` respondeu como `gemini-3.5-flash-lite`. O campo `usageMetadata` da resposta traz as contagens.

| Chamada | Tokens de entrada | Tokens de saída |
|---|---|---|
| Extração de tags (3 bios) | 1.193 a 1.204 | 49 a 66 |
| Quebra-gelo (3 conversas) | 416 a 424 | 33 a 38 |
| Embeddings (uma vez por tag) | 2 a 5 por nome | n/a |
| Recomendação e afinidade | 0 (não usam IA) | 0 |

## Preço (fonte: ai.google.dev/gemini-api/docs/pricing, 27/11/2026)

- Gemini 3.5 Flash-Lite, plano pago: US$ 0,30 por milhão de tokens de entrada e US$ 2,50 por milhão de saída. Plano gratuito: sem custo, **com os dados usados para melhorar os produtos do Google**; no plano pago, não.
- Embeddings do Gemini (texto): US$ 0,20 por milhão de tokens (preço do `gemini-embedding-2`, o único modelo de embeddings listado na página em 27/11/2026; o `gemini-embedding-001` usado aqui não aparece nela, então o valor é uma referência).
- Groq (reserva): preço não consultado; a reserva só é chamada quando o Gemini falha.

## Custo estimado

| Item | Conta | Resultado |
|---|---|---|
| Uma extração | 1.200 × US$ 0,30/M + 60 × US$ 2,50/M | cerca de US$ 0,0005 |
| Um quebra-gelo | 420 × US$ 0,30/M + 35 × US$ 2,50/M | cerca de US$ 0,0002 |
| Pessoa em uso típico por mês (1 extração e 5 quebra-gelos) | | cerca de US$ 0,0016 |
| Pessoa em uso intenso por mês (3 extrações e 20 quebra-gelos) | | cerca de US$ 0,006 |
| 10.000 pessoas por mês | típico a intenso | US$ 16 a US$ 58 |
| Embeddings das 168 tags do catálogo de teste (uma vez) | cerca de 500 tokens × US$ 0,20/M | menos de US$ 0,001 |

Os limites do produto reforçam o teto: a cota de conexões é de até 5 pedidos por semana e cada pessoa tem limite por hora nas chamadas de IA (15 extrações e 60 quebra-gelos por hora).

## Trade-offs de custo e qualidade

1. **Modelo Flash-Lite em vez de modelos maiores:** os maiores não responderam dentro de 2,5 s e 300 tokens (revisão de 18/11/2026); a qualidade medida (88% de precisão) é suficiente porque a pessoa revisa as tags.
2. **Catálogo de tags no prompt:** custa cerca de 600 tokens a mais por extração (estimativa pelo tamanho do texto, não medida; cerca de metade da entrada), mas alinha a grafia e protege a afinidade. É o maior item do custo de extração e ainda assim fica abaixo de US$ 0,001.
3. **Afinidade sem IA:** cada recomendação custa zero e é instantânea; usar um LLM para ranquear 20 colegas por consulta multiplicaria custo e latência sem ganho de explicabilidade.
4. **Quebra-gelo guardado:** a frase gerada é guardada na conexão, então cada match gera uma chamada, e não uma por abertura do chat. A frase padrão (quando a IA falha) não é guardada, de modo que a IA é consultada de novo quando volta.

## Viabilidade em escala

- **Custo:** em dezenas de dólares por mês para 10.000 pessoas, a IA não é o gargalo econômico.
- **Cota:** o plano gratuito tem limite de requisições por minuto e por dia, que muda com o tempo; serve a um piloto, não a uma empresa inteira. Em desenvolvimento, gerar 168 vetores já bateu no limite por minuto (erro 429) e foi preciso repetir.
- **Privacidade:** no plano gratuito o conteúdo enviado pode ser usado para melhorar os produtos do Google. Em produção, com bios reais, o **plano pago é obrigatório**; esse é o custo real da escala.
- **Medir em produção:** `ai_interaction_log` registra o status de cada chamada; o próximo passo é registrar também `usageMetadata` (hoje descartado em `provedores.js`) para acompanhar o gasto real.
