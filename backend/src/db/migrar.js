import { readdir, readFile } from 'node:fs/promises';

const pastaMigracoes = new URL('./migracoes/', import.meta.url);

// Chave da trava consultiva que impede duas instâncias de migrarem ao mesmo tempo.
const TRAVA_MIGRACOES = 724001;

// Lista as migrações em ordem pelo número do prefixo (001_, 002_...).
export async function listarMigracoes(pasta = pastaMigracoes) {
  const arquivos = (await readdir(pasta)).filter((nome) => /^\d{3}_.+\.sql$/.test(nome)).sort();
  return Promise.all(
    arquivos.map(async (nome) => ({ versao: Number(nome.slice(0, 3)), nome, sql: await readFile(new URL(nome, pasta), 'utf8') })),
  );
}

// Aplica, em ordem, as migrações ainda não registradas em schema_migrations. Cada migração roda
// na própria transação junto com o seu registro: se falhar, nada dela fica aplicado.
// Devolve os nomes das migrações aplicadas nesta chamada.
export async function migrar(banco, migracoes) {
  const lista = migracoes ?? (await listarMigracoes());
  await banco.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);

  const aplicadas = [];
  for (const migracao of lista) {
    const aplicou = await banco.tx(async ({ query, exec }) => {
      await query('SELECT pg_advisory_xact_lock($1)', [TRAVA_MIGRACOES]);
      const [registrada] = await query('SELECT 1 FROM schema_migrations WHERE version = $1', [migracao.versao]);
      if (registrada) return false;
      await exec(migracao.sql);
      await query('INSERT INTO schema_migrations (version, name) VALUES ($1, $2)', [migracao.versao, migracao.nome]);
      return true;
    });
    if (aplicou) aplicadas.push(migracao.nome);
  }
  return aplicadas;
}
