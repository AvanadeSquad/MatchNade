import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarAmbiente } from './ajudante.js';

const ia = { extrairTags: vi.fn(), gerarQuebraGelo: vi.fn() };

describe('personalização do perfil', () => {
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
    ana = await a.criarPessoa({ nome: 'Ana Silva', unidade: 'Cloud', tecnicas: ['React', 'Node.js'], hobbies: ['Xadrez'] });
    bruno = await a.criarPessoa({ nome: 'Bruno Lima', unidade: 'Cloud', tecnicas: ['Node.js', 'Azure'], hobbies: ['Xadrez'] });
    camila = await a.criarPessoa({ nome: 'Camila Rocha', unidade: 'Data & AI', tecnicas: ['Azure', 'React'], hobbies: ['Xadrez'] });
  });

  const salvar = (pessoa, corpo) => a.como(pessoa.email).put('/profile', corpo);
  const ids = async (pessoa) => (await a.como(pessoa.email).get('/matches/recommendations')).body.recommendations.map((r) => r.employee_id);

  describe('salvar e ler', () => {
    it('guarda pronomes, visibilidade, avatar e horários preferidos, e devolve tudo no perfil', async () => {
      const r = await salvar(ana, {
        pronouns: 'ela/dela',
        visibility: 'UNIT',
        avatar_id: 'lua',
        preferred_coffee_slots: ['10:30', '09:00'],
      });
      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({
        pronouns: 'ela/dela',
        visibility: 'UNIT',
        avatar_id: 'lua',
        preferred_coffee_slots: ['09:00', '10:30'],
      });
      const lido = (await a.como(ana.email).get('/profile')).body;
      expect(lido).toMatchObject({
        pronouns: 'ela/dela',
        visibility: 'UNIT',
        avatar_id: 'lua',
        preferred_coffee_slots: ['09:00', '10:30'],
      });
    });

    it('começa com os padrões: sem pronomes, visível para todas as unidades, sem avatar e sem horários', async () => {
      const lido = (await a.como(ana.email).get('/profile')).body;
      expect(lido).toMatchObject({ pronouns: null, visibility: 'ALL', avatar_id: null, preferred_coffee_slots: [] });
    });

    it('limpa pronomes e avatar, e remove horários repetidos', async () => {
      await salvar(ana, { pronouns: 'ela/dela', avatar_id: 'sol' });
      const r = await salvar(ana, { pronouns: '', avatar_id: null, preferred_coffee_slots: ['14:00', '14:00', '09:00'] });
      expect(r.body).toMatchObject({ pronouns: null, avatar_id: null, preferred_coffee_slots: ['09:00', '14:00'] });
    });

    it('não mexe nos outros campos quando só um é enviado', async () => {
      await salvar(ana, { pronouns: 'ela/dela', avatar_id: 'sol' });
      const r = await salvar(ana, { visibility: 'UNIT' });
      expect(r.body).toMatchObject({ pronouns: 'ela/dela', avatar_id: 'sol', visibility: 'UNIT', name: 'Ana Silva' });
    });
  });

  describe('validação', () => {
    it.each([
      ['avatar fora da lista', { avatar_id: 'dragao' }],
      ['visibilidade inválida', { visibility: 'TODOS' }],
      ['horário fora do conjunto', { preferred_coffee_slots: ['03:00'] }],
      ['mais de 5 horários', { preferred_coffee_slots: ['09:00', '09:30', '10:00', '10:30', '11:00', '14:00'] }],
      ['pronomes com mais de 30 caracteres', { pronouns: 'a'.repeat(31) }],
    ])('recusa %s', async (_nome, corpo) => {
      const r = await salvar(ana, corpo);
      expect(r.status).toBe(400);
    });

    it.each(['ela/dela1', 'ela <b>', 'ele; DROP', 'não binário', 'ela/dela/ateia'])(
      'recusa pronomes que não são texto simples ou tocam dado sensível: %s',
      async (texto) => {
        const r = await salvar(ana, { pronouns: texto });
        expect(r.status).toBe(400);
        expect(r.body.code).toBe('PRONOMES_INVALIDOS');
      },
    );

    it.each(['ela/dela', 'ele/dele', 'elu/delu', 'ela / dela'])('aceita %s', async (texto) => {
      expect((await salvar(ana, { pronouns: texto })).status).toBe(200);
    });
  });

  describe('visibilidade por unidade', () => {
    beforeEach(async () => {
      await salvar(bruno, { visibility: 'UNIT' });
    });

    it('quem restringiu aparece nas recomendações só para a mesma unidade', async () => {
      expect(await ids(ana)).toContain(bruno.id);
      expect(await ids(camila)).not.toContain(bruno.id);
    });

    it('quem restringiu continua vendo todas as unidades', async () => {
      expect(await ids(bruno)).toContain(camila.id);
    });

    it('demonstrar interesse em quem restringiu: ok na mesma unidade e recusa genérica em outra', async () => {
      expect((await a.como(ana.email).post('/matches', { receiver_id: bruno.id })).status).toBe(201);
      const r = await a.como(camila.email).post('/matches', { receiver_id: bruno.id });
      expect(r.status).toBe(400);
      expect(r.body).toMatchObject({ code: 'RECEIVER_INVALIDO', message: 'Esta pessoa não está disponível.' });
    });

    it('perfil de quem restringiu: 200 na mesma unidade e 404 em outra', async () => {
      expect((await a.como(ana.email).get(`/employees/${bruno.id}`)).status).toBe(200);
      expect((await a.como(camila.email).get(`/employees/${bruno.id}`)).status).toBe(404);
    });

    it('quem já tinha demonstrado interesse antes de restringir continua conectável', async () => {
      await salvar(bruno, { visibility: 'ALL' });
      expect((await a.como(bruno.email).post('/matches', { receiver_id: camila.id })).status).toBe(201);
      await salvar(bruno, { visibility: 'UNIT' });
      expect((await a.como(camila.email).get(`/employees/${bruno.id}`)).status).toBe(200);
      const aceite = await a.como(camila.email).post('/matches', { receiver_id: bruno.id });
      expect(aceite.status).toBe(201);
      expect(aceite.body.status).toBe('ACCEPTED');
    });

    it('conexões que já existiam continuam, e o chat segue funcionando', async () => {
      await salvar(bruno, { visibility: 'ALL' });
      const { match_id: id } = (await a.como(bruno.email).post('/matches', { receiver_id: camila.id })).body;
      await a.como(camila.email).post('/matches', { receiver_id: bruno.id });
      await salvar(bruno, { visibility: 'UNIT' });
      const r = await a.como(camila.email).post(`/matches/${id}/messages`, { body: 'Oi, Bruno!' });
      expect(r.status).toBe(201);
    });

    it('trocar de unidade muda quem enxerga: a restrição vale para a nova unidade', async () => {
      await salvar(camila, { department: 'Cloud' });
      expect(await ids(camila)).toContain(bruno.id);
      await salvar(bruno, { department: 'Segurança' });
      expect(await ids(camila)).not.toContain(bruno.id);
    });

    it('voltar para todas as unidades devolve a pessoa às recomendações', async () => {
      await salvar(bruno, { visibility: 'ALL' });
      expect(await ids(camila)).toContain(bruno.id);
    });
  });

  describe('o que aparece para outras pessoas', () => {
    it('avatar e pronomes vão nas recomendações, no perfil e nas conexões, nunca cargo antes do match', async () => {
      await salvar(bruno, { pronouns: 'ele/dele', avatar_id: 'montanha' });
      const recomendacoes = (await a.como(ana.email).get('/matches/recommendations')).body.recommendations;
      expect(recomendacoes.find((r) => r.employee_id === bruno.id)).toMatchObject({ avatar_id: 'montanha', pronouns: 'ele/dele' });
      expect(recomendacoes.find((r) => r.employee_id === camila.id)).toMatchObject({ avatar_id: null, pronouns: null });

      const perfil = (await a.como(ana.email).get(`/employees/${bruno.id}`)).body;
      expect(perfil).toMatchObject({ avatar_id: 'montanha', pronouns: 'ele/dele' });
      expect(perfil).not.toHaveProperty('position');

      await a.como(ana.email).post('/matches', { receiver_id: bruno.id });
      const conexoes = (await a.como(bruno.email).get('/matches')).body.recebidas;
      expect(conexoes[0]).toMatchObject({ employee_id: ana.id, avatar_id: null, pronouns: null });
      await salvar(ana, { avatar_id: 'folha', pronouns: 'ela/dela' });
      const depois = (await a.como(bruno.email).get('/matches')).body.recebidas;
      expect(depois[0]).toMatchObject({ avatar_id: 'folha', pronouns: 'ela/dela' });
    });

    it('pronomes e avatar não entram no cálculo de afinidade', async () => {
      const antes = (await a.como(ana.email).get('/matches/recommendations')).body.recommendations.find((r) => r.employee_id === bruno.id);
      await salvar(bruno, { pronouns: 'ele/dele', avatar_id: 'raio', preferred_coffee_slots: ['09:00'] });
      const depois = (await a.como(ana.email).get('/matches/recommendations')).body.recommendations.find((r) => r.employee_id === bruno.id);
      expect(depois.affinity_score).toBe(antes.affinity_score);
    });
  });

  it('a exportação dos próprios dados inclui a personalização', async () => {
    await salvar(ana, { pronouns: 'ela/dela', visibility: 'UNIT', avatar_id: 'estrela', preferred_coffee_slots: ['16:00'] });
    const { body } = await a.como(ana.email).get('/profile/export');
    expect(body.profile).toMatchObject({
      pronouns: 'ela/dela',
      visibility: 'UNIT',
      avatar_id: 'estrela',
      preferred_coffee_slots: ['16:00'],
    });
  });
});
