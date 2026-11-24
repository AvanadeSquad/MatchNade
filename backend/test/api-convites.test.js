import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { assuntoDoConvite, gerarIcs, linkDoOutlook, linkDoTeams } from '../src/services/convites.js';
import { criarAmbiente } from './ajudante.js';

const ia = { extrairTags: vi.fn(), gerarQuebraGelo: vi.fn() };
const INICIO = '2026-11-10T13:30:00.000Z';

describe('atalhos do Teams e do Outlook', () => {
  let a;
  let ana;
  let bruno;
  let camila;
  let conexao;

  beforeAll(async () => {
    a = await criarAmbiente({ ia });
  });
  afterAll(() => a.fechar());

  beforeEach(async () => {
    await a.limpar();
    ana = await a.criarPessoa({ nome: 'Ana Silva', tecnicas: ['React', 'Node.js'], hobbies: ['Xadrez'], cargo: 'Gerente de UX' });
    bruno = await a.criarPessoa({ nome: 'Bruno Lima', tecnicas: ['Node.js', 'Azure'], hobbies: ['Xadrez'], cargo: 'Engenheiro Sênior' });
    camila = await a.criarPessoa({ nome: 'Camila Rocha', tecnicas: ['Azure', 'Terraform'], hobbies: ['Corrida'] });
    conexao = (await a.como(ana.email).post('/matches', { receiver_id: bruno.id })).body.match_id;
  });

  const aceitar = () => a.como(bruno.email).post('/matches', { receiver_id: ana.id });

  describe('antes do match', () => {
    it('contato e convite devolvem 403 SEM_MATCH', async () => {
      for (const r of [
        await a.como(ana.email).get(`/matches/${conexao}/contact`),
        await a.como(ana.email).get(`/matches/${conexao}/invite?start=${INICIO}`),
        await a.como(bruno.email).get(`/matches/${conexao}/contact`),
      ]) {
        expect(r.status).toBe(403);
        expect(r.body.code).toBe('SEM_MATCH');
        expect(JSON.stringify(r.body)).not.toContain('exemplo.test');
      }
    });
  });

  describe('depois do match', () => {
    beforeEach(aceitar);

    it('as duas pessoas recebem o link do Teams com o e-mail da outra', async () => {
      const deAna = await a.como(ana.email).get(`/matches/${conexao}/contact`);
      expect(deAna.status).toBe(200);
      expect(deAna.body).toEqual({ teams_url: `https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(bruno.email)}` });
      const deBruno = await a.como(bruno.email).get(`/matches/${conexao}/contact`);
      expect(deBruno.body.teams_url).toContain(encodeURIComponent(ana.email));
    });

    it('quem não participa da conexão recebe 404', async () => {
      expect((await a.como(camila.email).get(`/matches/${conexao}/contact`)).status).toBe(404);
      expect((await a.como(camila.email).get(`/matches/${conexao}/invite?start=${INICIO}`)).status).toBe(404);
    });

    it('bloqueio entre as pessoas fecha os atalhos', async () => {
      await a.como(ana.email).post(`/employees/${bruno.id}/block`);
      for (const quem of [ana, bruno]) {
        const r = await a.como(quem.email).get(`/matches/${conexao}/contact`);
        expect(r.status).toBe(403);
        expect(r.body.code).toBe('SEM_MATCH');
      }
    });

    it('o convite traz o link do Outlook e o .ics com horário, duração e participantes', async () => {
      const r = await a.como(ana.email).get(`/matches/${conexao}/invite?start=${INICIO}&minutes=30`);
      expect(r.status).toBe(200);
      const url = new URL(r.body.outlook_url);
      expect(url.origin + url.pathname).toBe('https://outlook.office.com/calendar/0/deeplink/compose');
      expect(url.searchParams.get('startdt')).toBe(INICIO);
      expect(url.searchParams.get('enddt')).toBe('2026-11-10T14:00:00.000Z');
      expect(url.searchParams.get('to')).toBe(bruno.email);
      expect(url.searchParams.get('subject')).toBe('Coffee Chat: Ana e Bruno');

      expect(r.body.ics_filename).toBe('coffee-chat-2026-11-10.ics');
      expect(r.body.ics).toContain('DTSTART:20261110T133000Z');
      expect(r.body.ics).toContain('DTEND:20261110T140000Z');
      expect(r.body.ics).toContain(`mailto:${bruno.email}`);
      expect(r.body.ics).toContain(`mailto:${ana.email}`);
    });

    it('a duração padrão é de 15 minutos', async () => {
      const r = await a.como(ana.email).get(`/matches/${conexao}/invite?start=${INICIO}`);
      expect(new URL(r.body.outlook_url).searchParams.get('enddt')).toBe('2026-11-10T13:45:00.000Z');
    });

    it('nunca expõe cargo nem senioridade', async () => {
      const r = await a.como(ana.email).get(`/matches/${conexao}/invite?start=${INICIO}`);
      expect(JSON.stringify(r.body)).not.toMatch(/Gerente|Engenheiro|Sênior|position|cargo/);
    });

    it('recusa início ausente, sem fuso ou inválido e duração fora de 15 a 120', async () => {
      for (const consulta of [
        '',
        '?start=amanha',
        '?start=2026-11-10T13:30:00',
        `?start=${INICIO}&minutes=5`,
        `?start=${INICIO}&minutes=500`,
        `?start=${INICIO}&minutes=abc`,
      ]) {
        const r = await a.como(ana.email).get(`/matches/${conexao}/invite${consulta}`);
        expect(r.status, consulta).toBe(400);
      }
    });

    it('exige login', async () => {
      expect((await a.http.get(`/api/v1/matches/${conexao}/contact`)).status).toBe(401);
      expect((await a.http.get(`/api/v1/matches/${conexao}/invite?start=${INICIO}`)).status).toBe(401);
    });
  });
});

