import { performance } from 'node:perf_hooks';
import { carregarConfig } from '../src/config/env.js';
import { criarBanco } from '../src/db/index.js';
import { TAGS_HOBBY, TAGS_TECNICAS } from '../src/db/seed.js';
import { listarConexoes } from '../src/services/conexoes.js';
import { perfilDaPessoa } from '../src/services/pessoas.js';
import { recomendar } from '../src/services/recomendacoes.js';

// Mede o tempo das rotas que carregam a base de perfis, com 5 mil pessoas fictícias.
// Usa PGlite em memória; com MEDIR_DATABASE_URL usa esse PostgreSQL (o banco precisa estar vazio).
const PESSOAS = Number(process.env.MEDIR_PESSOAS || 5000);
const TAGS_POR_PESSOA = 6;
const REPETICOES = 20;

const config = carregarConfig({ NODE_ENV: 'test' });
const banco = await criarBanco({ databaseUrl: process.env.MEDIR_DATABASE_URL || undefined });

async function popular() {
  const tags = [...TAGS_TECNICAS.map((n) => [n, 'TECHNICAL']), ...TAGS_HOBBY.map((n) => [n, 'HOBBY'])];
  for (const [nome, categoria] of tags) {
    await banco.query('INSERT INTO interest_tag (name, category) VALUES ($1, $2)', [nome, categoria]);
  }
  await banco.query(
    `INSERT INTO employee (auth_provider_id, name, email, department, location)
     SELECT 'medir-' || n, 'Pessoa Fictícia ' || n, 'pessoa' || n || '@exemplo.test',
            'Unidade ' || (n % 8), 'Cidade ' || (n % 8)
       FROM generate_series(1, $1::int) AS n`,
    [PESSOAS],
  );
  // Cada pessoa recebe tags determinísticas espalhadas pelo catálogo.
  await banco.query(
    `INSERT INTO employee_interest (employee_id, interest_id)
     SELECT DISTINCT e.id, 1 + ((e.id * 7 + k * 13 + k * k) % $2::int)
       FROM employee e CROSS JOIN generate_series(0, $1::int - 1) AS k`,
    [TAGS_POR_PESSOA, tags.length],
  );
  // A pessoa 1 tem 40 conexões, metade aceitas, para a lista de conexões ter conteúdo.
  await banco.query(
    `INSERT INTO connection_match (requester_id, receiver_id, status, responded_at)
     SELECT 1, n, CASE WHEN n % 2 = 0 THEN 'ACCEPTED' ELSE 'PENDING' END, CASE WHEN n % 2 = 0 THEN NOW() END
       FROM generate_series(2, 41) AS n`,
  );
}

async function medir(nome, fn) {
  await fn();
  const tempos = [];
  for (let i = 0; i < REPETICOES; i += 1) {
    const inicio = performance.now();
    await fn();
    tempos.push(performance.now() - inicio);
  }
  tempos.sort((a, b) => a - b);
  const mediana = tempos[Math.floor(tempos.length / 2)];
  const p90 = tempos[Math.floor(tempos.length * 0.9)];
  console.log(`${nome.padEnd(38)} mediana ${mediana.toFixed(1).padStart(7)} ms   p90 ${p90.toFixed(1).padStart(7)} ms`);
}

await popular();
const ctx = { banco, config };
console.log(`Banco: ${banco.tipo}, ${PESSOAS} pessoas, ${TAGS_POR_PESSOA} tags cada, ${REPETICOES} repetições`);
await medir('GET /matches/recommendations', () => recomendar(ctx, 1, 20));
await medir('GET /matches (lista de conexões)', () => listarConexoes(ctx, 1, { marcarVisto: false }));
await medir('GET /employees/:id', () => perfilDaPessoa(ctx, 1, 4000));
await banco.close();
