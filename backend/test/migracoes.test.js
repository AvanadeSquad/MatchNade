import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { listarMigracoes, migrar } from '../src/db/migrar.js';
import { criarAmbiente } from './ajudante.js';

const TABELAS = [
  'schema_migrations',
  'ai_interaction_log',
  'employee_report',
  'employee_block',
  'chat_message',
  'connection_match',
  'employee_interest',
  'interest_tag',
  'employee',
];

// Regra de exclusão da chave de ai_interaction_log para employee: 'c' (cascata) ou 'n' (SET NULL).
async function regraDoLogDeIa(banco) {
  const [linha] = await banco.query(
    // conrelid restringe à tabela do schema atual: outros schemas podem ter uma restrição de mesmo nome.
    `SELECT confdeltype FROM pg_constraint
      WHERE conname = 'ai_interaction_log_employee_id_fkey' AND conrelid = to_regclass('ai_interaction_log')`,
  );
  return linha?.confdeltype;
}

describe('migrações do banco', () => {
  let a;
  let migracoes;
  beforeAll(async () => {
    a = await criarAmbiente();
    migracoes = await listarMigracoes();
  });
  afterAll(() => a.fechar());

  // Começa cada teste de um banco vazio, sem nenhuma tabela da aplicação.
  beforeEach(async () => {
    await a.banco.exec(TABELAS.map((t) => `DROP TABLE IF EXISTS ${t} CASCADE;`).join('\n'));
  });

  it('as migrações são numeradas em sequência a partir de 001', () => {
    expect(migracoes.map((m) => m.versao)).toEqual(migracoes.map((_, i) => i + 1));
  });

  it('banco novo recebe todas as migrações em ordem e termina com o log de IA em cascata', async () => {
    const aplicadas = await migrar(a.banco);
    expect(aplicadas).toEqual(migracoes.map((m) => m.nome));
    const versoes = await a.banco.query('SELECT version FROM schema_migrations ORDER BY version');
    expect(versoes.map((v) => v.version)).toEqual(migracoes.map((m) => m.versao));
    expect(await regraDoLogDeIa(a.banco)).toBe('c');
  });

  it('banco antigo, criado sem schema_migrations, é adotado sem perder dados e passa a apagar o log em cascata', async () => {
    await a.banco.exec(migracoes[0].sql);
    expect(await regraDoLogDeIa(a.banco)).toBe('n');
    const [pessoa] = await a.banco.query(
      `INSERT INTO employee (auth_provider_id, name, email) VALUES ('antigo-1', 'Pessoa Antiga', 'antiga@exemplo.test') RETURNING id`,
    );
    await a.banco.query(
      `INSERT INTO ai_interaction_log (employee_id, prompt_type, prompt_version, status) VALUES ($1, 'EXTRACAO_TAGS', 'v1', 'OK')`,
      [pessoa.id],
    );

    await migrar(a.banco);

    expect(await regraDoLogDeIa(a.banco)).toBe('c');
    expect(await a.banco.query('SELECT name FROM employee')).toEqual([{ name: 'Pessoa Antiga' }]);
    await a.banco.query('DELETE FROM employee WHERE id = $1', [pessoa.id]);
    expect(await a.banco.query('SELECT 1 FROM ai_interaction_log')).toHaveLength(0);
  });

  it('reaplicar não tem efeito', async () => {
    await migrar(a.banco);
    const antes = await a.banco.query('SELECT version, applied_at FROM schema_migrations ORDER BY version');
    expect(await migrar(a.banco)).toEqual([]);
    expect(await a.banco.query('SELECT version, applied_at FROM schema_migrations ORDER BY version')).toEqual(antes);
  });

  it('uma migração que falha não fica registrada nem aplicada pela metade', async () => {
    await migrar(a.banco);
    const quebrada = {
      versao: 99,
      nome: '099_quebrada.sql',
      sql: 'CREATE TABLE tabela_parcial (id INT); SELECT coluna_que_nao_existe FROM employee;',
    };
    await expect(migrar(a.banco, [...migracoes, quebrada])).rejects.toThrow();
    expect(await a.banco.query('SELECT 1 FROM schema_migrations WHERE version = 99')).toHaveLength(0);
    const [{ existe }] = await a.banco.query(`SELECT to_regclass('tabela_parcial') IS NOT NULL AS existe`);
    expect(existe).toBe(false);
  });

  it('duas inicializações ao mesmo tempo aplicam cada migração uma vez só', async () => {
    const [um, outro] = await Promise.all([migrar(a.banco), migrar(a.banco)]);
    expect([...um, ...outro].sort()).toEqual(migracoes.map((m) => m.nome).sort());
  });
});
