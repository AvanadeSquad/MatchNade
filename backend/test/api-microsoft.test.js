import { SignJWT, generateKeyPair } from 'jose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { criarVerificadorMicrosoft } from '../src/services/autenticacao.js';
import { configDeTeste, criarAmbiente } from './ajudante.js';

const CLIENTE = 'app-id-de-teste';
const LOCATARIO = '11111111-1111-1111-1111-111111111111';
const OUTRO_LOCATARIO = '22222222-2222-2222-2222-222222222222';
const AMBIENTE = { MICROSOFT_CLIENT_ID: CLIENTE, MICROSOFT_ALLOWED_TENANTS: LOCATARIO };

const claims = (extra = {}) => ({
  tid: LOCATARIO,
  oid: 'oid-da-ana',
  email: 'Ana.Silva@empresa.test',
  name: 'Ana Silva',
  ...extra,
});

describe('verificação do ID token da Microsoft', () => {
  let par;
  let outroPar;
  const chaves = async () => par.publicKey;
  const verificar = (config = configDeTeste(AMBIENTE)) => criarVerificadorMicrosoft(config, { chaves });

  const assinar = async (extra = {}, { chave, emissor, publico = CLIENTE, expira = '5m' } = {}) =>
    new SignJWT(claims(extra))
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(emissor ?? `https://login.microsoftonline.com/${extra.tid ?? LOCATARIO}/v2.0`)
      .setAudience(publico)
      .setExpirationTime(expira)
      .sign(chave ?? par.privateKey);

  beforeAll(async () => {
    par = await generateKeyPair('RS256');
    outroPar = await generateKeyPair('RS256');
  });

  it('aceita um token válido do locatário liberado', async () => {
    const dados = await verificar()(await assinar());
    expect(dados).toMatchObject({ tid: LOCATARIO, oid: 'oid-da-ana' });
  });

  it('recusa assinatura de outra chave', async () => {
    await expect(verificar()(await assinar({}, { chave: outroPar.privateKey }))).rejects.toMatchObject({ status: 401 });
  });

  it('recusa token de outro aplicativo (público diferente)', async () => {
    await expect(verificar()(await assinar({}, { publico: 'outro-app' }))).rejects.toMatchObject({ status: 401 });
  });

  it('recusa token vencido', async () => {
    await expect(verificar()(await assinar({}, { expira: '-1m' }))).rejects.toMatchObject({ status: 401 });
  });

  it('recusa locatário que não está na lista, mesmo com assinatura e público certos', async () => {
    await expect(verificar()(await assinar({ tid: OUTRO_LOCATARIO }))).rejects.toMatchObject({ status: 401 });
  });

  it('recusa emissor que não corresponde ao locatário do token', async () => {
    const emissor = `https://login.microsoftonline.com/${OUTRO_LOCATARIO}/v2.0`;
    await expect(verificar()(await assinar({}, { emissor }))).rejects.toMatchObject({ status: 401 });
  });

  it('recusa token sem locatário', async () => {
    const token = await new SignJWT({ oid: 'x', email: 'a@empresa.test' })
      .setProtectedHeader({ alg: 'RS256' })
      .setAudience(CLIENTE)
      .setExpirationTime('5m')
      .sign(par.privateKey);
    await expect(verificar()(token)).rejects.toMatchObject({ status: 401 });
  });

  it('recusa token sem assinatura (alg none) e texto qualquer', async () => {
    const codificar = (objeto) => Buffer.from(JSON.stringify(objeto)).toString('base64url');
    const semAssinatura = `${codificar({ alg: 'none' })}.${codificar(claims({ aud: CLIENTE }))}.`;
    await expect(verificar()(semAssinatura)).rejects.toMatchObject({ status: 401 });
    await expect(verificar()('texto-qualquer')).rejects.toMatchObject({ status: 401 });
  });

  it('recusa algoritmo simétrico', async () => {
    const segredo = new TextEncoder().encode('segredo-qualquer-de-trinta-e-dois-bytes!!');
    const hs = await new SignJWT(claims()).setProtectedHeader({ alg: 'HS256' }).setAudience(CLIENTE).setExpirationTime('5m').sign(segredo);
    await expect(verificar()(hs)).rejects.toMatchObject({ status: 401 });
  });

  it('sem configuração devolve 503 MICROSOFT_NAO_CONFIGURADA', async () => {
    const semLocatarios = configDeTeste({ MICROSOFT_CLIENT_ID: CLIENTE });
    await expect(verificar(semLocatarios)(await assinar())).rejects.toMatchObject({ status: 503, code: 'MICROSOFT_NAO_CONFIGURADA' });
    await expect(verificar(configDeTeste())(await assinar())).rejects.toMatchObject({ status: 503 });
  });
});

