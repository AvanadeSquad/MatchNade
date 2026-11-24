import { describe, expect, it } from 'vitest';
import { SINERGIA_MINIMA_OPCOES, filtrarPorSinergiaMinima, sinergiaDaConexao, sinergiaExibida } from './sinergia.js';

const lista = [
  { nome: 'A', sinergia: 0.95 },
  { nome: 'B', sinergia: 0.6 },
  { nome: 'C', sinergia: 0.595 },
  { nome: 'D', sinergia: 0.2 },
  { nome: 'E', sinergia: 0 },
];
const nomes = (itens) => itens.map((i) => i.nome);

describe('filtrarPorSinergiaMinima', () => {
  it('com mínimo zero não filtra nada, inclusive quem tem sinergia zero', () => {
    expect(nomes(filtrarPorSinergiaMinima(lista, 0))).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(filtrarPorSinergiaMinima(lista, undefined)).toBe(lista);
  });

  it('mantém só quem tem o mínimo ou mais', () => {
    expect(nomes(filtrarPorSinergiaMinima(lista, 60))).toEqual(['A', 'B', 'C']);
    expect(nomes(filtrarPorSinergiaMinima(lista, 80))).toEqual(['A']);
    expect(nomes(filtrarPorSinergiaMinima(lista, 20))).toEqual(['A', 'B', 'C', 'D']);
  });

  it('compara o percentual arredondado, o mesmo número que aparece no cartão', () => {
    // 0,595 aparece como 60% (arredondado) e por isso entra no filtro de 60%.
    expect(nomes(filtrarPorSinergiaMinima(lista, 60))).toContain('C');
    expect(nomes(filtrarPorSinergiaMinima([{ nome: 'F', sinergia: 0.594 }], 60))).toEqual([]);
  });

  it('devolve lista vazia quando ninguém alcança o mínimo', () => {
    expect(filtrarPorSinergiaMinima([{ nome: 'G', sinergia: 0.3 }], 80)).toEqual([]);
  });

  it('as opções começam em "Qualquer" e crescem de 20 em 20', () => {
    expect(SINERGIA_MINIMA_OPCOES.map((o) => o.id)).toEqual([0, 20, 40, 60, 80]);
    expect(SINERGIA_MINIMA_OPCOES[0].rotulo).toBe('Qualquer');
  });
});

describe('sinergiaExibida', () => {
  const recife = 'Avanade Recife (Porto Digital)';
  const padrao = { pesoProfissional: 70, polos: [] };

  it('repondera os eixos pelo equilíbrio escolhido (70% profissional por padrão)', () => {
    const valor = sinergiaExibida({ tecnica: 0.5, pessoal: 0.3, scoreDaApi: 0.4 }, padrao);
    expect(valor).toBeCloseTo(0.44, 5);
  });

  it('com 50/50 coincide com a média dos dois eixos', () => {
    const valor = sinergiaExibida({ tecnica: 0.5, pessoal: 0.3, scoreDaApi: 0.4 }, { ...padrao, pesoProfissional: 50 });
    expect(valor).toBeCloseTo(0.4, 5);
  });

  it('sem os dois eixos usa o score devolvido pela API', () => {
    expect(sinergiaExibida({ scoreDaApi: 0.37 }, padrao)).toBe(0.37);
  });

  it('soma o bônus de 0,05 para colega de cidade de polo habilitado', () => {
    const valor = sinergiaExibida({ tecnica: 0.5, pessoal: 0.3, cidade: 'Recife', scoreDaApi: 0 }, { ...padrao, polos: [recife] });
    expect(valor).toBeCloseTo(0.49, 5);
  });

  it('não dá bônus a quem tem sinergia zero nem passa de 100%', () => {
    expect(sinergiaExibida({ tecnica: 0, pessoal: 0, cidade: 'Recife', scoreDaApi: 0 }, { ...padrao, polos: [recife] })).toBe(0);
    expect(sinergiaExibida({ tecnica: 1, pessoal: 1, cidade: 'Recife', scoreDaApi: 1 }, { ...padrao, polos: [recife] })).toBe(1);
  });
});

describe('sinergiaDaConexao', () => {
  const padrao = { pesoProfissional: 70, polos: [] };

  it('usa os eixos da conexão e a mesma conta da Descoberta', () => {
    const conexao = { affinity_technical: 0.5, affinity_personal: 0.3, affinity_score: 0.4, city: 'Recife' };
    expect(sinergiaDaConexao(conexao, padrao)).toBeCloseTo(
      sinergiaExibida({ tecnica: 0.5, pessoal: 0.3, scoreDaApi: 0.4, cidade: 'Recife' }, padrao),
      10,
    );
    expect(sinergiaDaConexao(conexao, padrao)).toBeCloseTo(0.44, 5);
  });

  it('sem os eixos (API antiga) usa o score da API', () => {
    expect(sinergiaDaConexao({ affinity_score: 0.37 }, padrao)).toBe(0.37);
  });
});
