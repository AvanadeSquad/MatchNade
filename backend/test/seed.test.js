import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { montarPessoas, semear, TAGS_HOBBY, TAGS_TECNICAS } from '../src/db/seed.js';
import { criarAmbiente } from './ajudante.js';

describe('seed do banco', () => {
  let a;
  beforeAll(async () => {
    a = await criarAmbiente();
  });
  afterAll(() => a.fechar());

  it('duas chamadas ao mesmo tempo num banco vazio inserem os dados uma vez só', async () => {
    await a.limpar();
    const resultados = await Promise.all([semear(a.banco), semear(a.banco)]);
    expect(resultados.sort()).toEqual([false, true]);

    const [{ pessoas }] = await a.banco.query('SELECT COUNT(*)::int AS pessoas FROM employee');
    const [{ tags }] = await a.banco.query('SELECT COUNT(*)::int AS tags FROM interest_tag');
    expect(pessoas).toBe(montarPessoas().length);
    expect(tags).toBe(TAGS_TECNICAS.length + TAGS_HOBBY.length);
  });

  it('não insere nada quando o banco já tem pessoas', async () => {
    expect(await semear(a.banco)).toBe(false);
  });
});
