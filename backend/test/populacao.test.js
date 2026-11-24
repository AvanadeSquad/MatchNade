import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { criarBanco } from '../src/db/index.js';
import { BancoComDadosReais, DOMINIO, TRILHAS, gerarPessoas, popularBanco } from '../src/db/populacao.js';
import { AVATARES, HORARIOS_CAFE, OBJETIVOS } from '../src/services/perfil.js';

describe('gerarPessoas', () => {
  const agora = new Date('2026-11-01T12:00:00Z');
  const pessoas = gerarPessoas({ total: 400, semente: 11, agora });

  it('é determinística para a mesma semente e muda com outra', () => {
    expect(gerarPessoas({ total: 400, semente: 11, agora })).toEqual(pessoas);
    expect(gerarPessoas({ total: 400, semente: 12, agora }).map((p) => p.tecnicas)).not.toEqual(pessoas.map((p) => p.tecnicas));
  });

  it('gera e-mails únicos no domínio fictício, mesmo passando de 3 mil nomes', () => {
    const grande = gerarPessoas({ total: 4000, semente: 1 });
    const emails = grande.map((p) => p.email);
    expect(new Set(emails).size).toBe(4000);
    expect(emails.every((e) => /^[a-z0-9.]+@exemplo\.test$/.test(e) && e.endsWith(`@${DOMINIO}`))).toBe(true);
  });

  it('evita e-mails já usados', () => {
    const [primeira] = gerarPessoas({ total: 1, semente: 1 });
    const [outra] = gerarPessoas({ total: 1, semente: 1, emailsUsados: new Set([primeira.email]) });
    expect(outra.email).not.toBe(primeira.email);
  });

  it('cada cadastro é completo e respeita os limites do produto', () => {
    for (const p of pessoas) {
      expect(p.bio.length).toBeGreaterThan(20);
      expect(p.bio.length).toBeLessThanOrEqual(1000);
      expect(p.tecnicas.length).toBeGreaterThanOrEqual(3);
      expect(p.hobbies.length).toBeGreaterThanOrEqual(1);
      expect(p.maximoSemanal).toBeGreaterThanOrEqual(2);
      expect(p.maximoSemanal).toBeLessThanOrEqual(5);
      expect(p.objetivos.length).toBeGreaterThanOrEqual(1);
      expect(p.objetivos.every((o) => OBJETIVOS.includes(o))).toBe(true);
      expect(['ALL', 'UNIT']).toContain(p.visibilidade);
      if (p.avatar) expect(AVATARES).toContain(p.avatar);
      if (p.pronomes) expect(p.pronomes.length).toBeLessThanOrEqual(30);
      expect(p.horarios.every((h) => HORARIOS_CAFE.includes(h))).toBe(true);
      expect(p.horarios.length).toBeLessThanOrEqual(5);
      expect(new Set(p.tecnicas).size).toBe(p.tecnicas.length);
    }
  });

  it('há tags populares e raras e todas as trilhas aparecem', () => {
    const contagem = new Map();
    for (const p of pessoas) for (const t of p.tecnicas) contagem.set(t, (contagem.get(t) ?? 0) + 1);
    const frequencias = [...contagem.values()].sort((a, b) => b - a);
    expect(frequencias[0]).toBeGreaterThan(frequencias[frequencias.length - 1] * 5);
    expect(new Set(pessoas.map((p) => p.trilha)).size).toBe(TRILHAS.length);
  });
});

