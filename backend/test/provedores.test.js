import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErroIa, criarProvedores, provedorGemini, provedorGroq } from '../src/ai/provedores.js';

const requisicao = { sistema: 'instrução', usuario: 'texto', temperatura: 0.1, maxTokens: 300, schema: { type: 'OBJECT' } };

const resposta = (corpo, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => corpo });

afterEach(() => vi.unstubAllGlobals());

describe('provedor Gemini', () => {
  it('envia o schema, a chave no cabeçalho e lê o texto da primeira candidata', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(resposta({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }));
    vi.stubGlobal('fetch', fetchFalso);

    const texto = await provedorGemini({ chave: 'chave-secreta', modelo: 'modelo-x' }).gerar(requisicao, new AbortController().signal);

    expect(texto).toBe('{"ok":true}');
    const [url, opcoes] = fetchFalso.mock.calls[0];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/modelo-x:generateContent');
    expect(opcoes.headers['x-goog-api-key']).toBe('chave-secreta');
    expect(url).not.toContain('chave-secreta');
    const corpo = JSON.parse(opcoes.body);
    expect(corpo.systemInstruction.parts[0].text).toBe('instrução');
    expect(corpo.contents[0].parts[0].text).toBe('texto');
    expect(corpo.generationConfig).toMatchObject({ temperature: 0.1, maxOutputTokens: 300, responseMimeType: 'application/json', responseSchema: { type: 'OBJECT' } });
  });

  it('resposta sem texto vira erro não repetível', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta({ candidates: [] })));
    await expect(provedorGemini({ chave: 'k', modelo: 'm' }).gerar(requisicao)).rejects.toMatchObject({ repetivel: false });
  });
});

describe('provedor Groq', () => {
  it('usa o formato de chat com JSON obrigatório e a chave como Bearer', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(resposta({ choices: [{ message: { content: '{"match_summary":"oi"}' } }] }));
    vi.stubGlobal('fetch', fetchFalso);

    const texto = await provedorGroq({ chave: 'gsk-chave', modelo: 'llama-x' }).gerar(requisicao);

    expect(texto).toBe('{"match_summary":"oi"}');
    const [url, opcoes] = fetchFalso.mock.calls[0];
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(opcoes.headers.Authorization).toBe('Bearer gsk-chave');
    const corpo = JSON.parse(opcoes.body);
    expect(corpo).toMatchObject({ model: 'llama-x', temperature: 0.1, max_tokens: 300, response_format: { type: 'json_object' } });
    expect(corpo.messages).toEqual([
      { role: 'system', content: 'instrução' },
      { role: 'user', content: 'texto' },
    ]);
  });
});

describe('classificação dos erros', () => {
  const gerar = (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta({}, status)));
    return provedorGroq({ chave: 'k', modelo: 'm' }).gerar(requisicao);
  };

  it('429 e 5xx são repetíveis; 400 e 401 não são', async () => {
    await expect(gerar(429)).rejects.toMatchObject({ repetivel: true, status: 429 });
    await expect(gerar(503)).rejects.toMatchObject({ repetivel: true, status: 503 });
    await expect(gerar(400)).rejects.toMatchObject({ repetivel: false, status: 400 });
    await expect(gerar(401)).rejects.toMatchObject({ repetivel: false, status: 401 });
  });

  it('falha de rede e timeout são repetíveis', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    await expect(provedorGroq({ chave: 'k', modelo: 'm' }).gerar(requisicao)).rejects.toMatchObject({ repetivel: true });

    const tempo = Object.assign(new Error('tempo'), { name: 'TimeoutError' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(tempo));
    const erro = await provedorGroq({ chave: 'k', modelo: 'm' }).gerar(requisicao).catch((e) => e);
    expect(erro).toBeInstanceOf(ErroIa);
    expect(erro.message).toBe('tempo esgotado');
  });
});

describe('criarProvedores', () => {
  it('monta só os provedores com chave, Gemini primeiro', () => {
    const ia = { geminiKey: 'a', geminiModel: 'g', groqKey: 'b', groqModel: 'l' };
    expect(criarProvedores(ia).map((p) => p.nome)).toEqual(['gemini', 'groq']);
    expect(criarProvedores({ ...ia, geminiKey: '' }).map((p) => p.nome)).toEqual(['groq']);
    expect(criarProvedores({ ...ia, geminiKey: '', groqKey: '' })).toEqual([]);
  });
});