describe('POST /auth/microsoft', () => {
  let a;
  let dados;

  beforeAll(async () => {
    a = await criarAmbiente({
      ambiente: { ...AMBIENTE, ALLOWED_EMAIL_DOMAINS: 'empresa.test' },
      verificadorMicrosoft: async (token) => {
        if (token === 'token-invalido') throw new Error('invalido');
        return dados;
      },
    });
  });
  afterAll(() => a.fechar());
  beforeEach(async () => {
    await a.limpar();
    dados = claims();
  });

  const entrar = (credential = 'token-de-teste-valido') => a.http.post('/api/v1/auth/microsoft').send({ credential });

  it('cria a conta no primeiro acesso, com e-mail em minúsculas e identidade por locatário e oid', async () => {
    const r = await entrar();
    expect(r.status).toBe(200);
    expect(r.body.is_new).toBe(true);
    expect(r.body.employee).toMatchObject({ name: 'Ana Silva', email: 'ana.silva@empresa.test' });
    const [linha] = await a.banco.query('SELECT auth_provider_id FROM employee');
    expect(linha.auth_provider_id).toBe(`microsoft:${LOCATARIO}:oid-da-ana`);
  });

  it('o token devolvido abre as rotas autenticadas', async () => {
    const { body } = await entrar();
    const perfil = await a.http.get('/api/v1/profile').set('Authorization', `Bearer ${body.token}`);
    expect(perfil.status).toBe(200);
  });

  it('no segundo acesso entra na mesma conta', async () => {
    const primeira = await entrar();
    const segunda = await entrar();
    expect(segunda.body.is_new).toBe(false);
    expect(segunda.body.employee.id).toBe(primeira.body.employee.id);
  });

  it('entra na conta já criada com o mesmo e-mail', async () => {
    const existente = await a.criarPessoa({ nome: 'Ana Silva' });
    await a.banco.query('UPDATE employee SET email = $1 WHERE id = $2', ['ana.silva@empresa.test', existente.id]);
    const r = await entrar();
    expect(r.status).toBe(200);
    expect(r.body.is_new).toBe(false);
    expect(r.body.employee.id).toBe(existente.id);
  });

  it('usa o preferred_username quando o token não traz email', async () => {
    dados = claims({ email: undefined, preferred_username: 'Bia@empresa.test' });
    const r = await entrar();
    expect(r.body.employee.email).toBe('bia@empresa.test');
  });

  it('recusa e-mail fora dos domínios liberados com 403 e não cria conta', async () => {
    dados = claims({ email: 'ana@pessoal.test' });
    const r = await entrar();
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('EMAIL_NAO_LIBERADO');
    expect(await a.banco.query('SELECT id FROM employee')).toEqual([]);
  });

  it('recusa token sem oid, sem tid ou sem e-mail válido com 401', async () => {
    for (const extra of [{ oid: undefined }, { tid: undefined }, { email: 'sem-arroba' }, { email: undefined }]) {
      dados = claims(extra);
      expect((await entrar()).status, JSON.stringify(extra)).toBe(401);
    }
  });

  it('token recusado pelo verificador devolve 401 e não cria conta', async () => {
    const r = await entrar('token-invalido');
    expect(r.status).toBe(401);
    expect(await a.banco.query('SELECT id FROM employee')).toEqual([]);
  });

  it('conta inativa devolve 409', async () => {
    const existente = await a.criarPessoa({ nome: 'Ana Silva' });
    await a.banco.query('UPDATE employee SET email = $1, is_active = false WHERE id = $2', ['ana.silva@empresa.test', existente.id]);
    const r = await entrar();
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('CONTA_INATIVA');
  });

  it('exige o campo credential com ao menos 10 caracteres', async () => {
    expect((await a.http.post('/api/v1/auth/microsoft').send({})).status).toBe(400);
    expect((await a.http.post('/api/v1/auth/microsoft').send({ credential: 'curto' })).status).toBe(400);
  });
});

describe('POST /auth/microsoft sem configuração', () => {
  let a;
  beforeAll(async () => {
    a = await criarAmbiente();
  });
  afterAll(() => a.fechar());

  it('devolve 503 MICROSOFT_NAO_CONFIGURADA', async () => {
    const r = await a.http.post('/api/v1/auth/microsoft').send({ credential: 'qualquer-token-longo' });
    expect(r.status).toBe(503);
    expect(r.body.code).toBe('MICROSOFT_NAO_CONFIGURADA');
  });
});
