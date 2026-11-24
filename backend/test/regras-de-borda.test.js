import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mencionaHierarquia, normalizarTag } from '../src/utils/tags.js';
import { criarAmbiente } from './ajudante.js';

const ia = { extrairTags: vi.fn(), gerarQuebraGelo: vi.fn() };

describe('regras de borda de conexões e chat', () => {
  let a;
  let ana;
  let bruno;

  beforeAll(async () => {
    a = await criarAmbiente({ ia });
  });
  afterAll(() => a.fechar());

  beforeEach(async () => {
    await a.limpar();
    ia.gerarQuebraGelo.mockReset();
    ana = await a.criarPessoa({ nome: 'Ana Borda', tecnicas: ['React', 'Node.js'], hobbies: ['Xadrez'] });
    bruno = await a.criarPessoa({ nome: 'Bruno Borda', tecnicas: ['Node.js', 'Azure'], hobbies: ['Xadrez'] });
  });

  async function matchEntreAnaEBruno() {
    await a.como(ana.email).post('/matches', { receiver_id: bruno.id });
    const { body } = await a.como(bruno.email).post('/matches', { receiver_id: ana.id });
    return body.match_id;
  }

  it('não é possível aceitar uma solicitação de quem está bloqueado, em nenhuma direção', async () => {
    for (const quemBloqueia of ['destinatario', 'remetente']) {
      await a.limpar();
      ana = await a.criarPessoa({ nome: 'Ana Borda', tecnicas: ['React', 'Node.js'], hobbies: ['Xadrez'] });
      bruno = await a.criarPessoa({ nome: 'Bruno Borda', tecnicas: ['Node.js', 'Azure'], hobbies: ['Xadrez'] });
      const { body } = await a.como(ana.email).post('/matches', { receiver_id: bruno.id });
      const [bloqueia, alvo] = quemBloqueia === 'destinatario' ? [bruno, ana] : [ana, bruno];
      await a.como(bloqueia.email).post(`/employees/${alvo.id}/block`);
      const r = await a.como(bruno.email).patch(`/matches/${body.match_id}`, { action: 'accept' });
      expect(r.status, quemBloqueia).toBe(403);
      expect(r.body.code).toBe('BLOQUEADO');
    }
  });

  it('a recusa é permanente: nem quem recusou nem quem foi recusado consegue demonstrar interesse de novo', async () => {
    const { body } = await a.como(ana.email).post('/matches', { receiver_id: bruno.id });
    await a.como(bruno.email).patch(`/matches/${body.match_id}`, { action: 'decline' });
    for (const [de, para] of [
      [bruno, ana],
      [ana, bruno],
    ]) {
      const r = await a.como(de.email).post('/matches', { receiver_id: para.id });
      expect(r.status).toBe(409);
      expect(r.body.code).toBe('JA_EXISTE');
    }
  });

  it('depois que a solicitação da outra pessoa expira, dá para demonstrar interesse e fica pendente', async () => {
    const { body } = await a.como(ana.email).post('/matches', { receiver_id: bruno.id });
    await a.banco.query(`UPDATE connection_match SET created_at = NOW() - INTERVAL '15 days' WHERE id = $1`, [body.match_id]);
    const r = await a.como(bruno.email).post('/matches', { receiver_id: ana.id });
    expect(r.status).toBe(201);
    expect(r.body.status).toBe('PENDING');
  });

  it('a mensagem com exatamente 1000 caracteres é aceita', async () => {
    const conexao = await matchEntreAnaEBruno();
    const r = await a.como(ana.email).post(`/matches/${conexao}/messages`, { body: 'x'.repeat(1000) });
    expect(r.status).toBe(201);
    expect(r.body.body).toHaveLength(1000);
  });

  it('o selo "novo" aparece num match feito depois da última visita e some depois de ver a lista', async () => {
    await a.como(ana.email).get('/matches');
    await matchEntreAnaEBruno();
    const espiada = await a.como(ana.email).get('/matches?peek=true');
    expect(espiada.body.confirmadas[0].new).toBe(true);
    await a.como(ana.email).get('/matches');
    const depois = await a.como(ana.email).get('/matches?peek=true');
    expect(depois.body.confirmadas[0].new).toBe(false);
  });

  it('o quebra-gelo envia à IA os nomes dos interesses de cada pessoa', async () => {
    const conexao = await matchEntreAnaEBruno();
    ia.gerarQuebraGelo.mockResolvedValue({ match_summary: 'Vocês dois curtem Node.js.', fallback: false });
    await a.como(ana.email).get(`/matches/${conexao}/icebreaker`);
    const [, tagsA, tagsB] = ia.gerarQuebraGelo.mock.calls[0];
    expect([...tagsA].sort()).toEqual(['Node.js', 'React', 'Xadrez']);
    expect([...tagsB].sort()).toEqual(['Azure', 'Node.js', 'Xadrez']);
  });
});

describe('normalizarTag nas bordas', () => {
  it('recusa cada termo genérico e ofensivo da lista', () => {
    const termos = [
      'empresa',
      'tecnologia',
      'trabalho',
      'projeto',
      'projetos',
      'equipe',
      'time',
      'area',
      'área',
      'profissional',
      'carreira',
      'pessoas',
      'tudo',
      'coisas',
      'vida',
      'porra',
      'merda',
      'caralho',
      'puta',
      'foda',
      'idiota',
      'burro',
    ];
    for (const termo of termos) expect(normalizarTag(termo), termo).toBeNull();
  });

  it('o padrão vale para a tag inteira, do primeiro ao último caractere', () => {
    expect(normalizarTag('React<b>')).toBeNull();
    expect(normalizarTag('<b>React')).toBeNull();
    expect(normalizarTag('-React')).toBeNull();
  });

  it('mencionaHierarquia reconhece também hierarquia, chefe e subordinado', () => {
    for (const frase of ['Falem sobre hierarquia.', 'A chefe curte xadrez.', 'Um subordinado e outro.']) {
      expect(mencionaHierarquia(frase), frase).toBe(true);
    }
  });

  it('aceita até 40 caracteres', () => {
    expect(normalizarTag('x'.repeat(40))).toBe('x'.repeat(40));
    expect(normalizarTag('x'.repeat(41))).toBeNull();
  });
});
