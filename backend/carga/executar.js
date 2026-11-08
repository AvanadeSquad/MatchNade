import autocannon from 'autocannon';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { criarBanco } from '../src/db/index.js';
import { montarPessoas, semear } from '../src/db/seed.js';
import { BancoComDadosAlheios, exigirBancoSemDadosAlheios } from './trava.js';

// Teste de carga da API. Sobe a API num processo próprio, dispara os cenários com o autocannon e
// derruba tudo no fim. Variáveis:
//   CARGA_PERFIS     total de perfis no banco (o seed tem 30; o que faltar é inserido com 3 a 6 interesses)
//   CARGA_DURACAO    segundos por cenário (padrão 10)
//   CARGA_CONEXOES   conexões simultâneas, separadas por vírgula (padrão 10,50)
//   CARGA_PORTA      porta da API (padrão 3200)
//   DATABASE_URL     PostgreSQL vazio (ou já preparado por este script) para usar no lugar do PGlite.
//                    Um banco com pessoas que não vêm do seed nem deste script é recusado antes de qualquer escrita.
//   CARGA_SAIDA      arquivo JSON para gravar os resultados
const PERFIS = Number(process.env.CARGA_PERFIS || 30);
const DURACAO = Number(process.env.CARGA_DURACAO || 10);
const CONEXOES = (process.env.CARGA_CONEXOES || '10,50').split(',').map(Number);
const PORTA = Number(process.env.CARGA_PORTA || 3200);
const DATABASE_URL = process.env.DATABASE_URL || '';
const BASE = `http://127.0.0.1:${PORTA}/api/v1`;
const SENHA = 'senha-de-carga-123';
const EMAIL_LOCAL = 'carga.local@exemplo.test';
// Pessoas usadas como remetentes no cenário de POST /matches.
const REMETENTES_MAX = 200;
const pastaBackend = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// Confere o banco de DATABASE_URL antes de qualquer escrita, inclusive das migrações.
async function conferirBanco() {
  if (!DATABASE_URL) return;
  const cliente = new pg.Client({ connectionString: DATABASE_URL });
  await cliente.connect();
  try {
    await exigirBancoSemDadosAlheios(async (sql, parametros) => (await cliente.query(sql, parametros)).rows, {
      emailsDoSeed: montarPessoas().map((p) => p.email),
      emailDoScript: EMAIL_LOCAL,
    });
  } finally {
    await cliente.end();
  }
}

async function prepararBanco(dataDir) {
  const banco = await criarBanco({ databaseUrl: DATABASE_URL || undefined, dataDir });
  await semear(banco, { demonstracao: false });
  const [{ total }] = await banco.query('SELECT COUNT(*)::int AS total FROM employee');
  const faltam = Math.max(0, PERFIS - total);
  if (faltam) {
    await banco.query(
      `INSERT INTO employee (auth_provider_id, name, email, department, location, connection_goals)
       SELECT 'carga-' || n, 'Pessoa de Carga ' || n, 'carga' || n || '@exemplo.test',
              'Unidade ' || (n % 8), 'Cidade ' || (n % 8), '["NETWORKING"]'::jsonb
         FROM generate_series(1, $1::int) AS n`,
      [faltam],
    );
    // De 3 a 6 interesses por perfil, espalhados de forma determinística pelo catálogo do seed.
    await banco.query(
      `INSERT INTO employee_interest (employee_id, interest_id, source)
       SELECT DISTINCT e.id, t.ids[1 + ((e.id * 7 + k * 13 + k * k) % array_length(t.ids, 1))], 'MANUAL'
         FROM employee e
        CROSS JOIN (SELECT array_agg(id ORDER BY id) AS ids FROM interest_tag) t
        CROSS JOIN generate_series(0, 5) AS k
        WHERE e.auth_provider_id LIKE 'carga-%' AND k < 3 + (e.id % 4)`,
    );
  }
  await banco.query('UPDATE employee SET max_weekly_matches = 5');
  const [{ pessoas }] = await banco.query('SELECT COUNT(*)::int AS pessoas FROM employee');
  const [{ incompletos }] = await banco.query(
    `SELECT COUNT(*)::int AS incompletos FROM employee e
      WHERE (SELECT COUNT(*) FROM employee_interest i WHERE i.employee_id = e.id) < 3`,
  );
  await banco.close();
  return { pessoas, incompletos };
}

