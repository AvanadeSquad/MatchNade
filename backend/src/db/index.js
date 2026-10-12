import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import { migrar } from './migrar.js';

// Cria a conexão com o banco. Com databaseUrl usa PostgreSQL via pg; sem ela usa
// PGlite (PostgreSQL em processo), em memória ou persistido em dataDir.
// A interface é a mesma nos dois casos:
//   query(texto, params) -> linhas
//   exec(texto) -> executa um ou mais comandos sem parâmetros
//   tx(fn) -> executa fn({ query, exec }) em transação
//   close()
export async function criarBanco({ databaseUrl, dataDir } = {}) {
  let banco;

  if (databaseUrl) {
    // O SSL é definido pelo parâmetro sslmode da própria URL (Neon e Supabase já o incluem).
    const pool = new pg.Pool({ connectionString: databaseUrl, statement_timeout: 10000, max: 10 });
    // Conexões ociosas derrubadas pelo servidor emitem 'error'; sem ouvinte, o processo cairia.
    pool.on('error', (erro) => console.error('Conexão ociosa do banco encerrada:', erro.message));
    banco = {
      tipo: 'postgres',
      query: async (texto, params = []) => (await pool.query(texto, params)).rows,
      exec: async (texto) => {
        await pool.query(texto);
      },
      tx: async (fn) => {
        const cliente = await pool.connect();
        try {
          await cliente.query('BEGIN');
          const resultado = await fn({
            query: async (t, p = []) => (await cliente.query(t, p)).rows,
            exec: async (t) => {
              await cliente.query(t);
            },
          });
          await cliente.query('COMMIT');
          return resultado;
        } catch (erro) {
          await cliente.query('ROLLBACK').catch(() => {});
          throw erro;
        } finally {
          cliente.release();
        }
      },
      close: () => pool.end(),
    };
  } else {
    const pglite = dataDir ? new PGlite(dataDir) : new PGlite();
    await pglite.waitReady;
    banco = {
      tipo: 'pglite',
      query: async (texto, params = []) => (await pglite.query(texto, params)).rows,
      exec: async (texto) => {
        await pglite.exec(texto);
      },
      tx: (fn) =>
        pglite.transaction((cliente) =>
          fn({
            query: async (t, p = []) => (await cliente.query(t, p)).rows,
            exec: async (t) => {
              await cliente.exec(t);
            },
          }),
        ),
      close: () => pglite.close(),
    };
  }

  await migrar(banco);
  return banco;
}
