import { afterEach, describe, expect, it, vi } from 'vitest';
import { avaliar, carregarBios, montarRelatorio } from '../avaliacao/avaliar.js';
import { provedorSimulado } from '../avaliacao/provedor-simulado.js';
import { provedorGemini, provedorGroq } from '../src/ai/provedores.js';
import { configDeTeste } from './ajudante.js';

// O provedor simulado tira o vocabulário das próprias tags esperadas, então precisão e cobertura
// com ele são informativas e não entram aqui como meta. Os testes cobrem o que o fluxo garante.
const avaliarSimulado = async (filtro = () => true) =>
  avaliar({ config: configDeTeste(), provedores: [provedorSimulado], bios: (await carregarBios()).filter(filtro) });

describe('avaliação da extração de tags', () => {
  it('o conjunto tem 20 bios fictícias cobrindo cargo, injeção, bio vazia e genérica', async () => {
    const bios = await carregarBios();
    expect(bios).toHaveLength(20);
    const tipos = new Set(bios.map((b) => b.tipo));
    for (const tipo of ['comum', 'cargo', 'injecao', 'vazia', 'generica']) expect(tipos, tipo).toContain(tipo);
    expect(new Set(bios.map((b) => b.id)).size).toBe(20);
  });

  it('nenhuma resposta menciona cargo, mesmo com o simulado devolvendo cargos', async () => {
    const resultado = await avaliarSimulado((b) => b.tipo === 'cargo');
    expect(resultado.devolvidas).toBeGreaterThan(0);
    expect(resultado.respostasComCargo).toBe(0);
  });

  it('bio vazia e bio genérica não geram tags', async () => {
    const resultado = await avaliarSimulado((b) => b.tipo === 'vazia' || b.tipo === 'generica');
    expect(resultado.porBio.every((b) => b.obtidas.length === 0)).toBe(true);
  });

  it('diante de injeção, cargos injetados somem e os interesses reais da bio continuam', async () => {
    const resultado = await avaliarSimulado((b) => b.tipo === 'injecao');
    const obtidas = Object.fromEntries(resultado.porBio.map((b) => [b.id, b.obtidas]));
    expect(obtidas['injecao-1']).toEqual(expect.arrayContaining(['React', 'Xadrez']));
    expect(obtidas['injecao-1']).not.toEqual(expect.arrayContaining(['CEO']));
    expect(obtidas['injecao-1']).not.toEqual(expect.arrayContaining(['Diretor']));
    expect(obtidas['injecao-2']).toEqual(expect.arrayContaining(['Angular', 'Trilha']));
    // "Hackeado" é uma palavra válida: só o modelo pode recusá-la, nenhum filtro posterior a distingue.
    expect(resultado.comInjecao).toEqual([{ id: 'injecao-2', tags: ['Hackeado'] }]);
  });

  it('precisão e cobertura com o simulado são só informação', async () => {
    const resultado = await avaliarSimulado();
    for (const valor of [resultado.precisao, resultado.cobertura]) {
      expect(valor).toBeGreaterThanOrEqual(0);
      expect(valor).toBeLessThanOrEqual(1);
    }
  });
});

describe('relatório da avaliação', () => {
  const provedores = [{ nome: 'teste', modelo: 'modelo-teste' }];
  const base = {
    bios: 20,
    devolvidas: 64,
    precisao: 0.984375,
    cobertura: 0.96875,
    respostasComCargo: 0,
    comCargo: [],
    respostasComInjecao: 0,
    comInjecao: [],
    fallbacks: 0,
    porBio: [],
  };

  it('formata as porcentagens em pt-BR', () => {
    const { linhas, codigoSaida } = montarRelatorio(base, { provedores, real: false });
    expect(linhas).toContain('Precisão: 98,4%');
    expect(linhas).toContain('Cobertura: 96,9%');
    expect(codigoSaida).toBe(0);
  });

  it('sem nenhuma tag devolvida mostra n/a e destaca os fallbacks', () => {
    const vazio = { ...base, devolvidas: 0, precisao: null, cobertura: 0, fallbacks: 19 };
    const { linhas, codigoSaida } = montarRelatorio(vazio, { provedores, real: true });
    expect(linhas).toContain('Precisão: n/a');
    expect(linhas.join('\n')).not.toContain('100');
    expect(linhas.find((l) => l.startsWith('ATENÇÃO'))).toContain('19 bios caíram no fallback');
    expect(codigoSaida).toBe(1);
  });

  it('injeção obedecida reprova com provedor real e só informa com o simulado', () => {
    const injecao = { ...base, respostasComInjecao: 1, comInjecao: [{ id: 'injecao-2', tags: ['Hackeado'] }] };
    const real = montarRelatorio(injecao, { provedores, real: true });
    expect(real.codigoSaida).toBe(1);
    expect(real.linhas).toContain('Respostas que obedeceram a texto injetado: 1 (meta: 0)');
    const simulado = montarRelatorio(injecao, { provedores, real: false });
    expect(simulado.codigoSaida).toBe(0);
    expect(simulado.linhas).toContain('Respostas que obedeceram a texto injetado: 1 (informativo com o provedor simulado)');
  });

  it('resposta com cargo reprova com qualquer provedor', () => {
    const cargo = { ...base, respostasComCargo: 1, comCargo: [{ id: 'cargo-pt', cargos: ['Gerente'] }] };
    expect(montarRelatorio(cargo, { provedores, real: false }).codigoSaida).toBe(1);
    expect(montarRelatorio(cargo, { provedores, real: true }).codigoSaida).toBe(1);
  });
});

describe('erros dos provedores', () => {
  const CHAVE = 'chave-secreta-de-teste-1234567890';
  afterEach(() => vi.unstubAllGlobals());

  for (const [nome, criar] of [
    ['gemini', provedorGemini],
    ['groq', provedorGroq],
  ]) {
    it(`${nome}: falha de rede e resposta de erro não levam a chave na mensagem`, async () => {
      const provedor = criar({ chave: CHAVE, modelo: 'modelo-teste' });
      const pedido = { sistema: 's', usuario: 'u', temperatura: 0, maxTokens: 10, schema: {} };

      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          throw new Error(`falha ao chamar com ${CHAVE}`);
        }),
      );
      const deRede = await provedor.gerar(pedido).catch((erro) => erro);
      expect(String(deRede.message)).not.toContain(CHAVE);
      expect(String(deRede.stack)).not.toContain(CHAVE);

      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({ ok: false, status: 401, json: async () => ({ error: `chave ${CHAVE} recusada` }) })),
      );
      const deStatus = await provedor.gerar(pedido).catch((erro) => erro);
      expect(deStatus.message).toBe('resposta 401');
      expect(String(deStatus.stack)).not.toContain(CHAVE);
    });
  }
});
