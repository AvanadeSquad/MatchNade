import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { gerarHashSenha, normalizarRespostaSeguranca, verificarHash } from '../src/services/autenticacao.js';
import { criarAmbiente } from './ajudante.js';

const SENHA = 'senha-de-teste-123';
const dadosCadastro = (extra = {}) => ({
  name: 'Pessoa Local',
  email: 'pessoa.local@exemplo.test',
  password: SENHA,
  security_question_id: 'primeiro_pet',
  security_answer: 'Rex',
  ...extra,
});

describe('hash de senha e resposta de segurança', () => {
  it('gera hashes diferentes para a mesma senha e valida só a senha correta', async () => {
    const a = await gerarHashSenha(SENHA);
    const b = await gerarHashSenha(SENHA);
    expect(a).not.toBe(b);
    expect(a.startsWith('scrypt$')).toBe(true);
    expect(await verificarHash(SENHA, a)).toBe(true);
    expect(await verificarHash('outra-senha-123', a)).toBe(false);
  });

  it('rejeita hash ausente ou malformado', async () => {
    for (const hash of [null, undefined, '', 'texto-puro', 'bcrypt$aa$bb', 'scrypt$so-sal']) {
      expect(await verificarHash(SENHA, hash)).toBe(false);
    }
  });

  it('normaliza a resposta: sem acento, sem maiúsculas e sem espaços nas pontas', () => {
    expect(normalizarRespostaSeguranca('  São Paulo ')).toBe('sao paulo');
    expect(normalizarRespostaSeguranca(null)).toBe('');
  });
});

