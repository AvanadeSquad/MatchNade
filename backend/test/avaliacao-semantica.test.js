import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { avaliarPares, varreduraDeLimiar } from '../avaliacao/avaliar-semantica.js';

const VETORES = new Map([
  ['Django', [0.9, 0.3, 0]],
  ['Python', [1, 0, 0]],
  ['Xadrez', [0, 0, 1]],
  ['Java', [0.2, 0, 0.9]],
]);
const PARES = [
  { a: 'Django', b: 'Python', relacionada: true },
  { a: 'Django', b: 'Xadrez', relacionada: false },
  { a: 'Java', b: 'Python', relacionada: true },
];

describe('avaliarPares', () => {
  it('conta acertos, falsos positivos e falsos negativos no limiar escolhido', () => {
    const r = avaliarPares(PARES, VETORES, 0.75);
    expect(r).toMatchObject({ total: 3, verdadeirosPositivos: 1, falsosPositivos: 0, falsosNegativos: 1, verdadeirosNegativos: 1 });
    expect(r.precisao).toBe(1);
    expect(r.cobertura).toBe(0.5);
    expect(r.acerto).toBeCloseTo(2 / 3, 10);
  });

  it('par sem vetor entra como não encontrado, fora da conta', () => {
    const r = avaliarPares([...PARES, { a: 'Django', b: 'Rust', relacionada: true }], VETORES, 0.75);
    expect(r.semVetor).toEqual([['Django', 'Rust']]);
    expect(r.total).toBe(3);
  });

  it('limiar mais baixo ganha cobertura e pode perder precisão', () => {
    const baixo = avaliarPares(PARES, VETORES, 0.1);
    expect(baixo.cobertura).toBeGreaterThanOrEqual(avaliarPares(PARES, VETORES, 0.75).cobertura);
  });
});

describe('varreduraDeLimiar', () => {
  it('devolve uma linha por limiar, em ordem crescente', () => {
    const linhas = varreduraDeLimiar(PARES, VETORES, [0.9, 0.5, 0.7]);
    expect(linhas.map((l) => l.limiar)).toEqual([0.5, 0.7, 0.9]);
  });
});

describe('gabarito de pares (pares-tags.json)', () => {
  it('tem pares sem repetição, sem tag igual a si mesma e com os dois tipos', async () => {
    const { pares } = JSON.parse(await readFile(new URL('../avaliacao/pares-tags.json', import.meta.url), 'utf8'));
    const chaves = pares.map((p) => [p.a, p.b].sort().join('|').toLowerCase());
    expect(new Set(chaves).size).toBe(pares.length);
    expect(pares.every((p) => p.a !== p.b && typeof p.relacionada === 'boolean')).toBe(true);
    expect(pares.filter((p) => p.relacionada).length).toBeGreaterThanOrEqual(15);
    expect(pares.filter((p) => !p.relacionada).length).toBeGreaterThanOrEqual(15);
  });

  it('inclui os exemplos do cartão: Django e Python relacionam, Django e xadrez não', async () => {
    const { pares } = JSON.parse(await readFile(new URL('../avaliacao/pares-tags.json', import.meta.url), 'utf8'));
    const achar = (a, b) => pares.find((p) => p.a === a && p.b === b);
    expect(achar('Django', 'Python').relacionada).toBe(true);
    expect(achar('Django', 'Xadrez').relacionada).toBe(false);
  });
});
