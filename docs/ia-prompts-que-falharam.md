# Prompts que falharam e como foram ajustados

Documento de 1 página da Entrega Final (item 1.5). Cada caso traz o que falhou, o ajuste e como a equipe validou o resultado. Versões e histórico: [`ia-prompts.md`](ia-prompts.md). Os números de qualidade vêm da descrição do PR #67 e do relatório técnico da equipe de IA (18/11/2026).

## Caso 1: quebra-gelo v1 aceitava frases com interesse de uma pessoa só e comparava com acento

- **O que falhou:** a v1 recebia as listas completas de interesses das duas pessoas (e as enviava ao provedor) e a validação só exigia que a frase citasse **pelo menos um** interesse em comum. Uma frase que citasse também um interesse de uma pessoa só passava. Além disso, a conferência comparava texto com acento e maiúsculas: a frase "fotografia" era rejeitada por não bater com a tag "Fotografia", e a IA caía no texto padrão sem necessidade.
- **Ajuste (v2, PR #67):** o backend calcula os interesses em comum e o prompt passa a receber **só essa lista**, então o modelo não tem o que citar fora dela. Entraram regras numeradas (citar um ou dois itens, sem nomes de pessoas, emojis nem clichês, assunto específico) e dois exemplos que mostram o tom. A conferência passou a comparar sem acento e sem diferença de maiúsculas.
- **Como validamos:** a frase só é aceita se citar um interesse em comum, tiver até 250 caracteres e não mencionar cargo, hierarquia nem dado sensível; caso contrário aparece o texto padrão, que não é guardado. O PR trouxe 17 testes novos (3 do quebra-gelo) em `backend/test/ia-prompts.test.js`.

## Caso 2: extração v2 com formato de tag livre

- **O que falhou:** a v2 pedia o JSON e proibia cargo e dado sensível, mas deixava o formato da tag livre. Sem regra de formato, a mesma ideia podia voltar com grafias diferentes ("pinto quadros", "Pintura", "pintura de quadros"), o que fragmenta as tags e enfraquece a afinidade, que depende de tags iguais. A instrução de incluir hobbies comuns (música, viagens) só existe a partir da v3.
- **Ajuste (v3, PR #67):** regras numeradas (hobbies comuns entram; verbo vira substantivo; área técnica vira o nome usual; 1 a 3 palavras; grafia oficial das tecnologias), exemplos com e sem tentativa de injeção e, no backend, o catálogo das 150 tags mais usadas e o ajuste de grafia e categoria (`ajustarAoCatalogo`).
- **Como validamos:** 20 biografias anotadas pela equipe (`backend/avaliacao/bios.json`) e `npm run avaliar-ia`: precisão de 82% para 88% e cobertura de 86% para 89%, com 0 respostas com cargo ou texto injetado; a variação entre rodadas é de cerca de 4 pontos (relatório técnico), então a melhora da cobertura fica dentro dela. Atenção: essa avaliação offline roda **sem o catálogo**, então mede as regras e os exemplos do prompt; o catálogo e o ajuste de grafia são cobertos por testes automatizados (`ia-prompts.test.js`). Os exemplos do prompt usam interesses que não estão nas 20 bios, para a medição não premiar o que o modelo copiou.

## O que aprendemos

Medir antes de ligar (o limiar semântico de 0,75 dava 60% de precisão e foi para 0,85, com 95%, num teste com 40 pares); entregar ao modelo só o dado de que ele precisa; tratar toda entrada como dado, nunca como instrução; e manter a versão anterior do prompt no arquivo para comparar e voltar atrás.
