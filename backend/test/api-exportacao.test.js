import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarApp } from '../src/app.js';
import { criarAmbiente } from './ajudante.js';

const ia = { extrairTags: vi.fn(), gerarQuebraGelo: vi.fn() };

describe('exportação dos próprios dados', () => {
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
    ana = await a.criarPessoa({ nome: 'Ana Silva', cargo: 'Engenheira', tecnicas: ['React', 'Node.js'], hobbies: ['Xadrez'] });
    bruno = await a.criarPessoa({ nome: 'Bruno Lima', cargo: 'Analista', tecnicas: ['Node.js', 'Azure'], hobbies: ['Xadrez'] });
    camila = await a.criarPessoa({ nome: 'Camila Rocha', tecnicas: ['Azure', 'Terraform'], hobbies: ['Corrida'] });
  });

  const exportar = (pessoa) => a.como(pessoa.email).get('/profile/export');

  async function conectarAnaEBruno() {
    const { match_id: id } = (await a.como(ana.email).post('/matches', { receiver_id: bruno.id })).body;
    await a.como(bruno.email).post('/matches', { receiver_id: ana.id });
    await a.como(ana.email).post(`/matches/${id}/messages`, { body: 'Oi, Bruno!' });
    await a.como(bruno.email).post(`/matches/${id}/messages`, { body: 'Oi, Ana!' });
    return id;
  }

  it('devolve o perfil, os interesses, as conexões e as mensagens da pessoa, como arquivo para baixar', async () => {
    const id = await conectarAnaEBruno();
    const r = await exportar(ana);

    expect(r.status).toBe(200);
    expect(r.headers['content-disposition']).toMatch(/^attachment; filename="[^"]+\.json"$/);
    expect(r.body.profile).toMatchObject({ name: 'Ana Silva', email: ana.email, position: 'Engenheira', department: 'Cloud' });
    expect(r.body.interests.map((i) => i.name)).toEqual(['Node.js', 'React', 'Xadrez']);
    expect(r.body.connections).toEqual([expect.objectContaining({ id, with: 'Bruno Lima', status: 'ACCEPTED', sent_by_me: true })]);
    expect(r.body.messages).toEqual([
      expect.objectContaining({ connection_id: id, sent_by_me: true, body: 'Oi, Bruno!' }),
      expect.objectContaining({ connection_id: id, sent_by_me: false, body: 'Oi, Ana!' }),
    ]);
    expect(Number.isNaN(Date.parse(r.body.exported_at))).toBe(false);
  });

  it('inclui os bloqueios e as denúncias feitas pela pessoa', async () => {
    await a.como(ana.email).post(`/employees/${bruno.id}/block`);
    await a.como(ana.email).post(`/employees/${camila.id}/report`, { reason: 'Mensagem ofensiva' });
    const r = await exportar(ana);

    expect(r.body.blocks).toEqual([expect.objectContaining({ person: 'Bruno Lima' })]);
    expect(r.body.reports_made).toEqual([expect.objectContaining({ person: 'Camila Rocha', reason: 'Mensagem ofensiva' })]);
  });

  it('não vaza hash, versão de sessão, contadores nem dado de outra pessoa', async () => {
    await a.banco.query(
      `UPDATE employee SET password_hash = 'segredo-hash', security_answer_hash = 'resposta-hash', security_question_id = 'q1',
                           token_version = 7, login_failed_attempts = 3 WHERE id = $1`,
      [ana.id],
    );
    await conectarAnaEBruno();
    await a.como(bruno.email).post(`/employees/${camila.id}/report`, { reason: 'Denúncia de outra pessoa' });
    const texto = JSON.stringify((await exportar(ana)).body);

    for (const proibido of ['segredo-hash', 'resposta-hash', 'password', 'security', 'token_version', 'failed_attempts', 'locked_until']) {
      expect(texto).not.toContain(proibido);
    }
    expect(texto).not.toContain(bruno.email);
    expect(texto).not.toContain('Analista');
    expect(texto).not.toContain('Denúncia de outra pessoa');
    expect(texto).not.toContain('Camila');
  });

  it('não mostra a outra pessoa depois que ela marca a conta para exclusão', async () => {
    await conectarAnaEBruno();
    await a.como(bruno.email).post('/profile/deletion', { confirm_email: bruno.email });
    const r = await exportar(ana);

    expect(r.body.connections).toEqual([]);
    expect(r.body.messages).toEqual([]);
  });

  it('funciona para a própria conta marcada para exclusão', async () => {
    await a.como(ana.email).post('/profile/deletion', { confirm_email: ana.email });
    const { body } = await a.http.post('/api/v1/test/login').send({ email: ana.email });
    const r = await a.http.get('/api/v1/profile/export').set('Authorization', `Bearer ${body.token}`);

    expect(r.status).toBe(200);
    expect(r.body.profile.name).toBe('Ana Silva');
    expect(r.body.profile.deletion_requested_at).not.toBeNull();
  });

  it('exige login', async () => {
    expect((await a.http.get('/api/v1/profile/export')).status).toBe(401);
  });

  it('limita a 5 exportações por hora por pessoa', async () => {
    const app = criarApp({ banco: a.banco, config: a.config, ia, limitarRequisicoes: true, registrarErro: () => {} });
    const autorizacao = await a.entrar(ana.email);
    const chamar = () => request(app).get('/api/v1/profile/export').set('Authorization', autorizacao);
    for (let i = 0; i < 5; i += 1) expect((await chamar()).status).toBe(200);
    const sexta = await chamar();
    expect(sexta.status).toBe(429);
    expect(sexta.body.code).toBe('LIMITE_EXCEDIDO');
  });
});
