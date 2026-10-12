import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { criarApp } from '../src/app.js';
import { criarLog, resumirErro } from '../src/utils/log.js';
import { configDeTeste, criarAmbiente } from './ajudante.js';

describe('logs estruturados', () => {
  let a;
  let linhas;
  let http;
  beforeAll(async () => {
    a = await criarAmbiente({ ia: { extrairTags: vi.fn(), gerarQuebraGelo: vi.fn() } });
    linhas = [];
    const log = criarLog({ nivel: 'info', escrever: (linha) => linhas.push(linha) });
    http = request(
      criarApp({
        banco: a.banco,
        config: a.config,
        log,
        limitarRequisicoes: false,
        ia: { extrairTags: vi.fn(), gerarQuebraGelo: vi.fn() },
      }),
    );
  });
  afterAll(() => a.fechar());

  const ultimas = (n) => linhas.slice(-n).map((l) => JSON.parse(l));

  it('cada requisição recebe X-Request-Id e gera uma linha JSON com o mesmo id', async () => {
    const r = await http.get('/api/v1/rota-que-nao-existe?origem=teste');
    expect(r.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    const [linha] = ultimas(1);
    expect(linha).toMatchObject({
      level: 'info',
      msg: 'requisicao',
      request_id: r.headers['x-request-id'],
      method: 'GET',
      path: '/api/v1/rota-que-nao-existe',
      status: 404,
    });
    expect(typeof linha.duracao_ms).toBe('number');
    expect(linha.time).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('as verificações de saúde são registradas em debug, não em info', async () => {
    const antes = linhas.length;
    for (const caminho of ['/health', '/api/v1/health', '/api/v1/health/ready']) await http.get(caminho);
    expect(linhas.length).toBe(antes);

    const emDebug = [];
    const logDebug = criarLog({ nivel: 'debug', escrever: (linha) => emDebug.push(JSON.parse(linha)) });
    const app = criarApp({ banco: a.banco, config: a.config, log: logDebug, limitarRequisicoes: false, ia: {} });
    await request(app).get('/health');
    expect(emDebug.filter((l) => l.msg === 'requisicao')).toEqual([expect.objectContaining({ level: 'debug', path: '/health' })]);
  });

  it('aproveita um X-Request-Id válido de quem chamou e troca um inválido', async () => {
    const valido = await http.get('/api/v1/health').set('X-Request-Id', 'proxy-1234abcd');
    expect(valido.headers['x-request-id']).toBe('proxy-1234abcd');
    for (const recebido of ['curto', 'tem espaço e "aspas"', 'x'.repeat(65)]) {
      const invalido = await http.get('/api/v1/health').set('X-Request-Id', recebido);
      expect(invalido.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    }
  });

  it('não registra corpo, token, e-mail, bio nem mensagens', async () => {
    const email = 'pessoa.secreta@exemplo.test';
    const login = await http.post('/api/v1/test/login').send({ email });
    const token = login.body.token;
    await http.put('/api/v1/profile').set('Authorization', `Bearer ${token}`).send({ bio: 'Texto muito pessoal da bio' });
    const registro = linhas.join('\n');
    for (const proibido of [email, token, 'Bearer', 'Texto muito pessoal', 'bio']) expect(registro).not.toContain(proibido);
    expect(ultimas(1)[0]).toMatchObject({ path: '/api/v1/profile', method: 'PUT', usuario_id: login.body.employee.id });
  });

  it('o nível configurado filtra os eventos e silent não escreve nada', () => {
    const escritas = [];
    const log = criarLog({ nivel: 'warn', escrever: (l) => escritas.push(l) });
    log.info('ignorado');
    log.warn('aviso');
    expect(escritas.map((l) => JSON.parse(l).msg)).toEqual(['aviso']);
    const mudo = criarLog({ nivel: 'silent', escrever: (l) => escritas.push(l) });
    mudo.error('nada');
    expect(escritas).toHaveLength(1);
  });

  it('o resumo de erro não inclui a mensagem, que pode trazer dados do banco', () => {
    const erro = Object.assign(new Error('Key (email)=(alguem@exemplo.test) already exists.'), { code: '23505' });
    const resumo = resumirErro(erro);
    expect(resumo).toMatchObject({ erro: 'Error', codigo: '23505' });
    expect(JSON.stringify(resumo)).not.toContain('alguem@exemplo.test');
  });

  it('LOG_LEVEL inválido cai no padrão e o padrão nos testes é silencioso', () => {
    expect(configDeTeste().logLevel).toBe('silent');
    expect(configDeTeste({ LOG_LEVEL: 'debug' }).logLevel).toBe('debug');
    expect(configDeTeste({ LOG_LEVEL: 'barulhento' }).logLevel).toBe('silent');
  });
});

describe('verificação de saúde', () => {
  let a;
  beforeAll(async () => {
    a = await criarAmbiente();
  });
  afterAll(() => a.fechar());

  it('GET /health e /api/v1/health continuam devolvendo exatamente { status: "ok" }', async () => {
    for (const caminho of ['/health', '/api/v1/health']) {
      const r = await a.http.get(caminho);
      expect(r.status).toBe(200);
      expect(r.body).toEqual({ status: 'ok' });
    }
  });

  it('GET /api/v1/health/ready responde 200 com o banco no ar', async () => {
    const r = await a.http.get('/api/v1/health/ready');
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ status: 'ok', banco: 'ok' });
  });

  it('GET /api/v1/health/ready responde 503 quando o banco falha', async () => {
    const bancoQuebrado = {
      ...a.banco,
      query: async () => {
        throw new Error('conexão recusada');
      },
    };
    const app = criarApp({ banco: bancoQuebrado, config: a.config, ia: {}, limitarRequisicoes: false });
    const r = await request(app).get('/api/v1/health/ready');
    expect(r.status).toBe(503);
    expect(r.body).toEqual({ status: 'indisponivel', banco: 'erro' });
  });

  it('GET /api/v1/health/ready responde 503 quando o banco não responde em 2 segundos', async () => {
    const bancoParado = { ...a.banco, query: () => new Promise(() => {}) };
    const app = criarApp({ banco: bancoParado, config: a.config, ia: {}, limitarRequisicoes: false });
    const inicio = Date.now();
    const r = await request(app).get('/api/v1/health/ready');
    expect(r.status).toBe(503);
    expect(Date.now() - inicio).toBeGreaterThanOrEqual(1900);
  }, 10000);
});