function subirApi(dataDir) {
  const env = {
    ...process.env,
    PORT: String(PORTA),
    NODE_ENV: 'test',
    E2E_TEST_MODE: 'true',
    RATE_LIMIT_DISABLED: 'true',
    JWT_SECRET: randomBytes(32).toString('hex'),
    LOG_LEVEL: 'silent',
    SEED_ON_START: 'false',
    ALLOWED_EMAILS: '',
    ALLOWED_EMAIL_DOMAINS: '',
    DATABASE_URL,
    PGLITE_DATA_DIR: dataDir ?? '',
  };
  return spawn(process.execPath, ['src/index.js'], { cwd: pastaBackend, env, stdio: ['ignore', 'ignore', 'inherit'] });
}

async function esperarApi() {
  for (let i = 0; i < 300; i += 1) {
    try {
      if ((await fetch(`${BASE}/health/ready`)).ok) return;
    } catch {
      // Ainda subindo.
    }
    await new Promise((ok) => setTimeout(ok, 200));
  }
  throw new Error('A API não respondeu a tempo.');
}

async function postar(caminho, corpo, token) {
  const resposta = await fetch(`${BASE}${caminho}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(corpo),
  });
  if (!resposta.ok) throw new Error(`${caminho}: HTTP ${resposta.status}`);
  return resposta.json();
}

// Espera a API esvaziar a fila do cenário anterior: as requisições abandonadas pelo timeout continuam
// sendo processadas e atrapalhariam a medição seguinte.
async function esperarFilaVazia(token) {
  for (let i = 0; i < 120; i += 1) {
    const inicio = Date.now();
    try {
      await fetch(`${BASE}/profile`, { headers: { authorization: `Bearer ${token}` } });
      if (Date.now() - inicio < 500) return;
    } catch {
      // A API ainda está ocupada.
    }
    await new Promise((ok) => setTimeout(ok, 1000));
  }
}

const percentil = (ordenados, p) => ordenados[Math.min(ordenados.length - 1, Math.ceil((p / 100) * ordenados.length) - 1)] ?? 0;

// Roda um cenário e calcula os percentis a partir do tempo de cada resposta.
function rodar(nome, conexoes, opcoes) {
  return new Promise((ok, falha) => {
    const tempos = [];
    const instancia = autocannon({ url: BASE, connections: conexoes, duration: DURACAO, ...opcoes }, (erro, resultado) => {
      if (erro) return falha(erro);
      tempos.sort((a, b) => a - b);
      // `errors` já inclui os timeouts, que não entram em `requests.total`.
      const total = resultado.requests.total + resultado.errors;
      const erros = resultado.non2xx + resultado.errors;
      ok({
        cenario: nome,
        conexoes,
        rps: Math.round((resultado.requests.total / resultado.duration) * 10) / 10,
        p50: percentil(tempos, 50),
        p95: percentil(tempos, 95),
        p99: percentil(tempos, 99),
        requisicoes: total,
        timeouts: resultado.timeouts,
        taxaErro: total ? Math.round((erros / total) * 1000) / 10 : 0,
        status: resultado.statusCodeStats,
      });
    });
    instancia.on('response', (_cliente, _status, _bytes, tempo) => tempos.push(Math.round(tempo * 10) / 10));
  });
}

async function principal() {
  await conferirBanco();
  const dataDir = DATABASE_URL ? undefined : await mkdtemp(path.join(os.tmpdir(), 'matchnade-carga-'));
  const { pessoas, incompletos } = await prepararBanco(dataDir);
  const api = subirApi(dataDir);
  try {
    await esperarApi();
    const emails = montarPessoas().map((p) => p.email);
    const { token, employee } = await postar('/test/login', { email: emails[0] });
    await postar('/auth/register', {
      name: 'Pessoa de Carga',
      email: EMAIL_LOCAL,
      password: SENHA,
      security_question_id: 'primeiro_pet',
      security_answer: 'Resposta ficticia',
    });

    // Remetentes e destinatários do POST /matches: pares diferentes a cada requisição, até a cota acabar.
    const extras = Array.from(
      { length: Math.max(0, Math.min(REMETENTES_MAX, pessoas) - emails.length) },
      (_, i) => `carga${i + 1}@exemplo.test`,
    );
    const remetentes = [];
    for (const email of [...emails, ...extras].slice(0, REMETENTES_MAX)) {
      const sessao = await postar('/test/login', { email });
      remetentes.push({ token: sessao.token, id: sessao.employee.id });
    }
    let indice = 0;
    const proximoPedido = (requisicao) => {
      const remetente = remetentes[indice % remetentes.length];
      const destino = remetentes[(indice + 1 + Math.floor(indice / remetentes.length)) % remetentes.length];
      indice += 1;
      return {
        ...requisicao,
        headers: { ...requisicao.headers, authorization: `Bearer ${remetente.token}` },
        body: JSON.stringify({ receiver_id: destino.id }),
      };
    };

    const autenticado = { authorization: `Bearer ${token}` };
    const cenarios = [
      ['GET /profile', { path: '/api/v1/profile', headers: autenticado }],
      ['GET /matches/recommendations', { path: '/api/v1/matches/recommendations?limit=20', headers: autenticado }],
      [
        'POST /matches',
        {
          requests: [
            { method: 'POST', path: '/api/v1/matches', headers: { 'content-type': 'application/json' }, setupRequest: proximoPedido },
          ],
        },
      ],
      ['GET /matches', { path: '/api/v1/matches?peek=true', headers: autenticado }],
      [
        'POST /auth/login',
        {
          method: 'POST',
          path: '/api/v1/auth/login',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: EMAIL_LOCAL, password: SENHA }),
        },
      ],
    ];

    const resultados = [];
    for (const conexoes of CONEXOES) {
      for (const [nome, { path: caminho, ...resto }] of cenarios) {
        const opcoes = caminho ? { ...resto, url: `http://127.0.0.1:${PORTA}${caminho}` } : resto;
        await esperarFilaVazia(token);
        const resultado = await rodar(nome, conexoes, opcoes);
        resultados.push(resultado);
        console.log(
          `| ${nome} | ${conexoes} | ${resultado.rps} | ${resultado.p50} | ${resultado.p95} | ${resultado.p99} | ${resultado.taxaErro}% |`,
        );
      }
    }

    const resumo = {
      data: new Date().toISOString(),
      banco: DATABASE_URL ? 'postgres' : 'pglite',
      pessoas,
      perfisComMenosDe3Interesses: incompletos,
      pessoaPrincipal: employee.id,
      duracaoPorCenario: DURACAO,
      maquina: {
        cpus: os.cpus().length,
        modelo: os.cpus()[0]?.model,
        memoriaGb: Math.round(os.totalmem() / 2 ** 30),
        node: process.version,
      },
      resultados,
    };
    if (process.env.CARGA_SAIDA) await writeFile(process.env.CARGA_SAIDA, JSON.stringify(resumo, null, 2));
    console.log(`Banco: ${resumo.banco}, ${pessoas} perfis (${incompletos} com menos de 3 interesses), ${DURACAO} s por cenário.`);
  } finally {
    api.kill('SIGTERM');
    await new Promise((ok) => api.once('exit', ok));
    if (dataDir) await rm(dataDir, { recursive: true, force: true });
  }
}

try {
  await principal();
} catch (erro) {
  if (!(erro instanceof BancoComDadosAlheios)) throw erro;
  console.error(erro.message);
  process.exitCode = 1;
}