describe('montagem dos links e do .ics', () => {
  it('codifica o e-mail no link do Teams', () => {
    expect(linkDoTeams('ana+teste@exemplo.test')).toBe('https://teams.microsoft.com/l/chat/0/0?users=ana%2Bteste%40exemplo.test');
  });

  it('usa só o primeiro nome no assunto', () => {
    expect(assuntoDoConvite('Ana Maria Silva', 'Bruno Lima')).toBe('Coffee Chat: Ana e Bruno');
  });

  it('codifica caracteres especiais no link do Outlook', () => {
    const url = new URL(
      linkDoOutlook({
        assunto: 'Café & Papo',
        descricao: 'a=b&c=d #1',
        inicio: new Date(INICIO),
        fim: new Date('2026-11-10T13:45:00.000Z'),
        email: 'ana@exemplo.test',
      }),
    );
    expect(url.searchParams.get('subject')).toBe('Café & Papo');
    expect(url.searchParams.get('body')).toBe('a=b&c=d #1');
    expect(url.searchParams.get('rru')).toBe('addevent');
  });

  const base = {
    conexaoId: 7,
    assunto: 'Coffee Chat: Ana e Bruno',
    descricao: 'Texto, com; pontuação\nem duas linhas',
    inicio: new Date(INICIO),
    fim: new Date('2026-11-10T13:45:00.000Z'),
    organizador: { nome: 'Ana Silva', email: 'ana@exemplo.test' },
    convidado: { nome: 'Bruno "B" Lima', email: 'bruno@exemplo.test' },
    agora: new Date('2026-11-08T12:00:00.000Z'),
  };

  it('gera um calendário válido com CRLF, UID estável e texto escapado', () => {
    const ics = gerarIcs(base);
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
    expect(ics).toContain('UID:coffee-chat-7-20261110T133000Z@avanade-connect');
    expect(ics).toContain('DTSTAMP:20261108T120000Z');
    expect(ics).toContain('DESCRIPTION:Texto\\, com\\; pontuação\\nem duas linhas');
    expect(ics).toContain('ATTENDEE;CN="Bruno  B  Lima";RSVP=TRUE:mailto:bruno@exemplo.test');
    expect(gerarIcs(base)).toBe(ics);
  });

  it('dobra linhas longas em até 75 octetos sem quebrar caracteres acentuados', () => {
    const ics = gerarIcs({ ...base, descricao: 'ação '.repeat(60) });
    const linhas = ics.split('\r\n');
    expect(linhas.every((l) => Buffer.byteLength(l) <= 75)).toBe(true);
    const desdobrado = ics.replace(/\r\n /g, '');
    expect(desdobrado).toContain(`DESCRIPTION:${'ação '.repeat(60)}`);
  });
});
