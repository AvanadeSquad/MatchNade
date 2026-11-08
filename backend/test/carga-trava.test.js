import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { BancoComDadosAlheios, exigirBancoSemDadosAlheios } from '../carga/trava.js';
import { criarBanco } from '../src/db/index.js';
import { montarPessoas } from '../src/db/seed.js';

const EMAIL_DO_SCRIPT = 'carga.local@exemplo.test';
const emailsDoSeed = montarPessoas().map((p) => p.email);

describe('trava do teste de carga', () => {
  let banco;
  const conferir = () =>
    exigirBancoSemDadosAlheios((sql, parametros) => banco.query(sql, parametros), { emailsDoSeed, emailDoScript: EMAIL_DO_SCRIPT });
  const inserir = (email) =>
    banco.query('INSERT INTO employee (auth_provider_id, name, email) VALUES ($1, $2, $3)', [`teste-${email}`, 'Pessoa', email]);

  beforeAll(async () => {
    banco = await criarBanco();
  });
  afterAll(() => banco.close());
  beforeEach(() => banco.exec('TRUNCATE employee RESTART IDENTITY CASCADE'));

  it('aceita o banco vazio', async () => {
    await expect(conferir()).resolves.toBeUndefined();
  });

  it('aceita um banco já preparado pelo seed e pelo próprio script', async () => {
    await inserir(emailsDoSeed[0]);
    await inserir(emailsDoSeed[1]);
    await inserir('carga1@exemplo.test');
    await inserir('carga10000@exemplo.test');
    await inserir(EMAIL_DO_SCRIPT);
    await expect(conferir()).resolves.toBeUndefined();
  });

  it('recusa quando há uma pessoa que não vem do seed nem do script', async () => {
    await inserir(emailsDoSeed[0]);
    await inserir('maria.real@empresa.com');
    await expect(conferir()).rejects.toBeInstanceOf(BancoComDadosAlheios);
  });

  it('conta as pessoas alheias na mensagem', async () => {
    await inserir('a@empresa.com');
    await inserir('b@empresa.com');
    await expect(conferir()).rejects.toThrow(/2 pessoas/);
  });

  it('recusa e-mail que só se parece com o do script', async () => {
    await inserir('carga@empresa.com');
    await inserir('xcarga1@exemplo.test');
    await expect(conferir()).rejects.toThrow(/2 pessoas/);
  });

  it('aceita um banco novo, sem a tabela employee', async () => {
    const consultas = [];
    const semTabela = async (sql) => {
      consultas.push(sql);
      return [{ existe: false }];
    };
    await expect(exigirBancoSemDadosAlheios(semTabela, { emailsDoSeed, emailDoScript: EMAIL_DO_SCRIPT })).resolves.toBeUndefined();
    expect(consultas).toHaveLength(1);
  });
});

// O script inteiro, contra um PostgreSQL real: só roda no CI ou com TEST_DATABASE_URL.
describe.skipIf(!process.env.TEST_DATABASE_URL)('npm run carga contra um PostgreSQL com dados alheios', () => {
  const url = process.env.TEST_DATABASE_URL;
  const schema = `teste_${randomUUID().replace(/-/g, '')}`;
  let urlDoSchema;
  let banco;

  beforeAll(async () => {
    const admin = new pg.Client({ connectionString: url });
    await admin.connect();
    await admin.query(`CREATE SCHEMA ${schema}`);
    await admin.end();
    const comSchema = new URL(url);
    comSchema.searchParams.set('options', `-c search_path=${schema}`);
    urlDoSchema = comSchema.toString();
    banco = await criarBanco({ databaseUrl: urlDoSchema });
  });

  afterAll(async () => {
    await banco.close();
    const limpeza = new pg.Client({ connectionString: url });
    await limpeza.connect();
    await limpeza.query(`DROP SCHEMA ${schema} CASCADE`);
    await limpeza.end();
  });

  it('sai com erro, explica o motivo e não altera nenhuma pessoa', async () => {
    await banco.query(
      `INSERT INTO employee (auth_provider_id, name, email, max_weekly_matches) VALUES ('x', 'Maria Real', 'maria.real@empresa.com', 2)`,
    );
    const r = spawnSync(process.execPath, ['carga/executar.js'], {
      cwd: new URL('..', import.meta.url),
      env: { ...process.env, DATABASE_URL: urlDoSchema, CARGA_PERFIS: '40', CARGA_DURACAO: '1' },
      encoding: 'utf-8',
      timeout: 60_000,
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('não vêm do seed nem do teste de carga');
    const pessoas = await banco.query('SELECT email, max_weekly_matches FROM employee');
    expect(pessoas).toEqual([{ email: 'maria.real@empresa.com', max_weekly_matches: 2 }]);
  });
});