describe('popularBanco', () => {
  let banco;
  beforeAll(async () => {
    banco = await criarBanco();
  });
  afterAll(() => banco.close());
  beforeEach(() => banco.exec('TRUNCATE employee, interest_tag RESTART IDENTITY CASCADE'));

  const um = async (sql) => (await banco.query(sql))[0];

  it('grava cadastros completos, histórico e nenhuma linha de IA', async () => {
    const resumo = await popularBanco(banco, { total: 300, semente: 5 });
    expect(resumo.pessoas).toBe(300);
    expect(resumo.conexoes).toBeGreaterThan(100);
    const { completos } = await um(
      `SELECT COUNT(*)::int AS completos FROM employee
        WHERE bio IS NOT NULL AND position IS NOT NULL AND department IS NOT NULL AND location IS NOT NULL
          AND password_hash IS NOT NULL AND jsonb_array_length(connection_goals) > 0`,
    );
    expect(completos).toBe(300);
    const { poucos } = await um(
      `SELECT COUNT(*)::int AS poucos FROM employee e WHERE (SELECT COUNT(*) FROM employee_interest i WHERE i.employee_id = e.id) < 4`,
    );
    expect(poucos).toBe(0);
    const { ia } = await um('SELECT COUNT(*)::int AS ia FROM ai_interaction_log');
    const { daIa } = await um(`SELECT COUNT(*)::int AS "daIa" FROM employee_interest WHERE source = 'AI'`);
    expect(ia).toBe(0);
    expect(daIa).toBe(0);
  });

  it('o histórico segue as regras de prazo, par único e participação nas mensagens', async () => {
    await popularBanco(banco, { total: 400, semente: 9 });
    const checagens = {
      repetidos: `SELECT COUNT(*)::int AS n FROM (SELECT 1 FROM connection_match GROUP BY LEAST(requester_id, receiver_id), GREATEST(requester_id, receiver_id) HAVING COUNT(*) > 1) x`,
      pendentesVelhos: `SELECT COUNT(*)::int AS n FROM connection_match WHERE status = 'PENDING' AND created_at < NOW() - INTERVAL '14 days'`,
      expiradosRecentes: `SELECT COUNT(*)::int AS n FROM connection_match WHERE status = 'EXPIRED' AND created_at > NOW() - INTERVAL '14 days'`,
      semResposta: `SELECT COUNT(*)::int AS n FROM connection_match WHERE status IN ('ACCEPTED', 'DECLINED') AND responded_at IS NULL`,
      forasDeAceitas: `SELECT COUNT(*)::int AS n FROM chat_message m JOIN connection_match c ON c.id = m.match_id WHERE c.status <> 'ACCEPTED'`,
      naoParticipantes: `SELECT COUNT(*)::int AS n FROM chat_message m JOIN connection_match c ON c.id = m.match_id WHERE m.sender_id NOT IN (c.requester_id, c.receiver_id)`,
      paraPausados: `SELECT COUNT(*)::int AS n FROM connection_match c JOIN employee e ON e.id = c.receiver_id WHERE e.is_paused`,
    };
    for (const [nome, sql] of Object.entries(checagens)) expect({ nome, n: (await um(sql)).n }).toEqual({ nome, n: 0 });
  });

  it('com historico: false só cria pessoas e interesses', async () => {
    const resumo = await popularBanco(banco, { total: 50, historico: false });
    expect(resumo.conexoes).toBe(0);
    expect((await um('SELECT COUNT(*)::int AS n FROM connection_match')).n).toBe(0);
  });

  it('permite popular de novo sem repetir e-mails', async () => {
    await popularBanco(banco, { total: 100, semente: 1, historico: false });
    await popularBanco(banco, { total: 100, semente: 2, historico: false });
    const { total, distintos } = await um('SELECT COUNT(*)::int AS total, COUNT(DISTINCT email)::int AS distintos FROM employee');
    expect(total).toBe(200);
    expect(distintos).toBe(200);
  });

  it('recusa banco com pessoa fora do domínio fictício e não altera nada', async () => {
    await banco.query(`INSERT INTO employee (auth_provider_id, name, email) VALUES ('x', 'Maria Real', 'maria@empresa.com')`);
    await expect(popularBanco(banco, { total: 10 })).rejects.toBeInstanceOf(BancoComDadosReais);
    expect((await um('SELECT COUNT(*)::int AS n FROM employee')).n).toBe(1);
  });

  it('recusa produção', async () => {
    const antes = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      await expect(popularBanco(banco, { total: 10 })).rejects.toThrow(/produção/);
    } finally {
      process.env.NODE_ENV = antes;
    }
  });
});
