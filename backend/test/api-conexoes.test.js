import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarAmbiente } from './ajudante.js';

const ia = { extrairTags: vi.fn(), gerarQuebraGelo: vi.fn() };

describe('recomendações, conexões, chat e bloqueio', () => {
  let a;
  let ana;
  let bruno;
  let camila;

  beforeAll(async () => {
    a = await criarAmbiente({ ia });
  });
  afterAll(() => a.fechar());

  beforeEach(async () => {
    await a.limpar();
    ia.gerarQuebraGelo.mockReset();
    ana = await a.criarPessoa({
      nome: 'Ana Silva',
      unidade: 'Design',
      tecnicas: ['React', 'Node.js'],
      hobbies: ['Xadrez', 'Café especial'],
      cargo: 'Gerente de UX',
    });
    bruno = await a.criarPessoa({
      nome: 'Bruno Lima',
      unidade: 'Dados',
      tecnicas: ['Node.js', 'Azure'],
      hobbies: ['Xadrez', 'Corrida'],
      cargo: 'Engenheiro Sênior',
    });
    camila = await a.criarPessoa({ nome: 'Camila Rocha', unidade: 'Cloud', tecnicas: ['Azure', 'Terraform'], hobbies: ['Corrida'] });
  });

  describe('recomendações', () => {
    it('ordenam por afinidade, trazem interesses em comum e nunca expõem cargo', async () => {
      const r = await a.como(ana.email).get('/matches/recommendations?limit=5');
      expect(r.status).toBe(200);
      const [primeiro, segundo] = r.body.recommendations;
      expect(primeiro).toMatchObject({ employee_id: bruno.id, name: 'Bruno Lima', department: 'Dados' });
      expect(primeiro.shared_interests).toEqual(['Node.js', 'Xadrez']);
      expect(segundo.employee_id).toBe(camila.id);
      expect(segundo.affinity_score).toBe(0);
      expect(JSON.stringify(r.body)).not.toMatch(/position|cargo|Sênior|Gerente/);
    });

    it('respeitam o limite pedido e o máximo de 20', async () => {
      const r = await a.como(ana.email).get('/matches/recommendations?limit=1');
      expect(r.body.recommendations).toHaveLength(1);
      expect((await a.como(ana.email).get('/matches/recommendations?limit=abc')).status).toBe(400);
    });

    it('exigem ao menos 3 interesses no próprio perfil', async () => {
      const nova = await a.criarPessoa({ nome: 'Nova Pessoa', tecnicas: ['React'] });
      const r = await a.como(nova.email).get('/matches/recommendations');
      expect(r.status).toBe(409);
      expect(r.body.code).toBe('PERFIL_INCOMPLETO');
    });

    it('escondem quem já tem conexão, quem bloqueou e quem foi bloqueado', async () => {
      await a.como(ana.email).post('/matches', { receiver_id: bruno.id });
      await a.como(camila.email).post(`/employees/${ana.id}/block`);
      const r = await a.como(ana.email).get('/matches/recommendations');
      expect(r.body.recommendations).toEqual([]);
      expect(r.body.message).toBeTruthy();
    });

    it('com a cota semanal usada devolvem lista vazia e mensagem, sem erro', async () => {
      await a.como(ana.email).put('/profile', { max_weekly_matches: 1 });
      await a.como(ana.email).post('/matches', { receiver_id: bruno.id });
      const r = await a.como(ana.email).get('/matches/recommendations');
      expect(r.status).toBe(200);
      expect(r.body.recommendations).toEqual([]);
      expect(r.body.message).toMatch(/1 solicitações desta semana/);
    });
  });

  describe('demonstrar interesse', () => {
    it('o primeiro interesse cria uma solicitação pendente', async () => {
      const r = await a.como(ana.email).post('/matches', { receiver_id: bruno.id });
      expect(r.status).toBe(201);
      expect(r.body.status).toBe('PENDING');
      const lista = await a.como(bruno.email).get('/matches');
      expect(lista.body.recebidas.map((c) => c.employee_id)).toEqual([ana.id]);
      expect((await a.como(ana.email).get('/matches')).body.aguardando.map((c) => c.employee_id)).toEqual([bruno.id]);
    });

    it('interesse mútuo vira match na mesma conexão e marca como nova', async () => {
      const primeira = await a.como(ana.email).post('/matches', { receiver_id: bruno.id });
      const mutua = await a.como(bruno.email).post('/matches', { receiver_id: ana.id });
      expect(mutua.status).toBe(201);
      expect(mutua.body).toEqual({ status: 'ACCEPTED', match_id: primeira.body.match_id, new: true });
    });

    it('repetir o interesse devolve 409 JA_EXISTE', async () => {
      await a.como(ana.email).post('/matches', { receiver_id: bruno.id });
      const r = await a.como(ana.email).post('/matches', { receiver_id: bruno.id });
      expect(r.status).toBe(409);
      expect(r.body.code).toBe('JA_EXISTE');
    });

    it('recusa a si mesma, pessoa inexistente e corpo inválido', async () => {
      expect((await a.como(ana.email).post('/matches', { receiver_id: ana.id })).body.code).toBe('RECEIVER_INVALIDO');
      expect((await a.como(ana.email).post('/matches', { receiver_id: 9999 })).status).toBe(400);
      expect((await a.como(ana.email).post('/matches', { receiver_id: 'x' })).status).toBe(400);
    });

    it('bloqueio em qualquer direção devolve 403 BLOQUEADO', async () => {
      await a.como(bruno.email).post(`/employees/${ana.id}/block`);
      const r = await a.como(ana.email).post('/matches', { receiver_id: bruno.id });
      expect(r.status).toBe(403);
      expect(r.body.code).toBe('BLOQUEADO');
    });

    it('a cota semanal vale por pessoa e devolve 403 COTA_ESGOTADA', async () => {
      await a.como(ana.email).put('/profile', { max_weekly_matches: 1 });
      expect((await a.como(ana.email).post('/matches', { receiver_id: bruno.id })).status).toBe(201);
      const r = await a.como(ana.email).post('/matches', { receiver_id: camila.id });
      expect(r.status).toBe(403);
      expect(r.body.code).toBe('COTA_ESGOTADA');
    });

    it('aceitar uma solicitação recebida não gasta a cota de quem aceita', async () => {
      await a.como(bruno.email).put('/profile', { max_weekly_matches: 1 });
      const pedido = await a.como(ana.email).post('/matches', { receiver_id: bruno.id });
      await a.como(bruno.email).patch(`/matches/${pedido.body.match_id}`, { action: 'accept' });
      const perfil = await a.como(bruno.email).get('/profile');
      expect(perfil.body.quota).toEqual({ used: 0, max: 1 });
    });

    it('solicitações pendentes há mais de 14 dias expiram e liberam novo pedido', async () => {
      const pedido = await a.como(ana.email).post('/matches', { receiver_id: bruno.id });
      await a.banco.query(`UPDATE connection_match SET created_at = NOW() - INTERVAL '15 days' WHERE id = $1`, [pedido.body.match_id]);

      const lista = await a.como(bruno.email).get('/matches');
      expect(lista.body.recebidas).toEqual([]);
      const [{ status }] = await a.banco.query('SELECT status FROM connection_match WHERE id = $1', [pedido.body.match_id]);
      expect(status).toBe('EXPIRED');

      const novo = await a.como(ana.email).post('/matches', { receiver_id: bruno.id });
      expect(novo.status).toBe(201);
      expect(novo.body).toMatchObject({ status: 'PENDING', match_id: pedido.body.match_id });
    });
  });

  describe('responder solicitação', () => {
    it('só o destinatário responde (403) e só uma vez (409)', async () => {
      const pedido = await a.como(ana.email).post('/matches', { receiver_id: bruno.id });
      const id = pedido.body.match_id;
      expect((await a.como(ana.email).patch(`/matches/${id}`, { action: 'accept' })).status).toBe(403);

      const aceita = await a.como(bruno.email).patch(`/matches/${id}`, { action: 'accept' });
      expect(aceita.body).toEqual({ match_id: id, status: 'ACCEPTED' });
      expect((await a.como(bruno.email).patch(`/matches/${id}`, { action: 'decline' })).status).toBe(409);
    });

    it('recusar some para as duas pessoas e valida a ação', async () => {
      const id = (await a.como(ana.email).post('/matches', { receiver_id: bruno.id })).body.match_id;
      expect((await a.como(bruno.email).patch(`/matches/${id}`, { action: 'talvez' })).status).toBe(400);
      await a.como(bruno.email).patch(`/matches/${id}`, { action: 'decline' });
      const [deAna, deBruno] = await Promise.all([a.como(ana.email).get('/matches'), a.como(bruno.email).get('/matches')]);
      for (const lista of [deAna.body, deBruno.body]) {
        expect(lista).toEqual({ recebidas: [], aguardando: [], confirmadas: [] });
      }
    });

    it('conexão inexistente devolve 404', async () => {
      expect((await a.como(ana.email).patch('/matches/9999', { action: 'accept' })).status).toBe(404);
    });
  });

  describe('lista de conexões', () => {
    it('mostra o cargo só nas confirmadas', async () => {
      await a.como(ana.email).post('/matches', { receiver_id: bruno.id });
      await a.como(camila.email).post('/matches', { receiver_id: ana.id });
      await a.como(bruno.email).post('/matches', { receiver_id: ana.id });

      const r = await a.como(ana.email).get('/matches');
      expect(r.body.confirmadas).toHaveLength(1);
      expect(r.body.confirmadas[0]).toMatchObject({ employee_id: bruno.id, position: 'Engenheiro Sênior', new: true });
      expect(r.body.recebidas).toHaveLength(1);
      expect(r.body.recebidas[0]).not.toHaveProperty('position');
    });

    it('o selo "new" some depois da primeira consulta', async () => {
      await a.como(ana.email).post('/matches', { receiver_id: bruno.id });
      await a.como(bruno.email).post('/matches', { receiver_id: ana.id });
      expect((await a.como(ana.email).get('/matches')).body.confirmadas[0].new).toBe(true);
      expect((await a.como(ana.email).get('/matches')).body.confirmadas[0].new).toBe(false);
    });

    it('consultar com peek=true não marca as conexões como vistas', async () => {
      await a.como(ana.email).post('/matches', { receiver_id: bruno.id });
      await a.como(bruno.email).post('/matches', { receiver_id: ana.id });
      expect((await a.como(ana.email).get('/matches?peek=true')).body.confirmadas[0].new).toBe(true);
      expect((await a.como(ana.email).get('/matches?peek=true')).body.confirmadas[0].new).toBe(true);
      expect((await a.como(ana.email).get('/matches')).body.confirmadas[0].new).toBe(true);
      expect((await a.como(ana.email).get('/matches')).body.confirmadas[0].new).toBe(false);
    });

    it('esconde conexões com quem foi bloqueado', async () => {
      await a.como(ana.email).post('/matches', { receiver_id: bruno.id });
      await a.como(bruno.email).post('/matches', { receiver_id: ana.id });
      await a.como(ana.email).post(`/employees/${bruno.id}/block`);
      expect((await a.como(ana.email).get('/matches')).body.confirmadas).toEqual([]);
      expect((await a.como(bruno.email).get('/matches')).body.confirmadas).toEqual([]);
    });
  });

  describe('chat', () => {
    let conexao;
    beforeEach(async () => {
      conexao = (await a.como(ana.email).post('/matches', { receiver_id: bruno.id })).body.match_id;
    });

    const abrir = () => a.como(bruno.email).post('/matches', { receiver_id: ana.id });

    it('sem match devolve 403 SEM_MATCH para ler, enviar e pedir quebra-gelo', async () => {
      for (const resposta of [
        await a.como(ana.email).get(`/matches/${conexao}/messages`),
        await a.como(ana.email).post(`/matches/${conexao}/messages`, { body: 'oi' }),
        await a.como(ana.email).get(`/matches/${conexao}/icebreaker`),
      ]) {
        expect(resposta.status).toBe(403);
        expect(resposta.body.code).toBe('SEM_MATCH');
      }
    });

    it('quem não participa da conexão recebe 404', async () => {
      await abrir();
      expect((await a.como(camila.email).get(`/matches/${conexao}/messages`)).status).toBe(404);
    });

    it('depois do match as duas pessoas trocam mensagens, e o polling traz só as novas', async () => {
      await abrir();
      const primeira = await a.como(ana.email).post(`/matches/${conexao}/messages`, { body: '  Oi, Bruno!  ' });
      expect(primeira.status).toBe(201);
      expect(primeira.body).toMatchObject({ sender_id: ana.id, body: 'Oi, Bruno!' });
      await a.como(bruno.email).post(`/matches/${conexao}/messages`, { body: 'Oi, Ana!' });

      const tudo = await a.como(bruno.email).get(`/matches/${conexao}/messages`);
      expect(tudo.body.messages.map((m) => m.body)).toEqual(['Oi, Bruno!', 'Oi, Ana!']);
      const novas = await a.como(ana.email).get(`/matches/${conexao}/messages?after=${primeira.body.id}`);
      expect(novas.body.messages.map((m) => m.body)).toEqual(['Oi, Ana!']);
    });

    it('recusa mensagem vazia ou acima de 1000 caracteres', async () => {
      await abrir();
      expect((await a.como(ana.email).post(`/matches/${conexao}/messages`, { body: '   ' })).body.code).toBe('MENSAGEM_VAZIA');
      expect((await a.como(ana.email).post(`/matches/${conexao}/messages`, { body: 'x'.repeat(1001) })).body.code).toBe('MENSAGEM_LONGA');
    });

    it('bloquear fecha o chat para as duas pessoas e desbloquear reabre a conversa existente', async () => {
      await abrir();
      await a.como(ana.email).post(`/employees/${bruno.id}/block`);
      for (const quem of [ana, bruno]) {
        const r = await a.como(quem.email).post(`/matches/${conexao}/messages`, { body: 'oi' });
        expect(r.status).toBe(403);
        expect(r.body.code).toBe('BLOQUEADO');
      }
      expect((await a.como(ana.email).delete(`/employees/${bruno.id}/block`)).status).toBe(204);
      expect((await a.como(ana.email).post(`/matches/${conexao}/messages`, { body: 'voltei' })).status).toBe(201);
    });

    it('quebra-gelo: usa a IA uma vez, guarda o texto e reaproveita', async () => {
      await abrir();
      ia.gerarQuebraGelo.mockResolvedValue({ match_summary: 'Vocês dois curtem Node.js e xadrez.', fallback: false });
      const primeira = await a.como(ana.email).get(`/matches/${conexao}/icebreaker`);
      const segunda = await a.como(bruno.email).get(`/matches/${conexao}/icebreaker`);
      expect(primeira.body).toEqual({ match_summary: 'Vocês dois curtem Node.js e xadrez.' });
      expect(segunda.body).toEqual(primeira.body);
      expect(ia.gerarQuebraGelo).toHaveBeenCalledTimes(1);
      expect(ia.gerarQuebraGelo.mock.calls[0][3]).toEqual(['Node.js', 'Xadrez']);
    });

    it('quebra-gelo com IA fora do ar devolve o texto padrão sem guardar', async () => {
      await abrir();
      ia.gerarQuebraGelo.mockResolvedValue({ match_summary: 'Vocês têm grandes interesses em comum!', fallback: true });
      const r = await a.como(ana.email).get(`/matches/${conexao}/icebreaker`);
      expect(r.body).toMatchObject({ fallback: true });
      const [{ icebreaker }] = await a.banco.query('SELECT icebreaker FROM connection_match WHERE id = $1', [conexao]);
      expect(icebreaker).toBeNull();
    });
  });

  describe('perfil de outra pessoa', () => {
    it('antes do match não traz cargo nem bio e mostra afinidade por eixo', async () => {
      const r = await a.como(ana.email).get(`/employees/${bruno.id}`);
      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({ name: 'Bruno Lima', department: 'Dados', connection: null });
      expect(r.body.affinity).toHaveProperty('technical');
      expect(r.body.affinity).toHaveProperty('personal');
      expect(r.body.shared_interests).toEqual(['Node.js', 'Xadrez']);
      expect(r.body).not.toHaveProperty('position');
      expect(r.body).not.toHaveProperty('bio');
    });

    it('depois do match traz o cargo', async () => {
      await a.como(ana.email).post('/matches', { receiver_id: bruno.id });
      await a.como(bruno.email).post('/matches', { receiver_id: ana.id });
      const r = await a.como(ana.email).get(`/employees/${bruno.id}`);
      expect(r.body.position).toBe('Engenheiro Sênior');
      expect(r.body.connection.status).toBe('ACCEPTED');
    });

    it('uma solicitação pendente há mais de 14 dias não aparece mais no perfil', async () => {
      const pedido = await a.como(ana.email).post('/matches', { receiver_id: bruno.id });
      await a.banco.query(`UPDATE connection_match SET created_at = NOW() - INTERVAL '15 days' WHERE id = $1`, [pedido.body.match_id]);
      const r = await a.como(bruno.email).get(`/employees/${ana.id}`);
      expect(r.status).toBe(200);
      expect(r.body.connection).toBeNull();
    });

    it('pessoa bloqueada, a própria pessoa e id inexistente devolvem 404', async () => {
      await a.como(ana.email).post(`/employees/${bruno.id}/block`);
      expect((await a.como(ana.email).get(`/employees/${bruno.id}`)).status).toBe(404);
      expect((await a.como(bruno.email).get(`/employees/${ana.id}`)).status).toBe(404);
      expect((await a.como(ana.email).get(`/employees/${ana.id}`)).status).toBe(404);
      expect((await a.como(ana.email).get('/employees/9999')).status).toBe(404);
    });
  });

  describe('bloquear e denunciar', () => {
    it('não permite bloquear a si mesmo e lista os bloqueados', async () => {
      expect((await a.como(ana.email).post(`/employees/${ana.id}/block`)).status).toBe(400);
      expect((await a.como(ana.email).post(`/employees/${bruno.id}/block`)).status).toBe(204);
      expect((await a.como(ana.email).post(`/employees/${bruno.id}/block`)).status).toBe(204);
      const r = await a.como(ana.email).get('/blocks');
      expect(r.body.blocked).toEqual([{ id: bruno.id, name: 'Bruno Lima' }]);
    });

    it('denúncia exige motivo', async () => {
      const sem = await a.como(ana.email).post(`/employees/${bruno.id}/report`, {});
      expect(sem.status).toBe(400);
      expect(sem.body.code).toBe('MOTIVO_OBRIGATORIO');
      const com = await a.como(ana.email).post(`/employees/${bruno.id}/report`, { reason: 'Mensagens insistentes após recusa' });
      expect(com.status).toBe(201);
      const [denuncia] = await a.banco.query('SELECT reporter_id, reported_id, reason FROM employee_report');
      expect(denuncia).toEqual({ reporter_id: ana.id, reported_id: bruno.id, reason: 'Mensagens insistentes após recusa' });
    });
  });
});
