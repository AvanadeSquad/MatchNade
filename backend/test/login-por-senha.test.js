import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { BLOQUEIO_SEGUNDOS, MAXIMO_DE_FALHAS } from '../src/services/credenciais.js';
import { criarSenhas, validarSenhaNova } from '../src/services/senhas.js';
import { criarAmbiente, senhasDeTeste } from './ajudante.js';

const SENHA = 'uma senha comprida e boa';
const ERRO_GENERICO = /E-mail ou senha incorretos/;

describe('hash de senha', () => {
  const senhas = senhasDeTeste();

  it('guarda sal e custo junto do hash e confere a senha certa', async () => {
    const hash = await senhas.gerarHash(SENHA);
    expect(hash).toMatch(/^scrypt\$1024\$8\$1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    expect(await senhas.conferir(SENHA, hash)).toBe(true);
    expect(await senhas.conferir('outra senha qualquer', hash)).toBe(false);
  });

  it('a mesma senha gera hashes diferentes por causa do sal', async () => {
    expect(await senhas.gerarHash(SENHA)).not.toBe(await senhas.gerarHash(SENHA));
  });

  it('um hash gerado com outro custo continua válido', async () => {
    const antigo = await criarSenhas({ N: 2 ** 9, r: 8, p: 1 }).gerarHash(SENHA);
    expect(await senhas.conferir(SENHA, antigo)).toBe(true);
  });

  it('recusa hash malformado ou com custo absurdo em vez de falhar', async () => {
    expect(await senhas.conferir(SENHA, 'texto-solto')).toBe(false);
    expect(await senhas.conferir(SENHA, 'bcrypt$1$2$3$a$b')).toBe(false);
    expect(await senhas.conferir(SENHA, 'scrypt$1073741824$8$1$AAAA$AAAA')).toBe(false);
  });

  it('equivalentes Unicode da mesma senha conferem', async () => {
    const composta = 'senha com acentuação é boa';
    const hash = await senhas.gerarHash(composta);
    expect(await senhas.conferir(composta.normalize('NFD'), hash)).toBe(true);
  });
});

describe('regras da senha nova', () => {
  it('exige entre 10 e 128 caracteres', () => {
    expect(() => validarSenhaNova('curta', 'a@x.test')).toThrow(/pelo menos 10/);
    expect(() => validarSenhaNova('a'.repeat(129), 'a@x.test')).toThrow(/no máximo 128/);
    expect(() => validarSenhaNova('1234567890', 'a@x.test')).not.toThrow();
  });

  it('recusa e-mail, parte do e-mail antes do arroba e senha repetitiva', () => {
    expect(() => validarSenhaNova('pessoa.longa@exemplo.test', 'pessoa.longa@exemplo.test')).toThrow(/igual ao seu e-mail/);
    expect(() => validarSenhaNova('pessoa.longa', 'pessoa.longa@exemplo.test')).toThrow(/igual ao seu e-mail/);
    expect(() => validarSenhaNova('aaaaaaaaaaaa', 'outra@exemplo.test')).toThrow(/repetitiva/);
  });
});

describe('login por senha', () => {
  let a;
  let ana;
  beforeAll(async () => {
    a = await criarAmbiente({ ambiente: { ALLOWED_EMAIL_DOMAINS: 'exemplo.test' } });
  });
  afterAll(() => a.fechar());
  beforeEach(async () => {
    await a.limpar();
    ana = await a.criarPessoa({ nome: 'Ana Senha', tecnicas: ['React'] });
  });

  const entrar = (email, senha) => a.http.post('/api/v1/auth/senha').send({ email, senha });
  const definir = async (corpo, email = ana.email) => await a.como(email).put('/auth/senha', corpo);

  it('definir a senha exige login', async () => {
    expect((await a.http.put('/api/v1/auth/senha').send({ nova_senha: SENHA })).status).toBe(401);
  });

  it('quem ainda não tem senha a define e o perfil passa a informar has_password', async () => {
    expect((await a.como(ana.email).get('/profile')).body.has_password).toBe(false);
    const r = await definir({ nova_senha: SENHA });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ has_password: true });
    expect((await a.como(ana.email).get('/profile')).body.has_password).toBe(true);
  });

  it('nunca devolve o hash ou campos de controle da senha', async () => {
    await definir({ nova_senha: SENHA });
    const texto = JSON.stringify((await a.como(ana.email).get('/profile')).body);
    expect(texto).not.toMatch(/scrypt|password_hash|password_failures|password_locked_until/);
  });

  it('senha fraca é recusada com SENHA_FRACA', async () => {
    const r = await definir({ nova_senha: 'curta' });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('SENHA_FRACA');
  });

  it('entra com e-mail e senha e recebe a sessão da própria pessoa', async () => {
    await definir({ nova_senha: SENHA });
    const r = await entrar(ana.email.toUpperCase(), SENHA);
    expect(r.status).toBe(200);
    expect(r.body.employee.id).toBe(ana.id);
    expect(r.body.is_new).toBe(false);
    const perfil = await a.http.get('/api/v1/profile').set('Authorization', `Bearer ${r.body.token}`);
    expect(perfil.status).toBe(200);
  });

  it('senha errada, e-mail sem conta e conta sem senha recebem a mesma resposta', async () => {
    await definir({ nova_senha: SENHA });
    const semSenha = await a.criarPessoa({ nome: 'Beto Sem Senha' });
    const respostas = [
      await entrar(ana.email, 'senha errada de propósito'),
      await entrar('ninguem@exemplo.test', SENHA),
      await entrar(semSenha.email, SENHA),
    ];
    for (const r of respostas) {
      expect(r.status).toBe(401);
      expect(r.body.code).toBe('NAO_AUTENTICADO');
      expect(r.body.message).toMatch(ERRO_GENERICO);
    }
    expect(new Set(respostas.map((r) => r.body.message)).size).toBe(1);
  });

  it(`bloqueia por ${BLOQUEIO_SEGUNDOS / 60} minutos depois de ${MAXIMO_DE_FALHAS} erros, mesmo com a senha certa`, async () => {
    await definir({ nova_senha: SENHA });
    for (let i = 0; i < MAXIMO_DE_FALHAS; i += 1) expect((await entrar(ana.email, `errada ${i}`)).status).toBe(401);

    const bloqueada = await entrar(ana.email, SENHA);
    expect(bloqueada.status).toBe(401);
    expect(bloqueada.body.message).toMatch(ERRO_GENERICO);

    // Passado o bloqueio, a senha certa volta a funcionar e zera o contador.
    await a.banco.query("UPDATE employee SET password_locked_until = NOW() - INTERVAL '1 second' WHERE id = $1", [ana.id]);
    expect((await entrar(ana.email, SENHA)).status).toBe(200);
    const [conta] = await a.banco.query('SELECT password_failures, password_locked_until FROM employee WHERE id = $1', [ana.id]);
    expect(conta.password_failures).toBe(0);
    expect(conta.password_locked_until).toBeNull();
  });

  it('um acerto no meio zera a contagem de erros', async () => {
    await definir({ nova_senha: SENHA });
    for (let i = 0; i < MAXIMO_DE_FALHAS - 1; i += 1) await entrar(ana.email, `errada ${i}`);
    expect((await entrar(ana.email, SENHA)).status).toBe(200);
    for (let i = 0; i < MAXIMO_DE_FALHAS - 1; i += 1) await entrar(ana.email, `errada ${i}`);
    expect((await entrar(ana.email, SENHA)).status).toBe(200);
  });

  it('pessoa inativa não entra por senha', async () => {
    await definir({ nova_senha: SENHA });
    await a.banco.query('UPDATE employee SET is_active = FALSE WHERE id = $1', [ana.id]);
    expect((await entrar(ana.email, SENHA)).status).toBe(401);
  });

  it('e-mail fora da lista liberada não entra, mesmo com senha guardada', async () => {
    const fora = await a.criarPessoa({ nome: 'Fora Da Lista' });
    await a.banco.query("UPDATE employee SET email = 'fora@outro.com', password_hash = $2 WHERE id = $1", [
      fora.id,
      await senhasDeTeste().gerarHash(SENHA),
    ]);
    expect((await entrar('fora@outro.com', SENHA)).status).toBe(401);
  });

  it('trocar a senha exige a atual, e a antiga deixa de valer', async () => {
    await definir({ nova_senha: SENHA });
    const semAtual = await definir({ nova_senha: 'outra senha ainda melhor' });
    expect(semAtual.status).toBe(403);
    expect(semAtual.body.code).toBe('SENHA_ATUAL_INCORRETA');
    const atualErrada = await definir({ senha_atual: 'não é essa', nova_senha: 'outra senha ainda melhor' });
    expect(atualErrada.status).toBe(403);

    expect((await definir({ senha_atual: SENHA, nova_senha: 'outra senha ainda melhor' })).status).toBe(200);
    expect((await entrar(ana.email, SENHA)).status).toBe(401);
    expect((await entrar(ana.email, 'outra senha ainda melhor')).status).toBe(200);
  });

  it('errar a senha atual na troca também conta para o bloqueio', async () => {
    await definir({ nova_senha: SENHA });
    for (let i = 0; i < MAXIMO_DE_FALHAS; i += 1) await definir({ senha_atual: `errada ${i}`, nova_senha: 'qualquer senha longa' });
    const r = await definir({ senha_atual: SENHA, nova_senha: 'qualquer senha longa' });
    expect(r.status).toBe(429);
    expect(r.body.code).toBe('MUITAS_TENTATIVAS');
  });

  it('corpo inválido recebe 400', async () => {
    expect((await a.http.post('/api/v1/auth/senha').send({ email: 'não é e-mail', senha: 'x' })).status).toBe(400);
    expect((await a.http.post('/api/v1/auth/senha').send({ email: ana.email })).status).toBe(400);
    expect((await a.http.post('/api/v1/auth/senha').send({ email: ana.email, senha: 'a'.repeat(200) })).status).toBe(400);
  });
});
