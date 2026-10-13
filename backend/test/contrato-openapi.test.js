import { readFile } from 'node:fs/promises';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { criarApp } from '../src/app.js';
import { gerarEspecificacao } from '../src/openapi/especificacao.js';
import { criarAmbiente } from './ajudante.js';

// As rotas de desenvolvimento e de teste entram na especificação, então precisam existir no app.
const AMBIENTE = { AUTH_DEV_LOGIN: 'true', E2E_TEST_MODE: 'true' };

const METODOS = ['get', 'post', 'put', 'patch', 'delete'];

// Rotas registradas no roteador montado em /api/v1, no formato "GET /matches/{id}".
function rotasDoExpress(app) {
  const api = app.router.stack.find((camada) => camada.handle?.stack?.some((filha) => filha.route?.path === '/health'));
  const rotas = [];
  const visitar = (pilha) => {
    for (const camada of pilha) {
      if (camada.route) {
        for (const metodo of Object.keys(camada.route.methods)) {
          rotas.push(`${metodo.toUpperCase()} ${camada.route.path.replace(/:(\w+)/g, '{$1}')}`);
        }
      } else if (camada.handle?.stack) {
        visitar(camada.handle.stack);
      }
    }
  };
  visitar(api.handle.stack);
  return rotas.sort();
}

const rotasDaEspecificacao = (especificacao) =>
  Object.entries(especificacao.paths)
    .flatMap(([caminho, operacoes]) =>
      Object.keys(operacoes)
        .filter((m) => METODOS.includes(m))
        .map((m) => `${m.toUpperCase()} ${caminho}`),
    )
    .sort();

const operacoesDa = (especificacao) =>
  Object.entries(especificacao.paths).flatMap(([caminho, operacoes]) =>
    Object.entries(operacoes)
      .filter(([metodo]) => METODOS.includes(metodo))
      .map(([metodo, op]) => ({ caminho, metodo, op })),
  );

const parametrosEm = (op, local) =>
  (op.parameters ?? [])
    .filter((p) => p.in === local)
    .map((p) => p.name)
    .sort();

// Schema de resposta JSON da especificação, convertido de volta para zod para validar respostas reais.
const schemaDaResposta = (especificacao, caminho, metodo, status) =>
  z.fromJSONSchema(especificacao.paths[caminho][metodo].responses[status].content['application/json'].schema);

// Registra as chaves de req.query que as rotas leem durante uma requisição.
function espionarConsulta() {
  const original = Object.getOwnPropertyDescriptor(express.request, 'query');
  const lidas = new Set();
  Object.defineProperty(express.request, 'query', {
    configurable: true,
    enumerable: true,
    get() {
      const consulta = original.get.call(this);
      return new Proxy(consulta, {
        get(alvo, chave, receptor) {
          if (typeof chave === 'string') lidas.add(chave);
          return Reflect.get(alvo, chave, receptor);
        },
      });
    },
  });
  return { lidas, restaurar: () => Object.defineProperty(express.request, 'query', original) };
}

