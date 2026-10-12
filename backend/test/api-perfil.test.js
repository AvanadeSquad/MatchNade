import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarAmbiente } from './ajudante.js';

describe('autenticação e perfil', () => {
  let a;
  beforeAll(async () => {
    a = await criarAmbiente({
      ambiente: { ALLOWED_EMAIL_DOMAINS: 'exemplo.test' },
      verificadorGoogle: async (credencial) => {
        if (credencial === 'credencial-ok-123') return { sub: 'g-1', email: 'Nova.Pessoa@exemplo.test', name: 'Nova Pessoa', email_verified: true };
        if (credencial === 'credencial-externa') return { sub: 'g-2', email: 'alguem@outro.com', name: 'Alguém', email_verified: true };
        throw new Error('inválida');
      },
    });
  });
  afterAll(() => a.fechar());
  beforeEach(() => a.limpar());

  it('GET /health responde ok sem login', async () => {
    const r = await a.http.get('/api/v1/health');
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ status: 'ok' });
  });

  it('rotas protegidas exigem token válido', async () => {
    expect((await a.http.get('/api/v1/profile')).status).toBe(401);
    const r = await a.http.get('/api/v1/profile').set('Authorization', 'Bearer lixo');
    expect(r.status).toBe(401);
    expect(r.body.code).toBe('NAO_AUTENTICADO');
  });

  it('login com Google cria a pessoa no primeiro acesso e reaproveita nos próximos', async () => {
    const primeiro = await a.http.post('/api/v1/auth/google').send({ credential: 'credencial-ok-123' });
    expect(primeiro.status).toBe(200);
    expect(primeiro.body.is_new).toBe(true);
    expect(primeiro.body.employee.email).toBe('nova.pessoa@exemplo.test');
    expect(primeiro.body.employee.profile_complete).toBe(false);

    const segundo = await a.http.post('/api/v1/auth/google').send({ credential: 'credencial-ok-123' });
    expect(segundo.body.is_new).toBe(false);
    expect(segundo.body.employee.id).toBe(primeiro.body.employee.id);

    const perfil = await a.http.get('/api/v1/profile').set('Authorization', `Bearer ${segundo.body.token}`);
    expect(perfil.status).toBe(200);
  });

  it('e-mail fora da lista recebe 403 EMAIL_NAO_LIBERADO', async () => {
    const r = await a.http.post('/api/v1/auth/google').send({ credential: 'credencial-externa' });
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('EMAIL_NAO_LIBERADO');
  });

  it('credencial inválida e corpo inválido são recusados', async () => {
    expect((await a.http.post('/api/v1/auth/google').send({ credential: 'credencial-quebrada' })).status).toBe(401);
    expect((await a.http.post('/api/v1/auth/google').send({})).status).toBe(400);
  });

  it('PUT /profile atualiza campos e valida os limites', async () => {
    const { email } = await a.criarPessoa({ nome: 'Ana Teste' });
    const eu = a.como(email);
    const ok = await eu.put('/profile', { department: 'Cloud', location: 'Recife', connection_goals: ['NETWORKING', 'MENTORIA'], max_weekly_matches: 4, bio: 'Gosto de xadrez' });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ department: 'Cloud', max_weekly_matches: 4, connection_goals: ['NETWORKING', 'MENTORIA'] });

    expect((await eu.put('/profile', { max_weekly_matches: 9 })).status).toBe(400);
    expect((await eu.put('/profile', { connection_goals: ['EMPREGO'] })).status).toBe(400);
  });

  it('salvar menos de 3 interesses devolve 400 MENOS_DE_3_TAGS', async () => {
    const { email } = await a.criarPessoa({ nome: 'Ana Teste' });
    const r = await a.como(email).put('/profile/interests', { interests: [{ name: 'React', category: 'TECHNICAL' }, { name: 'Xadrez', category: 'HOBBY' }] });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('MENOS_DE_3_TAGS');
  });

  it('salva interesses, cria tags novas e marca o perfil como completo', async () => {
    const { email } = await a.criarPessoa({ nome: 'Ana Teste', objetivos: ['NETWORKING'] });
    const r = await a.como(email).put('/profile/interests', {
      interests: [
        { name: 'React', category: 'TECHNICAL', source: 'AI', confidence: 0.9 },
        { name: 'react', category: 'TECHNICAL' },
        { name: 'Node.js', category: 'TECHNICAL' },
        { name: 'Xadrez', category: 'HOBBY' },
      ],
    });
    expect(r.status).toBe(200);
    expect(r.body.tags.technical.map((t) => t.name)).toEqual(['Node.js', 'React']);
    expect(r.body.tags.hobby.map((t) => t.name)).toEqual(['Xadrez']);
    expect(r.body.profile_complete).toBe(true);
  });

  it('trocar os interesses substitui os anteriores', async () => {
    const { email } = await a.criarPessoa({ nome: 'Ana Teste', tecnicas: ['React', 'Node.js'], hobbies: ['Xadrez'] });
    const r = await a.como(email).put('/profile/interests', {
      interests: [{ name: 'Python', category: 'TECHNICAL' }, { name: 'Corrida', category: 'HOBBY' }, { name: 'Café especial', category: 'HOBBY' }],
    });
    expect(r.body.tags.technical.map((t) => t.name)).toEqual(['Python']);
  });

  it('POST /tags cria, reaproveita e recusa cargo', async () => {
    const { email } = await a.criarPessoa({ nome: 'Ana Teste' });
    const eu = a.como(email);
    const criada = await eu.post('/tags', { name: 'Jardinagem', category: 'HOBBY' });
    expect(criada.status).toBe(201);
    const repetida = await eu.post('/tags', { name: 'jardinagem', category: 'HOBBY' });
    expect(repetida.body.id).toBe(criada.body.id);
    const cargo = await eu.post('/tags', { name: 'Gerente', category: 'TECHNICAL' });
    expect(cargo.status).toBe(400);
    expect(cargo.body.code).toBe('TAG_INVALIDA');

    const lista = await eu.get('/tags?category=HOBBY');
    expect(lista.body.tags.map((t) => t.name)).toContain('Jardinagem');
  });

  it('PATCH /profile/pause pausa a exposição e tira a pessoa das recomendações', async () => {
    const eu = await a.criarPessoa({ nome: 'Eu Mesma', tecnicas: ['React', 'Node.js'], hobbies: ['Xadrez'] });
    const outra = await a.criarPessoa({ nome: 'Outra Pessoa', tecnicas: ['React', 'Node.js'], hobbies: ['Xadrez'] });
    const antes = await a.como(eu.email).get('/matches/recommendations');
    expect(antes.body.recommendations.map((r) => r.employee_id)).toEqual([outra.id]);

    const pausa = await a.como(outra.email).patch('/profile/pause', { is_paused: true });
    expect(pausa.body).toEqual({ is_paused: true });
    const depois = await a.como(eu.email).get('/matches/recommendations');
    expect(depois.body.recommendations).toEqual([]);
  });

  it('DELETE /profile remove a pessoa e tudo ligado a ela', async () => {
    const eu = await a.criarPessoa({ nome: 'Eu Mesma', tecnicas: ['React'], hobbies: ['Xadrez'] });
    const outra = await a.criarPessoa({ nome: 'Outra Pessoa', tecnicas: ['React'], hobbies: ['Xadrez'] });
    await a.como(eu.email).post('/matches', { receiver_id: outra.id });

    expect((await a.como(eu.email).delete('/profile')).status).toBe(204);
    const [{ total }] = await a.banco.query('SELECT COUNT(*)::int AS total FROM connection_match');
    expect(total).toBe(0);
    const [{ interesses }] = await a.banco.query('SELECT COUNT(*)::int AS interesses FROM employee_interest WHERE employee_id = $1', [eu.id]);
    expect(interesses).toBe(0);
    expect((await a.http.get('/api/v1/profile').set('Authorization', await a.entrar(eu.email))).status).toBe(401);
  });

  describe('extração de tags pela IA', () => {
    it('rejeita bio vazia com 400 BIO_VAZIA', async () => {
      const { email } = await a.criarPessoa({ nome: 'Ana Teste' });
      const r = await a.como(email).post('/profile/enrich-bio', { raw_bio: '   ' });
      expect(r.status).toBe(400);
      expect(r.body.code).toBe('BIO_VAZIA');
    });

    it('sem IA configurada devolve listas vazias com fallback', async () => {
      const { email } = await a.criarPessoa({ nome: 'Ana Teste' });
      const r = await a.como(email).post('/profile/enrich-bio', { raw_bio: 'Curto React e xadrez' });
      expect(r.status).toBe(200);
      expect(r.body).toEqual({ technical_tags: [], hobby_tags: [], fallback: true });
    });
  });

  describe('com IA disponível', () => {
    let b;
    const ia = { extrairTags: vi.fn(), gerarQuebraGelo: vi.fn() };
    beforeAll(async () => {
      b = await criarAmbiente({ ia });
    });
    afterAll(() => b.fechar());

    it('devolve as tags sem a chave fallback', async () => {
      await b.limpar();
      ia.extrairTags.mockResolvedValue({ technical_tags: ['React'], hobby_tags: ['Xadrez'], fallback: false });
      const { email } = await b.criarPessoa({ nome: 'Ana Teste' });
      const r = await b.como(email).post('/profile/enrich-bio', { raw_bio: 'Curto React e xadrez' });
      expect(r.body).toEqual({ technical_tags: ['React'], hobby_tags: ['Xadrez'] });
    });
  });
});

describe('rotas de desenvolvimento', () => {
  it('não existem com as flags desligadas', async () => {
    const a = await criarAmbiente({ ambiente: { E2E_TEST_MODE: 'false' } });
    expect((await a.http.post('/api/v1/test/login').send({ email: 'x@exemplo.test' })).status).toBe(404);
    expect((await a.http.post('/api/v1/auth/dev-login').send({ email: 'x@exemplo.test' })).status).toBe(404);
    await a.fechar();
  });

  it('login de desenvolvimento só existe com AUTH_DEV_LOGIN e respeita a lista de e-mails', async () => {
    const a = await criarAmbiente({ ambiente: { AUTH_DEV_LOGIN: 'true', ALLOWED_EMAIL_DOMAINS: 'exemplo.test' } });
    const ok = await a.http.post('/api/v1/auth/dev-login').send({ email: 'novo@exemplo.test' });
    expect(ok.status).toBe(200);
    expect((await a.http.post('/api/v1/auth/dev-login').send({ email: 'x@outro.com' })).status).toBe(403);
    expect((await a.http.get('/api/v1/auth/dev-users')).status).toBe(200);
    await a.fechar();
  });
});
