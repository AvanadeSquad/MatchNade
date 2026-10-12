import request from 'supertest';
import { criarApp } from '../src/app.js';
import { carregarConfig } from '../src/config/env.js';
import { criarBanco } from '../src/db/index.js';

export const SEGREDO = 'segredo-de-teste-com-mais-de-trinta-e-dois-caracteres';

export const configDeTeste = (extra = {}) =>
  carregarConfig({ NODE_ENV: 'test', JWT_SECRET: SEGREDO, E2E_TEST_MODE: 'true', ...extra });

// Cria um ambiente isolado: banco PGlite em memória, app Express e atalhos de teste.
export async function criarAmbiente({ ambiente = {}, ia, verificadorGoogle } = {}) {
  const config = configDeTeste(ambiente);
  const banco = await criarBanco();
  const app = criarApp({ banco, config, ia, verificadorGoogle, limitarRequisicoes: false, registrarErro: () => {} });
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
    async criarPessoa({ nome, unidade = 'Cloud', tecnicas = [], hobbies = [], objetivos = ['NETWORKING'], cargo = null, cidade = 'Recife', pausado = false }) {
      const email = `${nome.toLowerCase().replace(/\s+/g, '.')}@exemplo.test`;
      const [pessoa] = await banco.query(
        `INSERT INTO employee (auth_provider_id, name, email, position, department, location, connection_goals, is_paused)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8) RETURNING id`,
        [`teste-${email}`, nome, email, cargo, unidade, cidade, JSON.stringify(objetivos), pausado],
      );
      const categorias = [
        ...tecnicas.map((n) => [n, 'TECHNICAL']),
        ...hobbies.map((n) => [n, 'HOBBY']),
      ];
      for (const [tag, categoria] of categorias) {
        const [existente] = await banco.query('SELECT id FROM interest_tag WHERE name = $1', [tag]);
        const tagId =
          existente?.id ?? (await banco.query('INSERT INTO interest_tag (name, category) VALUES ($1, $2) RETURNING id', [tag, categoria]))[0].id;
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

    fechar: () => banco.close(),
  };
  return ambienteDeTeste;
}
