import jwt from 'jsonwebtoken';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErroIa } from '../src/ai/provedores.js';
import { executarComResiliencia } from '../src/ai/resiliencia.js';
import { normalizarTag } from '../src/utils/tags.js';
import { criarAmbiente, SEGREDO } from './ajudante.js';

describe('regras de borda da API', () => {
  let a;
  let ana;
  let bruno;
  let camila;

  beforeAll(async () => {
    a = await criarAmbiente({ ia: { extrairTags: vi.fn(), gerarQuebraGelo: vi.fn() } });
  });
  afterAll(() => a.fechar());

  beforeEach(async () => {
    await a.limpar();
    ana = await a.criarPessoa({ nome: 'Ana Silva', unidade: 'Design', tecnicas: ['React', 'Node.js'], hobbies: ['Xadrez'] });
    bruno = await a.criarPessoa({ nome: 'Bruno Lima', unidade: 'Dados', tecnicas: ['Node.js', 'Azure'], hobbies: ['Xadrez'] });
    camila = await a.criarPessoa({ nome: 'Camila Rocha', unidade: 'Cloud', tecnicas: ['Azure', 'Terraform'], hobbies: ['Corrida'] });
  });

  describe('solicitações expiradas e acesso indevido', () => {
    it('não permite aceitar uma solicitação pendente há mais de 14 dias', async () => {
      const pedido = await a.como(ana.email).post('/matches', { receiver_id: bruno.id });
      await a.banco.query(`UPDATE connection_match SET created_at = NOW() - INTERVAL '15 days' WHERE id = $1`, [pedido.body.match_id]);

      const r = await a.como(bruno.email).patch(`/matches/${pedido.body.match_id}`, { action: 'accept' });
      expect(r.status).toBe(409);
      expect(r.body.code).toBe('JA_RESPONDIDA');
      const [{ status }] = await a.banco.query('SELECT status FROM connection_match WHERE id = $1', [pedido.body.match_id]);
      expect(status).toBe('EXPIRED');
    });

    it('quem não participa da conexão recebe 404 ao tentar responder, sem revelar que ela existe', async () => {
      const pedido = await a.como(ana.email).post('/matches', { receiver_id: bruno.id });
      const existente = await a.como(camila.email).patch(`/matches/${pedido.body.match_id}`, { action: 'accept' });
      const inexistente = await a.como(camila.email).patch('/matches/9999', { action: 'accept' });
      expect(existente.status).toBe(404);
      expect(existente.body).toEqual(inexistente.body);
    });

    it('pedidos cruzados e simultâneos viram um único match', async () => {
      const [um, outro] = await Promise.all([
        a.como(ana.email).post('/matches', { receiver_id: bruno.id }),
        a.como(bruno.email).post('/matches', { receiver_id: ana.id }),
      ]);
      expect([um.status, outro.status]).toEqual([201, 201]);
      const linhas = await a.banco.query('SELECT status FROM connection_match');
      expect(linhas).toEqual([{ status: 'ACCEPTED' }]);
    });

    it('o índice do par impede duas conexões ativas em direções opostas', async () => {
      await a.banco.query(`INSERT INTO connection_match (requester_id, receiver_id, status) VALUES ($1, $2, 'PENDING')`, [
        ana.id,
        bruno.id,
      ]);
      await expect(
        a.banco.query(`INSERT INTO connection_match (requester_id, receiver_id, status) VALUES ($1, $2, 'PENDING')`, [bruno.id, ana.id]),
      ).rejects.toThrow();
    });
  });

  describe('pessoas pausadas e perfil incompleto', () => {
    it('não é possível demonstrar interesse em quem pausou a exposição', async () => {
      await a.como(bruno.email).patch('/profile/pause', { is_paused: true });
      const r = await a.como(ana.email).post('/matches', { receiver_id: bruno.id });
      expect(r.status).toBe(400);
      expect(r.body.code).toBe('RECEIVER_INVALIDO');
    });

    it('o perfil de quem pausou só é visível para quem já tem conexão', async () => {
      await a.como(bruno.email).patch('/profile/pause', { is_paused: true });
      expect((await a.como(ana.email).get(`/employees/${bruno.id}`)).status).toBe(404);
    });

    it('quem tem menos de 3 interesses não demonstra interesse nem vê perfis', async () => {
      const nova = await a.criarPessoa({ nome: 'Nova Pessoa', tecnicas: ['React'] });
      const interesse = await a.como(nova.email).post('/matches', { receiver_id: bruno.id });
      expect(interesse.status).toBe(409);
      expect(interesse.body.code).toBe('PERFIL_INCOMPLETO');
      expect((await a.como(nova.email).get(`/employees/${bruno.id}`)).status).toBe(409);
    });

    it('quem tem menos de 3 interesses não aparece na descoberta nem recebe interesse', async () => {
      const nova = await a.criarPessoa({ nome: 'Nova Pessoa', tecnicas: ['React', 'Node.js'] });
      const { body } = await a.como(ana.email).get('/matches/recommendations');
      expect(body.recommendations.map((r) => r.employee_id)).not.toContain(nova.id);
      const interesse = await a.como(ana.email).post('/matches', { receiver_id: nova.id });
      expect(interesse.status).toBe(400);
      expect(interesse.body.code).toBe('RECEIVER_INVALIDO');
    });
  });

  describe('tags e exclusão', () => {
    it('duas pessoas criando a mesma tag nova ao mesmo tempo recebem a mesma tag', async () => {
      const respostas = await Promise.all([
        a.como(ana.email).post('/tags', { name: 'Origami', category: 'HOBBY' }),
        a.como(bruno.email).post('/tags', { name: 'origami', category: 'HOBBY' }),
      ]);
      expect(respostas.map((r) => r.status)).toEqual([201, 201]);
      expect(respostas[0].body.id).toBe(respostas[1].body.id);
    });

    it('excluir os dados apaga também os registros de IA da pessoa', async () => {
      await a.banco.query(
        `INSERT INTO ai_interaction_log (employee_id, prompt_type, prompt_version, status) VALUES ($1, 'ENRICH_BIO', 'v1', 'OK')`,
        [ana.id],
      );
      expect((await a.como(ana.email).delete('/profile')).status).toBe(204);
      const restantes = await a.banco.query('SELECT 1 FROM ai_interaction_log WHERE employee_id = $1 OR employee_id IS NULL', [ana.id]);
      expect(restantes).toHaveLength(0);
    });
  });

  describe('cota semanal', () => {
    it('zera quando a solicitação anterior é da semana passada', async () => {
      await a.como(ana.email).put('/profile', { max_weekly_matches: 1 });
      const primeiro = await a.como(ana.email).post('/matches', { receiver_id: bruno.id });
      expect((await a.como(ana.email).post('/matches', { receiver_id: camila.id })).status).toBe(403);

      await a.banco.query(`UPDATE connection_match SET created_at = NOW() - INTERVAL '8 days' WHERE id = $1`, [primeiro.body.match_id]);
      expect((await a.como(ana.email).post('/matches', { receiver_id: camila.id })).status).toBe(201);
    });

    it('dois pedidos simultâneos não ultrapassam a cota', async () => {
      await a.como(ana.email).put('/profile', { max_weekly_matches: 1 });
      const respostas = await Promise.all([
        a.como(ana.email).post('/matches', { receiver_id: bruno.id }),
        a.como(ana.email).post('/matches', { receiver_id: camila.id }),
      ]);
      expect(respostas.map((r) => r.status).sort()).toEqual([201, 403]);
    });
  });

  describe('tokens', () => {
    const cabecalho = (token) => `Bearer ${token}`;

    it('recusa token expirado, de outro segredo e de pessoa que não existe mais', async () => {
      const expirado = jwt.sign({ sub: String(ana.id) }, SEGREDO, { expiresIn: -10 });
      const forjado = jwt.sign({ sub: String(ana.id) }, 'outro-segredo-qualquer-com-tamanho-ok');
      const inexistente = jwt.sign({ sub: '9999' }, SEGREDO, { expiresIn: '1h' });
      for (const token of [expirado, forjado, inexistente]) {
        const r = await a.http.get('/api/v1/profile').set('Authorization', cabecalho(token));
        expect(r.status).toBe(401);
      }
    });

    it('recusa token assinado com outro algoritmo', async () => {
      const base64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
      const semAssinatura = `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url({ sub: String(ana.id) })}.`;
      const hs512 = jwt.sign({ sub: String(ana.id) }, SEGREDO, { algorithm: 'HS512', expiresIn: '1h' });
      for (const token of [semAssinatura, hs512]) {
        const r = await a.http.get('/api/v1/profile').set('Authorization', cabecalho(token));
        expect(r.status).toBe(401);
        expect(r.body.code).toBe('NAO_AUTENTICADO');
      }
    });

    it('aceita token válido', async () => {
      const valido = jwt.sign({ sub: String(ana.id) }, SEGREDO, { expiresIn: '1h' });
      expect((await a.http.get('/api/v1/profile').set('Authorization', cabecalho(valido))).status).toBe(200);
    });
  });
});

