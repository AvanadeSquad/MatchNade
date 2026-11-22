import { describe, expect, it } from 'vitest';
import { SINERGIA_MINIMA_OPCOES, filtrarPorSinergiaMinima } from './sinergia.js';

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
