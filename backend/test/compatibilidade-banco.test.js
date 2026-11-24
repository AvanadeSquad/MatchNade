import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarAmbiente } from './ajudante.js';

// Roda igual em PGlite e em PostgreSQL real (com TEST_DATABASE_URL) e confere que os dois
// devolvem os mesmos tipos e aplicam as mesmas restrições de que o código depende.
describe(`compatibilidade do banco (${process.env.TEST_DATABASE_URL ? 'PostgreSQL' : 'PGlite'})`, () => {
  let a;
  beforeAll(async () => {
    a = await criarAmbiente();
  });
  afterAll(() => a.fechar());

  it('contagens e bigint chegam como número, não como texto', async () => {
    const [linha] = await a.banco.query('SELECT COUNT(*) AS total, 5::bigint AS grande, 3::int AS pequeno FROM employee');
    expect(linha).toEqual({ total: 0, grande: 5, pequeno: 3 });
  });

  it('REAL, TIMESTAMPTZ e JSONB chegam como número, Date e array', async () => {
    const pessoa = await a.criarPessoa({ nome: 'Tipo Exemplo', objetivos: ['NETWORKING', 'MENTORIA'] });
    const [linha] = await a.banco.query(`SELECT connection_goals, created_at, 0.1234::real AS real FROM employee WHERE id = $1`, [
      pessoa.id,
    ]);
    expect(linha.connection_goals).toEqual(['NETWORKING', 'MENTORIA']);
    expect(linha.created_at).toBeInstanceOf(Date);
    expect(linha.real).toBeCloseTo(0.1234, 4);
  });

  it('o índice único parcial do par aceita uma nova conexão depois de expirar a anterior', async () => {
    const ana = await a.criarPessoa({ nome: 'Par Um' });
    const bia = await a.criarPessoa({ nome: 'Par Dois' });
    await a.banco.query(`INSERT INTO connection_match (requester_id, receiver_id, status) VALUES ($1, $2, 'EXPIRED')`, [ana.id, bia.id]);
    await a.banco.query(`INSERT INTO connection_match (requester_id, receiver_id, status) VALUES ($1, $2, 'PENDING')`, [bia.id, ana.id]);
    await expect(
      a.banco.query(`INSERT INTO connection_match (requester_id, receiver_id, status) VALUES ($1, $2, 'PENDING')`, [ana.id, bia.id]),
    ).rejects.toThrow();
  });

  it('ON CONFLICT sobre o índice de LOWER(name) ignora a repetição sem erro', async () => {
    await a.banco.query(`INSERT INTO interest_tag (name, category) VALUES ('Origami', 'HOBBY')`);
    const repetida = await a.banco.query(
      `INSERT INTO interest_tag (name, category) VALUES ('ORIGAMI', 'HOBBY') ON CONFLICT (LOWER(name)) DO NOTHING RETURNING id`,
    );
    expect(repetida).toEqual([]);
  });

  it('a trava consultiva de transação serializa duas transações do mesmo par', async () => {
    const ordem = [];
    const transacao = (rotulo, espera) =>
      a.banco.tx(async ({ query }) => {
        await query('SELECT pg_advisory_xact_lock($1, $2)', [1, 2]);
        ordem.push(`${rotulo}:inicio`);
        await new Promise((resolver) => setTimeout(resolver, espera));
        ordem.push(`${rotulo}:fim`);
      });
    await Promise.all([transacao('a', 50), transacao('b', 0)]);
    expect(ordem).toEqual(['a:inicio', 'a:fim', 'b:inicio', 'b:fim']);
  });
});
