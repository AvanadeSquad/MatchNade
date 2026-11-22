import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErroIa, provedorEmbeddingsGemini } from '../src/ai/provedores.js';
import { carregarConfig } from '../src/config/env.js';
import { carregarSimilaridades, carregarVetores, recalcularSimilaridades } from '../src/services/semantica-carga.js';
import { criarAmbiente } from './ajudante.js';

const resposta = (corpo, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => corpo });
afterEach(() => vi.unstubAllGlobals());

describe('configuração do score semântico', () => {
  it('vem desligada por padrão, com limiar 0,75 e peso 0,5', () => {
    const { semantica } = carregarConfig({ NODE_ENV: 'test' });
    expect(semantica).toMatchObject({ ativa: false, limiar: 0.75, peso: 0.5 });
    expect(semantica.modelo).toBeTruthy();
  });

  it('lê as variáveis e ignora número inválido ou fora de 0 a 1', () => {
    const ligada = carregarConfig({
      NODE_ENV: 'test',
      SEMANTIC_AFFINITY_ENABLED: 'true',
      SEMANTIC_THRESHOLD: '0.8',
      SEMANTIC_WEIGHT: '0.3',
    });
    expect(ligada.semantica).toMatchObject({ ativa: true, limiar: 0.8, peso: 0.3 });
    const ruim = carregarConfig({ NODE_ENV: 'test', SEMANTIC_THRESHOLD: 'abc', SEMANTIC_WEIGHT: '7' });
    expect(ruim.semantica).toMatchObject({ limiar: 0.75, peso: 0.5 });
  });
});

describe('provedor de embeddings do Gemini', () => {
  it('envia só os nomes das tags, a chave no cabeçalho, e devolve um vetor por nome na mesma ordem', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(resposta({ embeddings: [{ values: [1, 0] }, { values: [0, 1] }] }));
    vi.stubGlobal('fetch', fetchFalso);

    const vetores = await provedorEmbeddingsGemini({ chave: 'chave-secreta', modelo: 'modelo-e' }).gerar(['Django', 'Xadrez']);

    expect(vetores).toEqual([
      [1, 0],
      [0, 1],
    ]);
    const [url, opcoes] = fetchFalso.mock.calls[0];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/modelo-e:batchEmbedContents');
    expect(url).not.toContain('chave-secreta');
    expect(opcoes.headers['x-goog-api-key']).toBe('chave-secreta');
    const corpo = JSON.parse(opcoes.body);
    expect(corpo.requests.map((r) => r.content.parts[0].text)).toEqual(['Django', 'Xadrez']);
    expect(Object.keys(corpo.requests[0].content.parts[0])).toEqual(['text']);
  });

  it('resposta com quantidade diferente de vetores vira erro, sem gravar nada errado', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta({ embeddings: [{ values: [1] }] })));
    await expect(provedorEmbeddingsGemini({ chave: 'k', modelo: 'm' }).gerar(['a', 'b'])).rejects.toBeInstanceOf(ErroIa);
  });

  it('429 é erro repetível', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta({}, 429)));
    await expect(provedorEmbeddingsGemini({ chave: 'k', modelo: 'm' }).gerar(['a'])).rejects.toMatchObject({
      repetivel: true,
      status: 429,
    });
  });
});

// Vetores do provedor simulado: Django, FastAPI e Python apontam para o mesmo lado; Xadrez para outro.
const VETORES = { Django: [0.9, 0.3, 0], FastAPI: [0.9, 0.2, 0.1], Python: [1, 0, 0], Xadrez: [0, 0, 1] };
const provedorSimulado = (falhaNoLote = null) => {
  let chamadas = 0;
  return {
    modelo: 'simulado-1',
    gerar: vi.fn(async (nomes) => {
      chamadas += 1;
      if (falhaNoLote === chamadas) throw new ErroIa('indisponível', { repetivel: true });
      return nomes.map((n) => VETORES[n] ?? [0, 1, 1]);
    }),
  };
};