describe('normalizarTag com siglas e termos técnicos', () => {
  it('aceita PL/SQL e expressões com palavras que parecem ofensivas ou siglas', () => {
    expect(normalizarTag('PL/SQL')).toBe('PL/SQL');
    expect(normalizarTag('Lixo zero')).toBe('Lixo zero');
  });

  it('continua recusando a sigla quando ela é a tag inteira', () => {
    expect(normalizarTag('PL')).toBeNull();
    expect(normalizarTag('CTO')).toBeNull();
  });
});

describe('resiliência com o segundo provedor', () => {
  it('usa o reserva depois que o primeiro esgota o timeout nas duas tentativas', async () => {
    const travado = {
      nome: 'primario',
      modelo: 'p',
      gerar: (_req, sinal) =>
        new Promise((_ok, falha) => sinal.addEventListener('abort', () => falha(new ErroIa('tempo esgotado', { repetivel: true })))),
    };
    const reserva = { nome: 'reserva', modelo: 'r', gerar: vi.fn().mockResolvedValue('{"ok":true}') };
    const resultado = await executarComResiliencia({
      provedores: [travado, reserva],
      disjuntores: new Map(),
      requisicao: {},
      config: { timeoutMs: 100, retryDelayMs: 10, slaMs: 1000 },
    });
    expect(resultado.provedor).toBe('reserva');
  });
});
