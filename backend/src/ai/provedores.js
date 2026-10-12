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