describe('carga de vetores e de similaridades no banco', () => {
  let a;
  beforeAll(async () => {
    a = await criarAmbiente();
  });
  afterAll(() => a.fechar());
  beforeEach(async () => {
    await a.limpar();
    await a.criarPessoa({ nome: 'Ana Silva', tecnicas: ['Django', 'FastAPI', 'Python'], hobbies: ['Xadrez'] });
  });

  it('gera o vetor só das tags que ainda não têm, e guarda o modelo usado', async () => {
    const provedor = provedorSimulado();
    const primeira = await carregarVetores({ banco: a.banco, provedor });
    expect(primeira).toMatchObject({ geradas: 4, restantes: 0 });
    const [linha] = await a.banco.query("SELECT embedding, embedding_model FROM interest_tag WHERE name = 'Django'");
    expect(linha.embedding).toEqual(VETORES.Django);
    expect(linha.embedding_model).toBe('simulado-1');

    const segunda = await carregarVetores({ banco: a.banco, provedor });
    expect(segunda).toMatchObject({ geradas: 0, restantes: 0 });
    expect(provedor.gerar).toHaveBeenCalledTimes(1);
  });

  it('só os nomes das tags vão ao provedor', async () => {
    const provedor = provedorSimulado();
    await carregarVetores({ banco: a.banco, provedor });
    const enviados = provedor.gerar.mock.calls.flatMap(([nomes]) => nomes).sort();
    expect(enviados).toEqual(['Django', 'FastAPI', 'Python', 'Xadrez']);
  });

  it('se o provedor falha num lote, guarda os outros e conta o que ficou sem vetor, sem lançar erro', async () => {
    const resultado = await carregarVetores({ banco: a.banco, provedor: provedorSimulado(2), tamanhoLote: 2 });
    expect(resultado).toMatchObject({ geradas: 2, restantes: 2 });
    const [{ n }] = await a.banco.query('SELECT COUNT(*)::int AS n FROM interest_tag WHERE embedding IS NULL');
    expect(n).toBe(2);
  });

  it('recalcula a tabela de pares acima do limiar, menor id primeiro, e refaz do zero a cada vez', async () => {
    await carregarVetores({ banco: a.banco, provedor: provedorSimulado() });
    const { pares } = await recalcularSimilaridades({ banco: a.banco, limiar: 0.75 });
    expect(pares).toBe(3);
    const linhas = await a.banco.query(
      `SELECT ta.name AS a, tb.name AS b, s.similarity FROM tag_similarity s
         JOIN interest_tag ta ON ta.id = s.tag_a JOIN interest_tag tb ON tb.id = s.tag_b ORDER BY ta.name, tb.name`,
    );
    expect(linhas.map((l) => `${l.a}-${l.b}`)).toEqual(['Django-FastAPI', 'Django-Python', 'FastAPI-Python']);
    expect(linhas.every((l) => l.similarity >= 0.75 && l.similarity <= 1)).toBe(true);

    expect((await recalcularSimilaridades({ banco: a.banco, limiar: 0.99 })).pares).toBeLessThan(3);
    const mapa = await carregarSimilaridades(a.banco.query, 0.75);
    expect(mapa.size).toBe((await a.banco.query('SELECT 1 FROM tag_similarity WHERE similarity >= 0.75')).length);
  });

  it('o banco recusa par fora de ordem e apagar a tag leva os pares junto', async () => {
    await carregarVetores({ banco: a.banco, provedor: provedorSimulado() });
    await recalcularSimilaridades({ banco: a.banco, limiar: 0.75 });
    const [{ id }] = await a.banco.query("SELECT id FROM interest_tag WHERE name = 'Python'");
    await expect(a.banco.query('INSERT INTO tag_similarity (tag_a, tag_b, similarity) VALUES (2, 1, 0.9)')).rejects.toThrow();
    await a.banco.query('DELETE FROM employee_interest WHERE interest_id = $1', [id]);
    await a.banco.query('DELETE FROM interest_tag WHERE id = $1', [id]);
    expect(await a.banco.query('SELECT 1 FROM tag_similarity WHERE tag_a = $1 OR tag_b = $1', [id])).toHaveLength(0);
  });
});

describe('recomendações com o score semântico', () => {
  async function montar(ambiente) {
    const a = await criarAmbiente({ ambiente });
    const ana = await a.criarPessoa({ nome: 'Ana Silva', tecnicas: ['Django', 'FastAPI'], hobbies: ['Xadrez'] });
    const bia = await a.criarPessoa({ nome: 'Bia Lima', tecnicas: ['Python', 'SQL'], hobbies: ['Xadrez'] });
    await a.criarPessoa({ nome: 'Caio Reis', tecnicas: ['Excel', 'Power BI'], hobbies: ['Corrida'] });
    await carregarVetores({ banco: a.banco, provedor: provedorSimulado() });
    await recalcularSimilaridades({ banco: a.banco, limiar: 0.75 });
    return { a, ana, bia };
  }

  it('desligado (padrão), a tabela de pares é ignorada e a conta é a de sempre', async () => {
    const { a, ana } = await montar({});
    const r = await a.como(ana.email).get('/matches/recommendations?limit=5');
    const bia = r.body.recommendations.find((x) => x.name === 'Bia Lima');
    expect(bia.related_interests).toEqual([]);
    expect(bia.affinity_score).toBe(0.5);
    await a.fechar();
  }, 30000);

  it('ligado, Django e FastAPI contra Python sobem a afinidade e aparecem como interesses relacionados', async () => {
    const desligado = await montar({});
    const pontoDeComparacao = (
      await desligado.a.como(desligado.ana.email).get('/matches/recommendations?limit=5')
    ).body.recommendations.find((x) => x.name === 'Bia Lima').affinity_score;
    await desligado.a.fechar();

    const { a, ana } = await montar({ SEMANTIC_AFFINITY_ENABLED: 'true' });
    const r = await a.como(ana.email).get('/matches/recommendations?limit=5');
    const bia = r.body.recommendations.find((x) => x.name === 'Bia Lima');
    expect(bia.affinity_score).toBeGreaterThan(pontoDeComparacao);
    expect(bia.shared_interests).toEqual(['Xadrez']);
    expect(bia.related_interests.map((p) => [p.mine, p.theirs])).toEqual([
      ['FastAPI', 'Python'],
      ['Django', 'Python'],
    ]);
    expect(bia.related_interests[0].similarity).toBeGreaterThan(0.75);
    expect(r.body.recommendations[0].name).toBe('Bia Lima');
    expect(JSON.stringify(r.body)).not.toMatch(/cargo|position/i);
    await a.fechar();
  }, 30000);

  it('ligado mas sem nenhuma tag com vetor, vale o score exato, sem erro', async () => {
    const a = await criarAmbiente({ ambiente: { SEMANTIC_AFFINITY_ENABLED: 'true' } });
    const ana = await a.criarPessoa({ nome: 'Ana Silva', tecnicas: ['Django', 'FastAPI'], hobbies: ['Xadrez'] });
    await a.criarPessoa({ nome: 'Bia Lima', tecnicas: ['Python', 'SQL'], hobbies: ['Xadrez'] });
    const r = await a.como(ana.email).get('/matches/recommendations?limit=5');
    expect(r.status).toBe(200);
    expect(r.body.recommendations.find((x) => x.name === 'Bia Lima').related_interests).toEqual([]);
    await a.fechar();
  }, 30000);
});
