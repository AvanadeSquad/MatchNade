import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { criarApp } from '../src/app.js';
import { configDeTeste, criarAmbiente } from './ajudante.js';

describe('autenticação e perfil', () => {
  let a;
  beforeAll(async () => {
    a = await criarAmbiente({
      ambiente: { ALLOWED_EMAIL_DOMAINS: 'exemplo.test' },
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

  it('PUT /profile atualiza campos e valida os limites', async () => {
    const { email } = await a.criarPessoa({ nome: 'Ana Teste' });
    const eu = a.como(email);
    const ok = await eu.put('/profile', {
      department: 'Cloud',
      location: 'Recife',
      connection_goals: ['NETWORKING', 'MENTORIA'],
      max_weekly_matches: 4,
      bio: 'Gosto de xadrez',
    });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ department: 'Cloud', max_weekly_matches: 4, connection_goals: ['NETWORKING', 'MENTORIA'] });

    expect((await eu.put('/profile', { max_weekly_matches: 9 })).status).toBe(400);
    expect((await eu.put('/profile', { connection_goals: ['EMPREGO'] })).status).toBe(400);
  });

  it('salvar menos de 3 interesses devolve 400 MENOS_DE_3_TAGS', async () => {
    const { email } = await a.criarPessoa({ nome: 'Ana Teste' });
    const r = await a.como(email).put('/profile/interests', {
      interests: [
        { name: 'React', category: 'TECHNICAL' },
        { name: 'Xadrez', category: 'HOBBY' },
      ],
    });
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
      interests: [
        { name: 'Python', category: 'TECHNICAL' },
        { name: 'Corrida', category: 'HOBBY' },
        { name: 'Café especial', category: 'HOBBY' },
      ],
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
    const [{ interesses }] = await a.banco.query('SELECT COUNT(*)::int AS interesses FROM employee_interest WHERE employee_id = $1', [
      eu.id,
    ]);
    expect(interesses).toBe(0);
    expect((await a.http.get('/api/v1/profile').set('Authorization', await a.entrar(eu.email))).status).toBe(401);
  });

  describe('edição de perfil: casos de borda', () => {
    it('corpo vazio não altera nada e devolve o perfil', async () => {
      const { email } = await a.criarPessoa({ nome: 'Ana Teste', unidade: 'Cloud', cidade: 'Recife' });
      const r = await a.como(email).put('/profile', {});
      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({ name: 'Ana Teste', department: 'Cloud', location: 'Recife' });
    });

    it('recusa tipos errados com 400 DADOS_INVALIDOS', async () => {
      const { email } = await a.criarPessoa({ nome: 'Ana Teste' });
      const eu = a.como(email);
      for (const corpo of [
        { name: 123 },
        { bio: ['texto'] },
        { connection_goals: 'NETWORKING' },
        { max_weekly_matches: '3' },
        { max_weekly_matches: 2.5 },
      ]) {
        const r = await eu.put('/profile', corpo);
        expect(r.status, JSON.stringify(corpo)).toBe(400);
        expect(r.body.code).toBe('DADOS_INVALIDOS');
      }
    });

    it('recusa textos acima do limite e nome curto', async () => {
      const { email } = await a.criarPessoa({ nome: 'Ana Teste' });
      const eu = a.como(email);
      for (const corpo of [
        { name: 'x'.repeat(121) },
        { name: ' a ' },
        { bio: 'x'.repeat(1001) },
        { department: 'x'.repeat(81) },
        { location: 'x'.repeat(81) },
        { position: 'x'.repeat(81) },
      ]) {
        expect((await eu.put('/profile', corpo)).status, Object.keys(corpo)[0]).toBe(400);
      }
      const [{ name }] = await a.banco.query('SELECT name FROM employee WHERE email = $1', [email]);
      expect(name).toBe('Ana Teste');
    });

    it('aceita textos exatamente no limite', async () => {
      const { email } = await a.criarPessoa({ nome: 'Ana Teste' });
      const r = await a.como(email).put('/profile', { name: 'n'.repeat(120), bio: 'b'.repeat(1000), location: 'c'.repeat(80) });
      expect(r.status).toBe(200);
      expect(r.body.bio).toHaveLength(1000);
    });

    it('recusa objetivo de conexão desconhecido e cota fora de 1 a 5', async () => {
      const { email } = await a.criarPessoa({ nome: 'Ana Teste' });
      const eu = a.como(email);
      expect((await eu.put('/profile', { connection_goals: ['NETWORKING', 'VENDAS'] })).status).toBe(400);
      for (const cota of [0, 6, -1]) expect((await eu.put('/profile', { max_weekly_matches: cota })).status, String(cota)).toBe(400);
      for (const cota of [1, 5]) expect((await eu.put('/profile', { max_weekly_matches: cota })).body.max_weekly_matches).toBe(cota);
    });

    it('objetivos repetidos são gravados uma vez só', async () => {
      const { email } = await a.criarPessoa({ nome: 'Ana Teste' });
      const r = await a.como(email).put('/profile', { connection_goals: ['MENTORIA', 'MENTORIA', 'HOBBY'] });
      expect(r.body.connection_goals).toEqual(['MENTORIA', 'HOBBY']);
    });

    it('ignora campos desconhecidos: e-mail, id e flags não mudam pela rota', async () => {
      const eu = await a.criarPessoa({ nome: 'Ana Teste' });
      const r = await a.como(eu.email).put('/profile', { email: 'outro@exemplo.test', id: 999, is_active: false, apelido: 'x' });
      expect(r.status).toBe(200);
      const [linha] = await a.banco.query('SELECT id, email, is_active FROM employee WHERE id = $1', [eu.id]);
      expect(linha).toEqual({ id: eu.id, email: eu.email, is_active: true });
    });

    it('cada pessoa só altera o próprio perfil: a rota usa o id do token', async () => {
      const ana = await a.criarPessoa({ nome: 'Ana Teste' });
      const bruno = await a.criarPessoa({ nome: 'Bruno Teste' });
      await a.como(ana.email).put('/profile', { name: 'Ana Editada', id: bruno.id, employee_id: bruno.id });
      const [{ name }] = await a.banco.query('SELECT name FROM employee WHERE id = $1', [bruno.id]);
      expect(name).toBe('Bruno Teste');
      expect((await a.como(ana.email).get('/profile')).body.name).toBe('Ana Editada');
    });

    it('o valor salvo volta na leitura seguinte', async () => {
      const { email } = await a.criarPessoa({ nome: 'Ana Teste' });
      const eu = a.como(email);
      await eu.put('/profile', {
        name: 'Ana Nova',
        bio: 'Curto xadrez',
        location: 'Natal',
        connection_goals: ['HOBBY'],
        max_weekly_matches: 2,
      });
      await eu.patch('/profile/pause', { is_paused: true });
      expect((await eu.get('/profile')).body).toMatchObject({
        name: 'Ana Nova',
        bio: 'Curto xadrez',
        location: 'Natal',
        connection_goals: ['HOBBY'],
        max_weekly_matches: 2,
        is_paused: true,
      });
    });

    it('trocar os interesses muda as recomendações na chamada seguinte', async () => {
      const eu = await a.criarPessoa({ nome: 'Eu Mesma', tecnicas: ['React', 'Node.js'], hobbies: ['Xadrez'] });
      const xadrez = await a.criarPessoa({ nome: 'Pessoa Xadrez', tecnicas: ['React', 'Node.js'], hobbies: ['Xadrez'] });
      const remo = await a.criarPessoa({ nome: 'Pessoa Remo', tecnicas: ['Rust', 'Go'], hobbies: ['Remo'] });
      const ordem = async () => (await a.como(eu.email).get('/matches/recommendations')).body.recommendations.map((r) => r.employee_id);

      expect((await ordem())[0]).toBe(xadrez.id);
      await a.como(eu.email).put('/profile/interests', {
        interests: [
          { name: 'Rust', category: 'TECHNICAL' },
          { name: 'Go', category: 'TECHNICAL' },
          { name: 'Remo', category: 'HOBBY' },
        ],
      });
      expect((await ordem())[0]).toBe(remo.id);
    });
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

// Cada teste monta só o app com a configuração que precisa, sobre um único banco criado no
// beforeAll: inicializar um PGlite custa segundos sob carga, e um por teste estouraria o limite.
describe('rotas de desenvolvimento', () => {
  let base;
  beforeAll(async () => {
    base = await criarAmbiente();
  });
  afterAll(() => base.fechar());

  const appCom = (ambiente) =>
    request(criarApp({ banco: base.banco, config: configDeTeste(ambiente), limitarRequisicoes: false, registrarErro: () => {} }));

  it('não existem com as flags desligadas', async () => {
    const http = appCom({ E2E_TEST_MODE: 'false' });
    expect((await http.post('/api/v1/test/login').send({ email: 'x@exemplo.test' })).status).toBe(404);
    expect((await http.post('/api/v1/auth/dev-login').send({ email: 'x@exemplo.test' })).status).toBe(404);
  });

  it('login de desenvolvimento só existe com AUTH_DEV_LOGIN e respeita a lista de e-mails', async () => {
    const http = appCom({ AUTH_DEV_LOGIN: 'true', ALLOWED_EMAIL_DOMAINS: 'exemplo.test' });
    const ok = await http.post('/api/v1/auth/dev-login').send({ email: 'novo@exemplo.test' });
    expect(ok.status).toBe(200);
    expect((await http.post('/api/v1/auth/dev-login').send({ email: 'x@outro.com' })).status).toBe(403);
    expect((await http.get('/api/v1/auth/dev-users')).status).toBe(200);
  });
});
