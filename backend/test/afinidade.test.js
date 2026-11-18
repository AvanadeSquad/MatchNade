import { describe, expect, it } from 'vitest';
import { arredondar, calcularAfinidade, calcularIdf, jaccardPonderado } from '../src/services/afinidade.js';

// Base de 30 perfis. Ids: 1 React, 2 Node.js, 3 Azure, 4 Xadrez, 5 Café especial, 6 Ficção, 7 Corrida.
const df = new Map([
  [1, 14],
  [2, 18],
  [3, 6],
  [4, 2],
  [5, 4],
  [6, 9],
  [7, 5],
]);
const idf = calcularIdf(30, df);

const ana = { tecnicas: [1, 2], hobbies: [4, 5, 6], unidade: 'A' };
const bruno = { tecnicas: [2, 3], hobbies: [4, 7, 6], unidade: 'A' };
const camila = { tecnicas: [1, 2, 3], hobbies: [7, 6], unidade: 'A' };

describe('calcularIdf', () => {
  it('calcula ln(1 + N / df)', () => {
    expect(arredondar(idf.get(2))).toBe(0.98);
    expect(arredondar(idf.get(4))).toBe(2.77);
  });

  it('a tag rara pesa mais que a comum', () => {
    expect(idf.get(4)).toBeGreaterThan(idf.get(3));
    expect(idf.get(3)).toBeGreaterThan(idf.get(2));
  });

  it('a tag que todos têm continua com peso positivo (ln 2), nunca zero', () => {
    expect(calcularIdf(10, new Map([[1, 10]])).get(1)).toBeCloseTo(Math.LN2, 10);
  });

  it('tag sem nenhuma pessoa pesa zero', () => {
    expect(calcularIdf(10, new Map([[1, 0]])).get(1)).toBe(0);
  });
});

describe('afinidade ponderada', () => {
  it('a tag rara em comum faz Bruno passar à frente de Camila', () => {
    const comBruno = calcularAfinidade(ana, bruno, idf, 0);
    const comCamila = calcularAfinidade(ana, camila, idf, 0);
    expect(arredondar(comBruno.tecnico)).toBe(0.25);
    expect(arredondar(comBruno.pessoal)).toBe(0.51);
    expect(arredondar(comBruno.score)).toBe(0.38);
    expect(arredondar(comCamila.tecnico)).toBe(0.54);
    expect(arredondar(comCamila.pessoal)).toBe(0.18);
    expect(arredondar(comCamila.score)).toBe(0.36);
    expect(comBruno.score).toBeGreaterThan(comCamila.score);
  });

  it('eixo vazio vale zero', () => {
    expect(jaccardPonderado([], [1], idf)).toBe(0);
    expect(jaccardPonderado([], [], idf)).toBe(0);
  });

  it('sem nenhuma tag em comum o score é zero', () => {
    const outra = { tecnicas: [3], hobbies: [7], unidade: 'A' };
    expect(calcularAfinidade(ana, outra, idf, 0).score).toBe(0);
  });

  it('não dá bônus de unidade a quem não tem nada em comum', () => {
    const outra = { tecnicas: [3], hobbies: [7], unidade: 'B' };
    expect(calcularAfinidade(ana, outra, idf, 0.05).score).toBe(0);
  });

  it('soma o bônus só quando a unidade é diferente e limita em 1', () => {
    const outraUnidade = { ...bruno, unidade: 'B' };
    const base = calcularAfinidade(ana, bruno, idf, 0.05).score;
    expect(calcularAfinidade(ana, outraUnidade, idf, 0.05).score).toBeCloseTo(base + 0.05, 10);

    const igual = { tecnicas: [1, 2], hobbies: [4, 5, 6], unidade: 'B' };
    expect(calcularAfinidade(ana, igual, idf, 0.05).score).toBe(1);
  });

  it('tag presente em todos os perfis ainda conta como interesse em comum', () => {
    const todos = calcularIdf(5, new Map([[1, 5]]));
    expect(jaccardPonderado([1], [1], todos)).toBe(1);
  });

  it('duas pessoas com perfis idênticos numa base pequena não aparecem com afinidade zero', () => {
    const base = calcularIdf(
      2,
      new Map([
        [1, 2],
        [2, 2],
        [3, 2],
      ]),
    );
    const a = { tecnicas: [1, 2], hobbies: [3], unidade: 'A' };
    const b = { tecnicas: [1, 2], hobbies: [3], unidade: 'A' };
    expect(calcularAfinidade(a, b, base, 0).score).toBe(1);
  });
});
