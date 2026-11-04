import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { montarPessoas, semear, SENHA_DEMONSTRACAO, TAGS_HOBBY, TAGS_TECNICAS } from '../src/db/seed.js';
import { verificarHash } from '../src/services/autenticacao.js';
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

  it('pessoas ficticias conseguem fazer login com a senha de demonstracao, armazenada como hash', async () => {
    const [ana] = await a.banco.query(
      'SELECT password_hash FROM employee WHERE email = $1',
      ['ana.silva@exemplo.test'],
    );
    expect(ana.password_hash).toMatch(/^scrypt\$/);
    expect(ana.password_hash).not.toContain(SENHA_DEMONSTRACAO);
    expect(await verificarHash(SENHA_DEMONSTRACAO, ana.password_hash)).toBe(true);

    const resultado = await a.http.post('/api/v1/auth/login').send({
      email: 'ana.silva@exemplo.test',
      password: SENHA_DEMONSTRACAO,
    });
    expect(resultado.status).toBe(200);
    expect(resultado.body.token).toEqual(expect.any(String));
  });

  it('não insere nada quando o banco já tem pessoas', async () => {
    expect(await semear(a.banco)).toBe(false);
  });
});
