import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErroIa } from '../src/ai/provedores.js';
import { criarVetorizador } from '../src/services/vetorizador.js';
import { criarAmbiente } from './ajudante.js';

// Django, FastAPI e Python apontam para o mesmo lado; Xadrez para outro.
const VETORES = { Django: [0.9, 0.3, 0], FastAPI: [0.9, 0.2, 0.1], Python: [1, 0, 0], Xadrez: [0, 0, 1] };
const provedorSimulado = (falha = false) => ({
  modelo: 'simulado-1',
  gerar: vi.fn(async (nomes) => {
    if (falha) throw new ErroIa('indisponível', { repetivel: true });
    return nomes.map((n) => VETORES[n] ?? [0, 1, 1]);
  }),
});

describe('vetorizador de tags novas', () => {
  let a;
  beforeAll(async () => {
    a = await criarAmbiente();
  });
  afterAll(() => a.fechar());
  beforeEach(async () => {
    await a.limpar();
    await a.criarPessoa({ nome: 'Ana Silva', tecnicas: ['Django', 'FastAPI', 'Python'], hobbies: ['Xadrez'] });
  });

  it('gera o vetor das tags sem vetor e refaz a tabela de pares, em segundo plano', async () => {
    const provedor = provedorSimulado();
    const vetorizador = criarVetorizador({ banco: a.banco, provedor, limiar: 0.75 });
    vetorizador.agendar();
    await vetorizador.aguardar();
    const [{ n }] = await a.banco.query('SELECT COUNT(*)::int AS n FROM interest_tag WHERE embedding IS NOT NULL');
    expect(n).toBe(4);
    const [{ pares }] = await a.banco.query('SELECT COUNT(*)::int AS pares FROM tag_similarity');
    expect(pares).toBe(3);
  });

  it('só chama o provedor para as tags que faltam', async () => {
    const provedor = provedorSimulado();
    const vetorizador = criarVetorizador({ banco: a.banco, provedor, limiar: 0.75 });
    vetorizador.agendar();
    await vetorizador.aguardar();
    await a.criarPessoa({ nome: 'Bia Lima', tecnicas: ['Flask'], hobbies: [] });
    vetorizador.agendar();
    await vetorizador.aguardar();
    const nomesEnviados = provedor.gerar.mock.calls.flatMap(([nomes]) => nomes).sort();
    expect(nomesEnviados).toEqual(['Django', 'FastAPI', 'Flask', 'Python', 'Xadrez']);
  });

  it('várias chamadas seguidas viram no máximo uma rodada extra', async () => {
    const provedor = provedorSimulado();
    const vetorizador = criarVetorizador({ banco: a.banco, provedor, limiar: 0.75 });
    vetorizador.agendar();
    vetorizador.agendar();
    vetorizador.agendar();
    await vetorizador.aguardar();
    expect(provedor.gerar.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it('falha do provedor não lança erro e deixa as tags sem vetor', async () => {
    const vetorizador = criarVetorizador({ banco: a.banco, provedor: provedorSimulado(true), limiar: 0.75 });
    vetorizador.agendar();
    await expect(vetorizador.aguardar()).resolves.toBeUndefined();
    const [{ n }] = await a.banco.query('SELECT COUNT(*)::int AS n FROM interest_tag WHERE embedding IS NOT NULL');
    expect(n).toBe(0);
  });

  it('sem provedor (sem chave) não faz nada e não lança erro', async () => {
    const vetorizador = criarVetorizador({ banco: a.banco, provedor: null, limiar: 0.75 });
    vetorizador.agendar();
    await expect(vetorizador.aguardar()).resolves.toBeUndefined();
  });
});

describe('rotas que criam tag acionam o vetorizador', () => {
  it('PUT /profile/interests e POST /tags chamam agendar depois de criar a tag, sem esperar por ele', async () => {
    const vetorizador = { agendar: vi.fn(), aguardar: vi.fn() };
    const b = await criarAmbiente({ vetorizador });
    const ana = await b.criarPessoa({ nome: 'Ana Silva', tecnicas: ['React', 'Node.js', 'Azure'] });

    const interesses = await b.como(ana.email).put('/profile/interests', {
      interests: [
        { name: 'React', category: 'TECHNICAL' },
        { name: 'Node.js', category: 'TECHNICAL' },
        { name: 'Rust', category: 'TECHNICAL' },
      ],
    });
    expect(interesses.status).toBe(200);
    expect(vetorizador.agendar).toHaveBeenCalledTimes(1);

    const tag = await b.como(ana.email).post('/tags', { name: 'Golang', category: 'TECHNICAL' });
    expect(tag.status).toBe(201);
    expect(vetorizador.agendar).toHaveBeenCalledTimes(2);
    await b.fechar();
  }, 30000);

  it('uma falha do vetorizador não derruba a rota', async () => {
    const vetorizador = {
      agendar: vi.fn(() => {
        throw new Error('quebrou');
      }),
      aguardar: vi.fn(),
    };
    const b = await criarAmbiente({ vetorizador });
    const ana = await b.criarPessoa({ nome: 'Ana Silva', tecnicas: ['React', 'Node.js', 'Azure'] });
    const r = await b.como(ana.email).post('/tags', { name: 'Golang', category: 'TECHNICAL' });
    expect(r.status).toBe(201);
    await b.fechar();
  }, 30000);
});