describe('autenticação local', () => {
  let a;
  beforeAll(async () => {
    a = await criarAmbiente({ ambiente: { ALLOWED_EMAIL_DOMAINS: 'exemplo.test' } });
  });
  afterAll(() => a.fechar());
  beforeEach(() => a.limpar());

  const cadastrar = (extra) => a.http.post('/api/v1/auth/register').send(dadosCadastro(extra));
  const entrar = (email, password) => a.http.post('/api/v1/auth/login').send({ email, password });

  it('lista as perguntas de segurança sem exigir login', async () => {
    const r = await a.http.get('/api/v1/auth/security-questions');
    expect(r.status).toBe(200);
    expect(r.body.questions.length).toBeGreaterThanOrEqual(3);
    expect(r.body.questions[0]).toEqual({ id: expect.any(String), pergunta: expect.any(String) });
  });

  describe('cadastro', () => {
    it('cria a conta, devolve token e não expõe hashes', async () => {
      const r = await cadastrar();
      expect(r.status).toBe(201);
      expect(r.body.is_new).toBe(true);
      expect(r.body.token).toEqual(expect.any(String));
      expect(r.body.employee.email).toBe('pessoa.local@exemplo.test');
      expect(JSON.stringify(r.body)).not.toMatch(/hash|scrypt|security_answer/i);
      const perfil = await a.http.get('/api/v1/profile').set('Authorization', `Bearer ${r.body.token}`);
      expect(perfil.status).toBe(200);
    });

    it('guarda senha e resposta como hash, nunca em texto', async () => {
      await cadastrar();
      const [linha] = await a.banco.query('SELECT password_hash, security_answer_hash FROM employee');
      expect(linha.password_hash).toMatch(/^scrypt\$/);
      expect(linha.security_answer_hash).toMatch(/^scrypt\$/);
      expect(linha.password_hash).not.toContain(SENHA);
      expect(linha.security_answer_hash).not.toContain('rex');
    });

    it('guarda o e-mail em minúsculas', async () => {
      const r = await cadastrar({ email: 'Pessoa.Local@Exemplo.Test' });
      expect(r.status).toBe(201);
      expect(r.body.employee.email).toBe('pessoa.local@exemplo.test');
    });

    it('recusa e-mail de domínio não liberado', async () => {
      const r = await cadastrar({ email: 'alguem@outro.com' });
      expect(r.status).toBe(403);
      expect(r.body.code).toBe('EMAIL_NAO_LIBERADO');
    });

    it('recusa e-mail já cadastrado, inclusive com outra caixa de letras', async () => {
      expect((await cadastrar()).status).toBe(201);
      const r = await cadastrar({ email: 'PESSOA.LOCAL@exemplo.test' });
      expect(r.status).toBe(409);
      expect(r.body.code).toBe('EMAIL_JA_CADASTRADO');
    });

    it.each([
      ['senha curta', { password: 'curta123' }],
      ['senha longa demais', { password: 'a'.repeat(129) }],
      ['pergunta inexistente', { security_question_id: 'qualquer' }],
      ['resposta vazia', { security_answer: ' ' }],
      ['nome curto', { name: 'A' }],
      ['e-mail inválido', { email: 'sem-arroba' }],
    ])('recusa dados inválidos: %s', async (_, extra) => {
      const r = await cadastrar(extra);
      expect(r.status).toBe(400);
      expect(await a.banco.query('SELECT id FROM employee')).toHaveLength(0);
    });
  });

  describe('login', () => {
    it('entra com e-mail e senha corretos, ignorando a caixa do e-mail', async () => {
      await cadastrar();
      const r = await entrar('PESSOA.local@exemplo.test', SENHA);
      expect(r.status).toBe(200);
      expect(r.body.is_new).toBe(false);
      expect(r.body.employee.email).toBe('pessoa.local@exemplo.test');
    });

    it('usa a mesma mensagem para senha errada e para e-mail inexistente', async () => {
      await cadastrar();
      const errada = await entrar('pessoa.local@exemplo.test', 'senha-errada-123');
      const inexistente = await entrar('ninguem@exemplo.test', SENHA);
      expect(errada.status).toBe(401);
      expect(inexistente.status).toBe(401);
      expect(errada.body.message).toBe(inexistente.body.message);
    });

    it('não permite entrar em conta sem senha local (criada por outro provedor)', async () => {
      await a.criarPessoa({ nome: 'Sem Senha' });
      const r = await entrar('sem.senha@exemplo.test', SENHA);
      expect(r.status).toBe(401);
    });

    it('não permite entrar em conta inativa', async () => {
      await cadastrar();
      await a.banco.query('UPDATE employee SET is_active = false');
      expect((await entrar('pessoa.local@exemplo.test', SENHA)).status).toBe(401);
    });

    it('recusa corpo sem senha', async () => {
      const r = await a.http.post('/api/v1/auth/login').send({ email: 'pessoa.local@exemplo.test' });
      expect(r.status).toBe(400);
    });
  });

  describe('recuperação de senha', () => {
    it('devolve a pergunta cadastrada', async () => {
      await cadastrar();
      const r = await a.http.post('/api/v1/auth/recovery-question').send({ email: 'pessoa.local@exemplo.test' });
      expect(r.status).toBe(200);
      expect(r.body.available).toBe(true);
      expect(r.body.question).toMatch(/animal/i);
    });

    it('para e-mail inexistente e conta sem pergunta responde sem pergunta', async () => {
      await a.criarPessoa({ nome: 'Sem Pergunta' });
      for (const email of ['ninguem@exemplo.test', 'sem.pergunta@exemplo.test']) {
        const r = await a.http.post('/api/v1/auth/recovery-question').send({ email });
        expect(r.status).toBe(200);
        expect(r.body).toEqual({ question: null, available: false });
      }
    });

    it('redefine a senha com a resposta certa, mesmo com acento e caixa diferentes', async () => {
      await cadastrar({ security_question_id: 'cidade_nascimento', security_answer: 'São Paulo' });
      const r = await a.http
        .post('/api/v1/auth/reset-password')
        .send({ email: 'pessoa.local@exemplo.test', security_answer: '  sao PAULO ', new_password: 'nova-senha-456' });
      expect(r.status).toBe(200);
      expect((await entrar('pessoa.local@exemplo.test', SENHA)).status).toBe(401);
      expect((await entrar('pessoa.local@exemplo.test', 'nova-senha-456')).status).toBe(200);
    });

    it('com a resposta errada mantém a senha antiga', async () => {
      await cadastrar();
      const r = await a.http
        .post('/api/v1/auth/reset-password')
        .send({ email: 'pessoa.local@exemplo.test', security_answer: 'Outro', new_password: 'nova-senha-456' });
      expect(r.status).toBe(401);
      expect((await entrar('pessoa.local@exemplo.test', SENHA)).status).toBe(200);
    });

    it('não redefine conta inexistente nem conta sem pergunta, com a mesma mensagem', async () => {
      await a.criarPessoa({ nome: 'Sem Pergunta' });
      const corpo = (email) => ({ email, security_answer: 'qualquer', new_password: 'nova-senha-456' });
      const inexistente = await a.http.post('/api/v1/auth/reset-password').send(corpo('ninguem@exemplo.test'));
      const semPergunta = await a.http.post('/api/v1/auth/reset-password').send(corpo('sem.pergunta@exemplo.test'));
      expect(inexistente.status).toBe(401);
      expect(semPergunta.status).toBe(401);
      expect(inexistente.body.message).toBe(semPergunta.body.message);
    });

    it('recusa nova senha curta', async () => {
      await cadastrar();
      const r = await a.http
        .post('/api/v1/auth/reset-password')
        .send({ email: 'pessoa.local@exemplo.test', security_answer: 'Rex', new_password: 'curta' });
      expect(r.status).toBe(400);
    });

    it.todo('bloqueia a redefinição por conta depois de erros repetidos na resposta de segurança');
    it.todo('invalida os tokens emitidos antes da redefinição de senha');
  });
});
