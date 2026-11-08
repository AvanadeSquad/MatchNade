import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarLimpeza, sanitizarMotivoDenuncia, varrerContasVencidas } from '../src/services/exclusao.js';
import { criarAmbiente } from './ajudante.js';

const ia = { extrairTags: vi.fn(), gerarQuebraGelo: vi.fn() };

describe('exclusão de conta com prazo', () => {
  let a;
  let identidadeMicrosoft = null;
  let ana;
  let bruno;
  let camila;

  beforeAll(async () => {
    a = await criarAmbiente({ ia, verificadorMicrosoft: async () => identidadeMicrosoft });
  });
  afterAll(() => a.fechar());

  beforeEach(async () => {
    await a.limpar();
    await a.banco.exec('TRUNCATE moderation_report_archive RESTART IDENTITY');
    ana = await a.criarPessoa({ nome: 'Ana Silva', tecnicas: ['React', 'Node.js'], hobbies: ['Xadrez'] });
    bruno = await a.criarPessoa({ nome: 'Bruno Lima', tecnicas: ['Node.js', 'Azure'], hobbies: ['Xadrez'] });
    camila = await a.criarPessoa({ nome: 'Camila Rocha', tecnicas: ['Azure', 'Terraform'], hobbies: ['Corrida'] });
  });

  const solicitar = (pessoa, corpo) => a.como(pessoa.email).post('/profile/deletion', corpo);
  const emMatch = async () => {
    const { match_id: id } = (await a.como(ana.email).post('/matches', { receiver_id: bruno.id })).body;
    await a.como(bruno.email).post('/matches', { receiver_id: ana.id });
    return id;
  };
  const marcarHa = (pessoa, dias) =>
    a.banco.query(`UPDATE employee SET deletion_requested_at = NOW() - make_interval(days => $1) WHERE id = $2`, [dias, pessoa.id]);

  describe('pedir a exclusão', () => {
    it('marca a conta, esconde a pessoa e derruba as sessões', async () => {
      const antes = await a.entrar(ana.email);
      const r = await solicitar(ana, { confirm_email: ana.email });
      expect(r.status).toBe(200);
      const pedido = new Date(r.body.requested_at);
      const previsto = new Date(r.body.scheduled_for);
      expect(Math.round((previsto - pedido) / 86_400_000)).toBe(30);

      const [linha] = await a.banco.query('SELECT is_active, deletion_requested_at FROM employee WHERE id = $1', [ana.id]);
      expect(linha.is_active).toBe(false);
      expect(linha.deletion_requested_at).not.toBeNull();

      const velha = await a.http.get('/api/v1/profile').set('Authorization', antes);
      expect(velha.status).toBe(401);
    });

    it('aceita o e-mail com maiúsculas e espaços nas pontas', async () => {
      const r = await solicitar(ana, { confirm_email: `  ${ana.email.toUpperCase()} ` });
      expect(r.status).toBe(200);
    });

    it('recusa e-mail errado, vazio, ausente ou de outra pessoa, sem alterar a conta', async () => {
      for (const corpo of [{ confirm_email: 'outra@exemplo.test' }, { confirm_email: bruno.email }, { confirm_email: '' }, {}]) {
        const r = await solicitar(ana, corpo);
        expect(r.status, JSON.stringify(corpo)).toBe(400);
      }
      expect((await solicitar(ana, { confirm_email: 'outra@exemplo.test' })).body.code).toBe('CONFIRMACAO_INVALIDA');
      const [linha] = await a.banco.query('SELECT is_active, deletion_requested_at FROM employee WHERE id = $1', [ana.id]);
      expect(linha.is_active).toBe(true);
      expect(linha.deletion_requested_at).toBeNull();
    });

    it('exige login', async () => {
      expect((await a.http.post('/api/v1/profile/deletion').send({ confirm_email: ana.email })).status).toBe(401);
    });
  });

  it('cancelar dentro do prazo devolve a conta ao normal, com as conexões e as mensagens', async () => {
    const id = await emMatch();
    await a.como(bruno.email).post(`/matches/${id}/messages`, { body: 'oi' });
    await solicitar(ana, { confirm_email: ana.email });
    const sessao = (await a.http.post('/api/v1/test/login').send({ email: ana.email })).body.token;
    const como = (metodo, caminho, corpo) => {
      const req = a.http[metodo](`/api/v1${caminho}`).set('Authorization', `Bearer ${sessao}`);
      return corpo === undefined ? req : req.send(corpo);
    };

    const r = await como('post', '/profile/deletion/cancel');
    expect(r.status).toBe(200);
    expect(r.body.deletion).toBeNull();
    const lista = await como('get', '/matches');
    expect(lista.status).toBe(200);
    expect(lista.body.confirmadas).toHaveLength(1);
    const mensagens = await como('get', `/matches/${id}/messages`);
    expect(mensagens.body.messages.map((m) => m.body)).toEqual(['oi']);
    const deBruno = await a.como(bruno.email).get('/matches');
    expect(deBruno.body.confirmadas).toHaveLength(1);
  });

  describe('conta marcada', () => {
    let sessao;
    beforeEach(async () => {
      await solicitar(ana, { confirm_email: ana.email });
      sessao = (await a.http.post('/api/v1/test/login').send({ email: ana.email })).body.token;
    });
    const como = (metodo, caminho, corpo) => {
      const req = a.http[metodo](`/api/v1${caminho}`).set('Authorization', `Bearer ${sessao}`);
      return corpo === undefined ? req : req.send(corpo);
    };

    it('consegue entrar e ver o próprio perfil com a data da exclusão', async () => {
      const r = await como('get', '/profile');
      expect(r.status).toBe(200);
      expect(r.body.deletion.requested_at).toBeTruthy();
      expect(r.body.deletion.scheduled_for).toBeTruthy();
    });

    it('as demais rotas respondem 403 CONTA_EM_EXCLUSAO', async () => {
      const chamadas = [
        ['get', '/matches'],
        ['get', '/matches/recommendations'],
        ['put', '/profile', { name: 'Outro Nome' }],
        ['patch', '/profile/pause', { is_paused: true }],
        ['get', '/blocks'],
        ['post', '/profile/deletion', { confirm_email: ana.email }],
      ];
      for (const [metodo, caminho, corpo] of chamadas) {
        const r = await como(metodo, caminho, corpo);
        expect(r.status, `${metodo} ${caminho}`).toBe(403);
        expect(r.body.code).toBe('CONTA_EM_EXCLUSAO');
      }
    });

    it('cancelar sem pedido pendente devolve 409', async () => {
      await como('post', '/profile/deletion/cancel');
      const r = await a.como(bruno.email).post('/profile/deletion/cancel');
      expect(r.status).toBe(409);
      expect(r.body.code).toBe('SEM_EXCLUSAO_PENDENTE');
    });

    it('excluir agora apaga na hora', async () => {
      expect((await como('delete', '/profile')).status).toBe(204);
      expect(await a.banco.query('SELECT id FROM employee WHERE id = $1', [ana.id])).toEqual([]);
    });
  });

  describe('o que as outras pessoas veem', () => {
    it('some das recomendações, do perfil, da lista de conexões e das ações', async () => {
      const id = await emMatch();
      await solicitar(ana, { confirm_email: ana.email });
      const deBruno = a.como(bruno.email);

      const recomendacoes = await deBruno.get('/matches/recommendations');
      expect(recomendacoes.body.recommendations.map((p) => p.employee_id)).not.toContain(ana.id);
      expect((await deBruno.get(`/employees/${ana.id}`)).status).toBe(404);
      expect((await deBruno.get('/matches')).body.confirmadas).toEqual([]);
      expect((await deBruno.post('/matches', { receiver_id: ana.id })).status).toBe(400);
      expect((await deBruno.post(`/employees/${ana.id}/block`)).status).toBe(404);

      for (const r of [
        await deBruno.get(`/matches/${id}/messages`),
        await deBruno.post(`/matches/${id}/messages`, { body: 'oi' }),
        await deBruno.get(`/matches/${id}/icebreaker`),
        await deBruno.get(`/matches/${id}/contact`),
      ]) {
        expect(r.status).toBe(404);
      }
    });

    it('uma solicitação pendente de conta marcada não pode mais ser aceita', async () => {
      const { match_id: id } = (await a.como(ana.email).post('/matches', { receiver_id: bruno.id })).body;
      await solicitar(ana, { confirm_email: ana.email });
      const r = await a.como(bruno.email).patch(`/matches/${id}`, { action: 'accept' });
      expect(r.status).toBe(404);
    });

    it('terceiros não são afetados', async () => {
      await solicitar(ana, { confirm_email: ana.email });
      const r = await a.como(camila.email).get('/matches/recommendations');
      expect(r.status).toBe(200);
    });
  });

  describe('entrar com a conta marcada', () => {
    it('login por e-mail e senha continua funcionando e traz a data da exclusão', async () => {
      const senha = 'senha-segura-123';
      const cadastro = await a.http.post('/api/v1/auth/register').send({
        name: 'Dora Costa',
        email: 'dora.costa@exemplo.test',
        password: senha,
        security_question_id: 'primeiro_pet',
        security_answer: 'rex',
      });
      expect(cadastro.status).toBe(201);
      const token = cadastro.body.token;
      const pedido = await a.http
        .post('/api/v1/profile/deletion')
        .set('Authorization', `Bearer ${token}`)
        .send({ confirm_email: 'dora.costa@exemplo.test' });
      expect(pedido.status).toBe(200);

      const login = await a.http.post('/api/v1/auth/login').send({ email: 'dora.costa@exemplo.test', password: senha });
      expect(login.status).toBe(200);
      expect(login.body.employee.deletion.scheduled_for).toBeTruthy();
      const errada = await a.http.post('/api/v1/auth/login').send({ email: 'dora.costa@exemplo.test', password: 'senha-errada-123' });
      expect(errada.status).toBe(401);
      expect(errada.body.message).toBe('E-mail ou senha incorretos.');
    });

    it('login pela Microsoft entra na conta marcada, em vez de recusar como conta inativa', async () => {
      const pessoa = await a.criarPessoa({ nome: 'Gabi Nunes', tecnicas: ['React'], hobbies: ['Xadrez'] });
      await solicitar(pessoa, { confirm_email: pessoa.email });
      identidadeMicrosoft = { tid: 't1', oid: 'o-gabi', email: pessoa.email, name: 'Gabi Nunes' };
      const r = await a.http.post('/api/v1/auth/microsoft').send({ credential: 'token-da-microsoft-12345' });
      expect(r.status).toBe(200);
      expect(r.body.employee.deletion.scheduled_for).toBeTruthy();
      const cancelar = await a.http.post('/api/v1/profile/deletion/cancel').set('Authorization', `Bearer ${r.body.token}`);
      expect(cancelar.status).toBe(200);
      expect(cancelar.body.deletion).toBeNull();
    });

    it('a redefinição de senha por pergunta de segurança também funciona numa conta marcada', async () => {
      const cadastro = await a.http.post('/api/v1/auth/register').send({
        name: 'Hugo Prado',
        email: 'hugo.prado@exemplo.test',
        password: 'senha-segura-123',
        security_question_id: 'primeiro_pet',
        security_answer: 'rex',
      });
      await a.http
        .post('/api/v1/profile/deletion')
        .set('Authorization', `Bearer ${cadastro.body.token}`)
        .send({ confirm_email: 'hugo.prado@exemplo.test' });
      const pergunta = await a.http.post('/api/v1/auth/recovery-question').send({ email: 'hugo.prado@exemplo.test' });
      expect(pergunta.body.available).toBe(true);
      const redefinir = await a.http
        .post('/api/v1/auth/reset-password')
        .send({ email: 'hugo.prado@exemplo.test', security_answer: 'rex', new_password: 'outra-senha-456' });
      expect(redefinir.status).toBe(200);
      const login = await a.http.post('/api/v1/auth/login').send({ email: 'hugo.prado@exemplo.test', password: 'outra-senha-456' });
      expect(login.status).toBe(200);
      expect(login.body.employee.deletion).not.toBeNull();
    });

    it('conta inativa por outro motivo continua recusada no login', async () => {
      const senha = 'senha-segura-123';
      await a.http.post('/api/v1/auth/register').send({
        name: 'Eva Dias',
        email: 'eva.dias@exemplo.test',
        password: senha,
        security_question_id: 'primeiro_pet',
        security_answer: 'rex',
      });
      await a.banco.query(`UPDATE employee SET is_active = false WHERE email = 'eva.dias@exemplo.test'`);
      const r = await a.http.post('/api/v1/auth/login').send({ email: 'eva.dias@exemplo.test', password: senha });
      expect(r.status).toBe(401);
    });
  });

  describe('exclusão definitiva', () => {
    it('conta com 29 dias fica, com 30 sai', async () => {
      await solicitar(ana, { confirm_email: ana.email });
      await solicitar(bruno, { confirm_email: bruno.email });
      await marcarHa(ana, 29);
      await marcarHa(bruno, 30);
      const apagadas = await varrerContasVencidas(a.banco);
      expect(apagadas).toBe(1);
      const restantes = await a.banco.query('SELECT id FROM employee ORDER BY id');
      expect(restantes.map((p) => p.id)).toEqual([ana.id, camila.id]);
    });

    it('não apaga quem não pediu a exclusão', async () => {
      expect(await varrerContasVencidas(a.banco)).toBe(0);
      expect(await a.banco.query('SELECT id FROM employee')).toHaveLength(3);
    });

    it('apaga conexões, mensagens e bloqueios em cascata e o registro de IA da pessoa', async () => {
      const id = await emMatch();
      await a.como(bruno.email).post(`/matches/${id}/messages`, { body: 'oi' });
      await a.como(ana.email).post(`/employees/${camila.id}/block`);
      await a.banco.query(`INSERT INTO ai_interaction_log (employee_id, prompt_type, prompt_version, status) VALUES ($1, 'x', '1', 'ok')`, [
        ana.id,
      ]);
      await solicitar(ana, { confirm_email: ana.email });
      await marcarHa(ana, 31);
      await varrerContasVencidas(a.banco);
      for (const tabela of ['connection_match', 'chat_message', 'employee_block', 'ai_interaction_log']) {
        const [{ total }] = await a.banco.query(`SELECT COUNT(*)::int AS total FROM ${tabela}`);
        expect(total, tabela).toBe(0);
      }
    });

    it('duas varreduras ao mesmo tempo não falham nem apagam duas vezes', async () => {
      await solicitar(ana, { confirm_email: ana.email });
      await marcarHa(ana, 40);
      const totais = await Promise.all([varrerContasVencidas(a.banco), varrerContasVencidas(a.banco), varrerContasVencidas(a.banco)]);
      expect(totais.reduce((soma, n) => soma + n, 0)).toBe(1);
    });

    it('a varredura preguiçosa roda no máximo uma vez por intervalo e nunca derruba quem chama', async () => {
      await solicitar(ana, { confirm_email: ana.email });
      await marcarHa(ana, 40);
      let agora = 1_000_000;
      const registros = [];
      const limpeza = criarLimpeza({
        banco: a.banco,
        log: { info: (m, d) => registros.push([m, d]), error: () => {} },
        minimoMs: 60_000,
        relogio: () => agora,
      });
      await limpeza.executar();
      expect(registros).toEqual([['contas excluídas', { quantidade: 1 }]]);
      await solicitar(bruno, { confirm_email: bruno.email });
      await marcarHa(bruno, 40);
      agora += 1_000;
      await limpeza.executar();
      expect(await a.banco.query('SELECT id FROM employee WHERE id = $1', [bruno.id])).toHaveLength(1);
      agora += 61_000;
      await limpeza.executar();
      expect(await a.banco.query('SELECT id FROM employee WHERE id = $1', [bruno.id])).toEqual([]);

      const quebrada = criarLimpeza({
        banco: {
          tx: async () => {
            throw new Error('banco fora');
          },
        },
        log: { info() {}, error() {} },
      });
      await expect(quebrada.executar()).resolves.toBeUndefined();
    });
  });

  describe('denúncias recebidas', () => {
    const denunciar = (de, para, motivo) => a.como(de.email).post(`/employees/${para.id}/report`, { reason: motivo });

    it('são arquivadas só com motivo e data, sem nenhuma ligação com a pessoa', async () => {
      await denunciar(bruno, ana, 'Mensagem ofensiva no chat');
      await denunciar(camila, ana, 'Assédio repetido');
      await solicitar(ana, { confirm_email: ana.email });
      await marcarHa(ana, 31);
      await varrerContasVencidas(a.banco);

      const arquivo = await a.banco.query('SELECT * FROM moderation_report_archive ORDER BY id');
      expect(arquivo.map((l) => l.reason)).toEqual(['Mensagem ofensiva no chat', 'Assédio repetido']);
      expect(Object.keys(arquivo[0]).sort()).toEqual(['archived_at', 'created_at', 'id', 'reason']);
      expect(JSON.stringify(arquivo)).not.toMatch(/ana|bruno|camila|exemplo\.test/i);
      expect(await a.banco.query('SELECT id FROM employee_report')).toEqual([]);
    });

    it('denúncias feitas pela própria pessoa são apagadas com ela, sem arquivo', async () => {
      await denunciar(ana, bruno, 'Comportamento inadequado');
      await solicitar(ana, { confirm_email: ana.email });
      await marcarHa(ana, 31);
      await varrerContasVencidas(a.banco);
      expect(await a.banco.query('SELECT id FROM moderation_report_archive')).toEqual([]);
      expect(await a.banco.query('SELECT id FROM employee_report')).toEqual([]);
    });

    it('excluir agora também arquiva as denúncias recebidas', async () => {
      await denunciar(bruno, ana, 'Spam');
      expect((await a.como(ana.email).delete('/profile')).status).toBe(204);
      const arquivo = await a.banco.query('SELECT reason FROM moderation_report_archive');
      expect(arquivo).toEqual([{ reason: 'Spam' }]);
    });

    it('remove e-mail, telefone e link do texto antes de arquivar', async () => {
      await denunciar(
        bruno,
        ana,
        'Escreveu para joao.silva@empresa.com e ligou para (81) 99999-1234 ou +55 81 98888 7777, veja https://site.com/x',
      );
      await a.como(ana.email).delete('/profile');
      const [linha] = await a.banco.query('SELECT reason FROM moderation_report_archive');
      expect(linha.reason).not.toMatch(/@|9999|8888|https?:/);
      expect(linha.reason).toContain('[removido]');
    });
  });
});

describe('sanitizarMotivoDenuncia', () => {
  it('troca e-mail, telefone e link e mantém o resto do texto', () => {
    expect(sanitizarMotivoDenuncia('Falou com a@b.co e 81 99999-0000')).toBe('Falou com [removido] e [removido]');
    expect(sanitizarMotivoDenuncia('Veja www.exemplo.com/abc agora')).toBe('Veja [removido] agora');
  });

  it('não confunde números curtos com telefone', () => {
    expect(sanitizarMotivoDenuncia('Aconteceu 3 vezes em 2026')).toBe('Aconteceu 3 vezes em 2026');
  });

  it('limita o tamanho e junta espaços repetidos', () => {
    const texto = sanitizarMotivoDenuncia(`  muito    espaço ${'x'.repeat(400)}`);
    expect(texto.length).toBeLessThanOrEqual(300);
    expect(texto.startsWith('muito espaço ')).toBe(true);
  });

  it('texto vazio vira vazio', () => {
    expect(sanitizarMotivoDenuncia('')).toBe('');
    expect(sanitizarMotivoDenuncia(null)).toBe('');
  });
});
