import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { criarApp } from '../src/app.js';
import { criarProntidao } from '../src/services/prontidao.js';
import { criarLog } from '../src/utils/log.js';
import { criarAmbiente } from './ajudante.js';

const logMudo = criarLog({ nivel: 'silent' });

// Banco falso que conta as consultas e responde conforme `estado.ok`.
function bancoFalso() {
  const estado = { ok: true, consultas: 0 };
  const banco = {
    query: vi.fn(async () => {
      estado.consultas += 1;
      if (!estado.ok) throw new Error('conexão recusada');
      return [{ '?column?': 1 }];
    }),
  };
  return { banco, estado };
}

describe('prontidão com resultado guardado', () => {
  it('guarda o resultado positivo por 5 segundos e consulta de novo depois', async () => {
    let instante = 0;
    const { banco, estado } = bancoFalso();
    const verificar = criarProntidao({ banco, log: logMudo, agora: () => instante });
    expect(await verificar()).toBe(true);
    instante = 4999;
    expect(await verificar()).toBe(true);
    expect(estado.consultas).toBe(1);
    instante = 5000;
    expect(await verificar()).toBe(true);
    expect(estado.consultas).toBe(2);
  });

  it('guarda a falha por só 2 segundos, para a recuperação aparecer logo', async () => {
    let instante = 0;
    const { banco, estado } = bancoFalso();
    estado.ok = false;
    const verificar = criarProntidao({ banco, log: logMudo, agora: () => instante });
    expect(await verificar()).toBe(false);
    estado.ok = true;
    instante = 1999;
    expect(await verificar()).toBe(false);
    instante = 2000;
    expect(await verificar()).toBe(true);
    expect(estado.consultas).toBe(2);
  });

  it('chamadas simultâneas aproveitam a mesma consulta', async () => {
    const { banco, estado } = bancoFalso();
    const verificar = criarProntidao({ banco, log: logMudo });
    const resultados = await Promise.all(Array.from({ length: 20 }, () => verificar()));
    expect(resultados.every(Boolean)).toBe(true);
    expect(estado.consultas).toBe(1);
  });

  it('banco que não responde no prazo conta como indisponível', async () => {
    const banco = { query: () => new Promise(() => {}) };
    const verificar = criarProntidao({ banco, log: logMudo, limiteBancoMs: 50 });
    expect(await verificar()).toBe(false);
  });
});

describe('GET /api/v1/health/ready', () => {
  let a;
  beforeAll(async () => {
    a = await criarAmbiente();
  });
  afterAll(() => a.fechar());

  it('responde 503 com o contrato de erro quando o banco falha', async () => {
    const { banco, estado } = bancoFalso();
    estado.ok = false;
    const app = criarApp({ banco, config: a.config, ia: {}, limitarRequisicoes: false, log: logMudo });
    const r = await request(app).get('/api/v1/health/ready');
    expect(r.status).toBe(503);
    expect(r.body).toEqual({ status: 'indisponivel', banco: 'erro' });
  });

  it('responde 200 com o contrato e consulta o banco uma vez só em chamadas seguidas', async () => {
    const { banco, estado } = bancoFalso();
    const app = criarApp({ banco, config: a.config, ia: {}, limitarRequisicoes: false, log: logMudo });
    for (let i = 0; i < 10; i += 1) {
      const r = await request(app).get('/api/v1/health/ready');
      expect(r.status).toBe(200);
      expect(r.body).toEqual({ status: 'ok', banco: 'ok' });
    }
    expect(estado.consultas).toBe(1);
  });

  it('tem limite próprio de 120 requisições por minuto, e /health continua livre', async () => {
    const { banco } = bancoFalso();
    const app = criarApp({ banco, config: a.config, ia: {}, limitarRequisicoes: true, log: logMudo });
    const agente = request.agent(app);
    const status = [];
    for (let i = 0; i < 121; i += 1) status.push((await agente.get('/api/v1/health/ready')).status);
    expect(status.slice(0, 120).every((s) => s === 200)).toBe(true);
    expect(status[120]).toBe(429);
    expect((await agente.get('/health')).status).toBe(200);
  });
});