describe('contrato OpenAPI', () => {
  const especificacao = gerarEspecificacao();
  let a;
  let pessoa;
  let ids;
  beforeAll(async () => {
    a = await criarAmbiente({ ambiente: AMBIENTE, ia: { extrairTags: vi.fn(), gerarQuebraGelo: vi.fn() } });
    pessoa = await a.criarPessoa({ nome: 'Contrato Exemplo', tecnicas: ['React', 'Node.js'], hobbies: ['Xadrez'] });
    const outra = await a.criarPessoa({ nome: 'Contrato Par', tecnicas: ['React', 'Node.js'], hobbies: ['Xadrez'] });
    await a.como(pessoa.email).post('/matches', { receiver_id: outra.id });
    const { body } = await a.como(outra.email).post('/matches', { receiver_id: pessoa.id });
    ids = { '/matches': body.match_id, '/employees': outra.id };
  });
  afterAll(() => a.fechar());

  const comIdReal = (caminho) => {
    const prefixo = Object.keys(ids).find((p) => caminho.startsWith(p));
    return caminho.replace('{id}', String(ids[prefixo]));
  };

  it('o openapi.json publicado está igual ao gerado a partir das rotas (rode npm run openapi)', async () => {
    const publicado = JSON.parse(await readFile(new URL('../openapi.json', import.meta.url), 'utf8'));
    expect(publicado).toEqual(especificacao);
  });

  it('toda rota do Express está na especificação e toda operação da especificação existe', () => {
    expect(rotasDaEspecificacao(especificacao)).toEqual(rotasDoExpress(a.app));
  });

  it('os parâmetros de caminho declarados são exatamente os do caminho', () => {
    for (const { caminho, metodo, op } of operacoesDa(especificacao)) {
      const doCaminho = [...caminho.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      expect(parametrosEm(op, 'path'), `${metodo} ${caminho}`).toEqual(doCaminho);
    }
  });

  it('cada rota lê de req.query exatamente os parâmetros de consulta declarados', async () => {
    const autorizacao = await a.entrar(pessoa.email);
    const espiao = espionarConsulta();
    try {
      for (const { caminho, metodo, op } of operacoesDa(especificacao).filter((o) => o.metodo === 'get')) {
        espiao.lidas.clear();
        await a.http.get(`/api/v1${comIdReal(caminho)}`).set('Authorization', autorizacao);
        expect([...espiao.lidas].sort(), `${metodo} ${caminho}`).toEqual(parametrosEm(op, 'query'));
      }
    } finally {
      espiao.restaurar();
    }
  });

  it('a exigência de login declarada é a que a rota aplica', async () => {
    for (const { caminho, metodo, op } of operacoesDa(especificacao)) {
      const resposta = await a.http[metodo](`/api/v1${comIdReal(caminho)}`);
      const exigeLogin = op.security.length > 0;
      expect(resposta.status === 401, `${metodo} ${caminho} devolveu ${resposta.status}`).toBe(exigeLogin);
    }
  });

  it('toda operação descreve as respostas e as protegidas declaram 401', () => {
    for (const [caminho, operacoes] of Object.entries(especificacao.paths)) {
      for (const [metodo, operacao] of Object.entries(operacoes)) {
        expect(Object.keys(operacao.responses).length, `${metodo} ${caminho}`).toBeGreaterThan(0);
        if (operacao.security.length) expect(operacao.responses, `${metodo} ${caminho}`).toHaveProperty('401');
      }
    }
  });
});

describe('respostas tipadas', () => {
  const especificacao = gerarEspecificacao();
  const recomendacoes = schemaDaResposta(especificacao, '/matches/recommendations', 'get', 200);
  const perfilPublico = schemaDaResposta(especificacao, '/employees/{id}', 'get', 200);
  let a;
  beforeAll(async () => {
    a = await criarAmbiente({ ambiente: AMBIENTE, ia: { extrairTags: vi.fn(), gerarQuebraGelo: vi.fn() } });
  });
  afterAll(() => a.fechar());

  it('recomendações e perfil de outra pessoa seguem a especificação, sem cargo e bio antes do match', async () => {
    const eu = await a.criarPessoa({ nome: 'Tipada Exemplo', tecnicas: ['React', 'Node.js'], hobbies: ['Xadrez'] });
    const outra = await a.criarPessoa({ nome: 'Tipada Par', cargo: 'Cargo Fictício', tecnicas: ['React', 'Node.js'], hobbies: ['Xadrez'] });
    await a.banco.query('UPDATE employee SET bio = $1 WHERE id = $2', ['Bio fictícia.', outra.id]);

    const sugestoes = await a.como(eu.email).get('/matches/recommendations');
    expect(sugestoes.status).toBe(200);
    expect(sugestoes.body.recommendations.map((r) => r.employee_id)).toContain(outra.id);
    expect(recomendacoes.safeParse(sugestoes.body).success).toBe(true);

    const antes = await a.como(eu.email).get(`/employees/${outra.id}`);
    expect(antes.status).toBe(200);
    expect(antes.body).not.toHaveProperty('position');
    expect(antes.body).not.toHaveProperty('bio');
    expect(perfilPublico.safeParse(antes.body).success).toBe(true);

    await a.como(eu.email).post('/matches', { receiver_id: outra.id });
    const pendente = await a.como(eu.email).get(`/employees/${outra.id}`);
    expect(pendente.body.connection.status).toBe('PENDING');
    expect(perfilPublico.safeParse(pendente.body).success).toBe(true);

    await a.como(outra.email).post('/matches', { receiver_id: eu.id });
    const depois = await a.como(eu.email).get(`/employees/${outra.id}`);
    expect(depois.body).toMatchObject({ position: 'Cargo Fictício', bio: 'Bio fictícia.', connection: { status: 'ACCEPTED' } });
    expect(perfilPublico.safeParse(depois.body).success).toBe(true);
  });

  it('o contrato recusa campos a mais: cargo ou bio antes do match, ou qualquer campo novo', async () => {
    const eu = await a.criarPessoa({ nome: 'Vazamento Exemplo', tecnicas: ['Go', 'Rust'], hobbies: ['Corrida'] });
    const outra = await a.criarPessoa({ nome: 'Vazamento Par', cargo: 'Cargo Fictício', tecnicas: ['Go', 'Rust'], hobbies: ['Corrida'] });
    const { body } = await a.como(eu.email).get(`/employees/${outra.id}`);
    expect(perfilPublico.safeParse(body).success).toBe(true);
    expect(perfilPublico.safeParse({ ...body, position: 'Cargo Fictício' }).success).toBe(false);
    expect(perfilPublico.safeParse({ ...body, bio: 'Bio fictícia.' }).success).toBe(false);
    expect(perfilPublico.safeParse({ ...body, email: 'vazamento@exemplo.test' }).success).toBe(false);

    const { body: lista } = await a.como(eu.email).get('/matches/recommendations');
    expect(recomendacoes.safeParse(lista).success).toBe(true);
    const comCargo = { ...lista, recommendations: lista.recommendations.map((r) => ({ ...r, position: 'Cargo Fictício' })) };
    expect(lista.recommendations.length).toBeGreaterThan(0);
    expect(recomendacoes.safeParse(comCargo).success).toBe(false);
  });

  it('o 429 do limite de requisições é JSON no formato de erro da API', async () => {
    const app = criarApp({ banco: a.banco, config: a.config, ia: {}, limitarRequisicoes: true, registrarErro: () => {} });
    const agente = request.agent(app);
    let resposta;
    for (let i = 0; i < 31; i += 1) resposta = await agente.get('/api/v1/auth/dev-users');
    expect(resposta.status).toBe(429);
    expect(resposta.headers['content-type']).toMatch(/^application\/json/);
    expect(resposta.body).toEqual({ code: 'LIMITE_EXCEDIDO', message: expect.any(String) });
    const erro = z.fromJSONSchema(especificacao.components.schemas.Erro);
    expect(erro.safeParse(resposta.body).success).toBe(true);
    expect(especificacao.paths['/auth/dev-users'].get.responses).toHaveProperty('429');
  });
});

// Valores que violam um schema JSON de propriedade, um por tipo de violação.
function valoresInvalidos(propriedade) {
  const valores = [null, { aninhado: true }];
  if (propriedade.type === 'string') valores.push(12345, 'x'.repeat((propriedade.maxLength ?? 5000) + 1));
  if (propriedade.enum) valores.push('VALOR_INEXISTENTE');
  if (propriedade.type === 'integer' || propriedade.type === 'number') valores.push('não é número', -1, 1.5, 1e308);
  if (propriedade.type === 'boolean') valores.push('true', 1);
  if (propriedade.type === 'array')
    valores.push(
      'não é lista',
      [null],
      Array.from({ length: 100 }, () => 'x'),
    );
  return valores;
}

// Fuzz guiado pela especificação: corpos e ids malformados nunca causam erro 500 e
// sempre recebem um status que a especificação documenta para a operação.
const esperarStatusDocumentado = (resposta, op, contexto) => {
  expect(resposta.status, contexto).not.toBe(500);
  expect(Object.keys(op.responses), `${contexto} devolveu ${resposta.status}`).toContain(String(resposta.status));
};
describe('fuzz guiado pela especificação', () => {
  let a;
  let pessoa;
  let ids;
  beforeAll(async () => {
    a = await criarAmbiente({
      ambiente: AMBIENTE,
      ia: { extrairTags: vi.fn(async () => ({ technical_tags: [], hobby_tags: [], fallback: true })), gerarQuebraGelo: vi.fn() },
    });
    pessoa = await a.criarPessoa({ nome: 'Fuzz Exemplo', tecnicas: ['React', 'Node.js'], hobbies: ['Xadrez'] });
    const outra = await a.criarPessoa({ nome: 'Fuzz Par', tecnicas: ['React', 'Node.js'], hobbies: ['Xadrez'] });
    // Um match de verdade, para as rotas com {id} chegarem até a validação do corpo.
    await a.como(pessoa.email).post('/matches', { receiver_id: outra.id });
    const { body } = await a.como(outra.email).post('/matches', { receiver_id: pessoa.id });
    ids = { '/matches': body.match_id, '/employees': outra.id };
  });

  const idReal = (caminho) => ids[Object.keys(ids).find((prefixo) => caminho.startsWith(prefixo))];
  afterAll(() => a.fechar());

  const operacoes = Object.entries(gerarEspecificacao().paths).flatMap(([caminho, ops]) =>
    Object.entries(ops).map(([metodo, op]) => ({ caminho, metodo, op })),
  );

  async function enviar(metodo, caminho, corpo) {
    const autorizacao = await a.entrar(pessoa.email);
    let requisicao = a.http[metodo](`/api/v1${caminho}`).set('Authorization', autorizacao);
    if (corpo !== undefined)
      requisicao = typeof corpo === 'string' ? requisicao.set('Content-Type', 'application/json').send(corpo) : requisicao.send(corpo);
    return requisicao;
  }

  it.each(operacoes.filter((o) => o.op.requestBody).map((o) => [`${o.metodo.toUpperCase()} ${o.caminho}`, o]))(
    '%s recusa corpos malformados com status documentado',
    async (_nome, { caminho, metodo, op }) => {
      const destino = caminho.replace('{id}', String(idReal(caminho)));
      const schema = op.requestBody.content['application/json'].schema;
      const corpos = [{}, [], '{"json quebrado', '"texto"', { campo_desconhecido: 1 }];
      for (const [nome, propriedade] of Object.entries(schema.properties ?? {})) {
        for (const valor of valoresInvalidos(propriedade)) corpos.push({ [nome]: valor });
      }
      for (const corpo of corpos) {
        const resposta = await enviar(metodo, destino, corpo);
        esperarStatusDocumentado(resposta, op, `${metodo} ${destino} ${JSON.stringify(corpo).slice(0, 80)}`);
      }
    },
  );

  it.each(operacoes.filter((o) => o.caminho.includes('{id}')).map((o) => [`${o.metodo.toUpperCase()} ${o.caminho}`, o]))(
    '%s recusa ids inválidos com status documentado',
    async (_nome, { caminho, metodo, op }) => {
      for (const valor of ['abc', '0', '-1', '1.5', '99999999999999999999', '%00', "1'; DROP TABLE employee;--"]) {
        const resposta = await enviar(
          metodo,
          caminho.replace('{id}', encodeURIComponent(valor)),
          metodo === 'get' || metodo === 'delete' ? undefined : {},
        );
        esperarStatusDocumentado(resposta, op, `${metodo} ${caminho} id=${valor}`);
      }
    },
  );
});
