import { randomUUID } from 'node:crypto';
import pg from 'pg';
import request from 'supertest';
import { criarApp } from '../src/app.js';
import { carregarConfig } from '../src/config/env.js';
import { criarBanco } from '../src/db/index.js';
import { criarSenhas } from '../src/services/senhas.js';

export const SEGREDO = 'segredo-de-teste-com-mais-de-trinta-e-dois-caracteres';

// Custo baixo do scrypt: nos testes o importante é a lógica, e o custo real deixaria a suíte lenta.
export const senhasDeTeste = () => criarSenhas({ N: 2 ** 10, r: 8, p: 1 });

export const configDeTeste = (extra = {}) => carregarConfig({ NODE_ENV: 'test', JWT_SECRET: SEGREDO, E2E_TEST_MODE: 'true', ...extra });

// Com TEST_DATABASE_URL os testes usam PostgreSQL real: cada ambiente ganha um schema próprio,
// criado vazio e apagado ao fechar, para arquivos rodando em paralelo não se enxergarem.
// Sem a variável, usa PGlite em memória.
async function criarBancoDeTeste() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return { banco: await criarBanco(), descartar: async () => {} };

  const schema = `teste_${randomUUID().replace(/-/g, '')}`;
  const admin = new pg.Client({ connectionString: url });
  await admin.connect();
  await admin.query(`CREATE SCHEMA ${schema}`);
  await admin.end();

  const comSchema = new URL(url);
  comSchema.searchParams.set('options', `-c search_path=${schema}`);
  const banco = await criarBanco({ databaseUrl: comSchema.toString() });
  const descartar = async () => {
    const limpeza = new pg.Client({ connectionString: url });
    await limpeza.connect();
    await limpeza.query(`DROP SCHEMA ${schema} CASCADE`);
    await limpeza.end();
  };
  return { banco, descartar };
}

// Cria um ambiente isolado: banco de teste, app Express e atalhos de teste.
export async function criarAmbiente({ ambiente = {}, ia, verificadorGoogle, senhas = senhasDeTeste() } = {}) {
  const config = configDeTeste(ambiente);
  const { banco, descartar } = await criarBancoDeTeste();
  const app = criarApp({ banco, config, ia, verificadorGoogle, senhas, limitarRequisicoes: false, registrarErro: () => {} });
  const http = request(app);
  const tokens = new Map();

  const ambienteDeTeste = {
    app,
    banco,
    config,
    http,

    async limpar() {
      await banco.exec(
        `TRUNCATE ai_interaction_log, employee_report, employee_block, chat_message, connection_match,
                  employee_interest, interest_tag, employee RESTART IDENTITY CASCADE`,
      );
      tokens.clear();
    },

    // Cria a pessoa direto no banco, com interesses. Devolve o id.
    async criarPessoa({
      nome,
      unidade = 'Cloud',
      tecnicas = [],
      hobbies = [],
      objetivos = ['NETWORKING'],
      cargo = null,
      cidade = 'Recife',
      pausado = false,
    }) {
      const email = `${nome.toLowerCase().replace(/\s+/g, '.')}@exemplo.test`;
      const [pessoa] = await banco.query(
        `INSERT INTO employee (auth_provider_id, name, email, position, department, location, connection_goals, is_paused)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8) RETURNING id`,
        [`teste-${email}`, nome, email, cargo, unidade, cidade, JSON.stringify(objetivos), pausado],
      );
      const categorias = [...tecnicas.map((n) => [n, 'TECHNICAL']), ...hobbies.map((n) => [n, 'HOBBY'])];
      for (const [tag, categoria] of categorias) {
        const [existente] = await banco.query('SELECT id FROM interest_tag WHERE name = $1', [tag]);
        const tagId =
          existente?.id ??
          (await banco.query('INSERT INTO interest_tag (name, category) VALUES ($1, $2) RETURNING id', [tag, categoria]))[0].id;
        await banco.query('INSERT INTO employee_interest (employee_id, interest_id) VALUES ($1, $2)', [pessoa.id, tagId]);
      }
      return { id: pessoa.id, email };
    },

    // Faz login pela rota de teste e devolve o cabeçalho de autorização.
    async entrar(email) {
      if (!tokens.has(email)) {
        const resposta = await http.post('/api/v1/test/login').send({ email });
        tokens.set(email, `Bearer ${resposta.body.token}`);
      }
      return tokens.get(email);
    },

    // Atalhos autenticados: como('a@exemplo.test').get('/matches').
    como(email) {
      const comAuth = (metodo) => async (caminho, corpo) => {
        const autorizacao = await this.entrar(email);
        const alvo = http[metodo](`/api/v1${caminho}`).set('Authorization', autorizacao);
        return corpo === undefined ? alvo : alvo.send(corpo);
      };
      return { get: comAuth('get'), post: comAuth('post'), put: comAuth('put'), patch: comAuth('patch'), delete: comAuth('delete') };
    },

    async fechar() {
      await banco.close();
      await descartar();
    },
  };
  return ambienteDeTeste;
}
