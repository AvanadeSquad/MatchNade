# Afinidade semântica entre tags

Cartão S4-14. Faz Django e FastAPI contarem como parcialmente parecidos com Python, em vez de valerem zero por serem tags diferentes. **Vem desligada por padrão**: antes de ligar, é preciso gerar os vetores e medir o gabarito com a chave real do Gemini.

## Como funciona

1. **Vetor por tag.** Cada tag ganha um vetor (embedding) gerado uma vez a partir do **nome**, e guardado em `interest_tag.embedding`. Só nomes de tag vão ao provedor: nenhum dado pessoal, cargo ou bio.
2. **Pares já calculados.** A similaridade (cosseno) entre as tags é calculada de uma vez e os pares acima do limiar ficam em `tag_similarity`. A recomendação só lê essa tabela; não chama IA e não recalcula vetores.
3. **Correspondência parcial.** Em cada eixo (técnico e pessoal), uma tag que a outra pessoa não tem conta pela similaridade com a tag mais parecida dela, ponderada pela raridade (IDF). O resultado é `exato + peso * (suave - exato)`.
4. **Explicável.** A resposta de `GET /matches/recommendations` traz `related_interests`, com os pares `{ mine, theirs, similarity }` (até 3, os mais parecidos). As tags em comum continuam em `shared_interests`.

Exemplo medido nos testes: Ana (Django, FastAPI) e Bia (Python, SQL) tinham afinidade técnica 0. Com o score semântico (peso 0,5), a afinidade técnica sobe para cerca de 0,18 e a afinidade total de 0,50 para 0,59, e a resposta explica por quê: FastAPI e Python, Django e Python. Os vetores desse exemplo são escolhidos à mão; com vetores reais os números mudam.

## Se a IA falhar, nada quebra

- Desligado, sem tabela de pares ou sem nenhuma tag com vetor: vale o score exato de sempre, idêntico ao anterior (os testes de afinidade que já existiam seguem passando sem mudança).
- Falha do provedor ao gerar vetores: o lote com falha é pulado, os outros são guardados, e as tags sem vetor valem só pelo score exato.
- Resposta do provedor com quantidade errada de vetores é descartada: nunca se grava vetor no lugar errado.

## Como ligar

```powershell
cd backend
npm run embeddings          # gera os vetores que faltam e recalcula a tabela de pares (precisa de GEMINI_API_KEY)
npm run avaliar-semantica   # mede precisão e cobertura por limiar contra backend/avaliacao/pares-tags.json
```

Depois de conferir o resultado, ajuste e ligue no `.env`:

| Variável | Padrão | O que faz |
|---|---|---|
| `SEMANTIC_AFFINITY_ENABLED` | `false` | Liga a correspondência parcial. |
| `SEMANTIC_THRESHOLD` | `0.85` | Similaridade mínima para o par entrar em `tag_similarity`. Troque o valor e rode `npm run embeddings` de novo para refazer a tabela. |
| `SEMANTIC_WEIGHT` | `0.5` | Quanto o score suave pesa contra o exato (0 = só exato, 1 = só suave). |
| `GEMINI_EMBED_MODEL` | `gemini-embedding-001` | Modelo de vetores. |

O gabarito tem 40 pares: 24 relacionados (Django e Python, Corrida e Maratona) e 16 sem relação, incluindo o caso difícil Java e JavaScript. A medida de precisão evita ligar um limiar que relaciona tags que não têm nada a ver.

## Desempenho

Medido em 22/11 com 2.000 pessoas, 168 tags e 1.092 pares (vetores sintéticos, que medem só o custo de CPU): a recomendação passou de 44 ms para 62 ms de mediana (+18 ms), e recalcular a tabela leva 28 ms. O custo cresce com o número de candidatos, porque cada par de pessoas faz mais consultas à tabela de pares. Reavalie com `npm run carga` antes de ligar numa base maior.

## O que ainda não foi feito

- **Medição com chave real (25/11/2026).** Feita com `gemini-embedding-001` e o gabarito de 40 pares (44 tags). O formato do `batchEmbedContents` foi confirmado. O limiar de 0,75 não serve: o modelo dá cosseno alto entre quase qualquer par, e de 0,50 a 0,80 a precisão fica em 60% (cobertura 100%); com as 60 tags do seed, todos os 1.770 pares passaram. Em **0,85** a precisão é 95% e a cobertura 79%; em 0,90, 89% e 33%. Por isso o padrão passou a 0,85. A opção continua desligada por padrão: a medição valida a precisão dos pares, não a qualidade das sugestões. O plano gratuito limita as requisições por minuto (erro 429); se aparecer, repita após um minuto.
- **Vetor ao criar a tag.** Resolvido: com `SEMANTIC_AFFINITY_ENABLED=true` e `GEMINI_API_KEY`, tag nova (criada por `PUT /profile/interests` ou `POST /tags`) ganha vetor em segundo plano e a tabela de pares é refeita (`backend/src/services/vetorizador.js`). A rota nunca espera pelo provedor e uma falha deixa a tag valendo só pelo score exato até a próxima rodada ou até `npm run embeddings`. A tabela é refeita por inteiro a cada rodada com vetor novo; com um catálogo de milhares de tags, vale trocar por atualização só dos pares da tag nova.
- **Texto de por que combinam.** `related_interests` aparece na Descoberta e no perfil como "Interesses parecidos" (some quando vazio). Não há texto gerado por IA para explicar.
