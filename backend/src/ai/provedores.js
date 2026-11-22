// Erro de uma chamada de IA. `repetivel` indica que vale tentar de novo (429, 5xx, timeout, rede).
export class ErroIa extends Error {
  constructor(mensagem, { repetivel = false, status = null } = {}) {
    super(mensagem);
    this.repetivel = repetivel;
    this.status = status;
  }
}

async function chamar(url, opcoes, sinal) {
  let resposta;
  try {
    resposta = await fetch(url, { ...opcoes, signal: sinal });
  } catch (erro) {
    const tempoEsgotado = erro?.name === 'TimeoutError' || erro?.name === 'AbortError';
    throw new ErroIa(tempoEsgotado ? 'tempo esgotado' : 'falha de rede', { repetivel: true });
  }
  if (!resposta.ok) {
    throw new ErroIa(`resposta ${resposta.status}`, {
      repetivel: resposta.status === 429 || resposta.status >= 500,
      status: resposta.status,
    });
  }
  return resposta.json();
}

// Gemini via REST, com saída JSON validada por responseSchema.
export function provedorGemini({ chave, modelo }) {
  return {
    nome: 'gemini',
    modelo,
    async gerar({ sistema, usuario, temperatura, maxTokens, schema }, sinal) {
      const dados = await chamar(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: sistema }] },
            contents: [{ role: 'user', parts: [{ text: usuario }] }],
            generationConfig: {
              temperature: temperatura,
              maxOutputTokens: maxTokens,
              responseMimeType: 'application/json',
              responseSchema: schema,
            },
          }),
        },
        sinal,
      );
      const texto = dados?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof texto !== 'string') throw new ErroIa('resposta sem texto');
      return texto;
    },
  };
}

// Embeddings do Gemini (batchEmbedContents). Recebe só nomes de tag e devolve um vetor por nome, na mesma ordem.
// Resposta com quantidade diferente de vetores é erro: nunca se grava vetor no lugar errado.
export function provedorEmbeddingsGemini({ chave, modelo }) {
  return {
    nome: 'gemini-embeddings',
    modelo,
    async gerar(nomes, sinal = AbortSignal.timeout(15000)) {
      const dados = await chamar(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:batchEmbedContents`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave },
          body: JSON.stringify({
            requests: nomes.map((nome) => ({
              model: `models/${modelo}`,
              taskType: 'SEMANTIC_SIMILARITY',
              content: { parts: [{ text: nome }] },
            })),
          }),
        },
        sinal,
      );
      const vetores = dados?.embeddings?.map((e) => e?.values);
      if (!Array.isArray(vetores) || vetores.length !== nomes.length || vetores.some((v) => !Array.isArray(v) || v.length === 0)) {
        throw new ErroIa('resposta de embeddings incompleta');
      }
      return vetores;
    },
  };
}

// Groq (API compatível com OpenAI), usado como reserva do Gemini.
export function provedorGroq({ chave, modelo }) {
  return {
    nome: 'groq',
    modelo,
    async gerar({ sistema, usuario, temperatura, maxTokens }, sinal) {
      const dados = await chamar(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${chave}` },
          body: JSON.stringify({
            model: modelo,
            temperature: temperatura,
            max_tokens: maxTokens,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: sistema },
              { role: 'user', content: usuario },
            ],
          }),
        },
        sinal,
      );
      const texto = dados?.choices?.[0]?.message?.content;
      if (typeof texto !== 'string') throw new ErroIa('resposta sem texto');
      return texto;
    },
  };
}

export function criarProvedores(configIa) {
  const lista = [];
  if (configIa.geminiKey) lista.push(provedorGemini({ chave: configIa.geminiKey, modelo: configIa.geminiModel }));
  if (configIa.groqKey) lista.push(provedorGroq({ chave: configIa.groqKey, modelo: configIa.groqModel }));
  return lista;
}
