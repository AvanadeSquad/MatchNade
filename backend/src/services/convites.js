import { proibido } from '../utils/erros.js';
import { bloqueadoEntre } from './bloqueios.js';
import { buscarConexaoDoParticipante, outraPessoa } from './conexoes.js';

export const DURACAO_PADRAO_MINUTOS = 15;

const primeiroNome = (nome) =>
  String(nome ?? '')
    .trim()
    .split(/\s+/)[0] || 'colega';
const codificar = encodeURIComponent;

// Conversa direta no Teams. O endereço é do domínio corporativo da pessoa.
export const linkDoTeams = (email) => `https://teams.microsoft.com/l/chat/0/0?users=${codificar(email)}`;

export const assuntoDoConvite = (meuNome, outroNome) => `Coffee Chat: ${primeiroNome(meuNome)} e ${primeiroNome(outroNome)}`;

export const descricaoDoConvite = (minutos) => `Coffee Chat virtual de ${minutos} minutos, combinado pelo Avanade Connect.`;

// Abre o calendário do Outlook na web com o evento já preenchido.
export function linkDoOutlook({ assunto, descricao, inicio, fim, email }) {
  const parametros = {
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: assunto,
    body: descricao,
    startdt: inicio.toISOString(),
    enddt: fim.toISOString(),
    to: email,
  };
  const consulta = Object.entries(parametros)
    .map(([chave, valor]) => `${chave}=${codificar(valor)}`)
    .join('&');
  return `https://outlook.office.com/calendar/0/deeplink/compose?${consulta}`;
}

const dataIcs = (data) =>
  data
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
const escaparTexto = (texto) => String(texto).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
// Parâmetros entre aspas não podem conter aspas nem controles.
const escaparParametro = (texto) => `"${String(texto).replace(/["\r\n]/g, ' ')}"`;

// Linhas do iCalendar têm no máximo 75 octetos; a continuação começa com um espaço.
function dobrarLinha(linha) {
  const partes = [];
  let atual = '';
  let tamanho = 0;
  for (const caractere of linha) {
    const octetos = Buffer.byteLength(caractere);
    const limite = partes.length === 0 ? 75 : 74;
    if (tamanho + octetos > limite) {
      partes.push(atual);
      atual = '';
      tamanho = 0;
    }
    atual += caractere;
    tamanho += octetos;
  }
  partes.push(atual);
  return partes.map((p, i) => (i === 0 ? p : ` ${p}`)).join('\r\n');
}

// Arquivo .ics (RFC 5545) de um evento único. `agora` existe para os testes fixarem o DTSTAMP.
export function gerarIcs({ conexaoId, assunto, descricao, inicio, fim, organizador, convidado, agora = new Date() }) {
  const linhas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Avanade Connect//Coffee Chat//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:coffee-chat-${conexaoId}-${dataIcs(inicio)}@avanade-connect`,
    `DTSTAMP:${dataIcs(agora)}`,
    `DTSTART:${dataIcs(inicio)}`,
    `DTEND:${dataIcs(fim)}`,
    `SUMMARY:${escaparTexto(assunto)}`,
    `DESCRIPTION:${escaparTexto(descricao)}`,
    `ORGANIZER;CN=${escaparParametro(organizador.nome)}:mailto:${organizador.email}`,
    `ATTENDEE;CN=${escaparParametro(convidado.nome)};RSVP=TRUE:mailto:${convidado.email}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${linhas.map(dobrarLinha).join('\r\n')}\r\n`;
}

// Dados das duas pessoas de uma conexão aceita e sem bloqueio. Qualquer outra situação é 403.
async function dadosDoContato({ banco }, meuId, conexaoId) {
  const conexao = await buscarConexaoDoParticipante(banco.query, conexaoId, meuId);
  const outroId = outraPessoa(conexao, meuId);
  if (conexao.status !== 'ACCEPTED' || (await bloqueadoEntre(banco.query, meuId, outroId))) {
    throw proibido('SEM_MATCH', 'Os atalhos do Teams e do Outlook só existem depois do match.');
  }
  const pessoas = await banco.query('SELECT id, name, email FROM employee WHERE id IN ($1, $2) AND is_active', [meuId, outroId]);
  const eu = pessoas.find((p) => p.id === meuId);
  const outro = pessoas.find((p) => p.id === outroId);
  if (!eu || !outro) throw proibido('SEM_MATCH', 'Esta conversa não está disponível.');
  return { eu, outro };
}

export async function contatoDaConexao(ctx, meuId, conexaoId) {
  const { outro } = await dadosDoContato(ctx, meuId, conexaoId);
  return { teams_url: linkDoTeams(outro.email) };
}

export async function conviteDaConexao(ctx, meuId, conexaoId, { inicio, minutos = DURACAO_PADRAO_MINUTOS }) {
  const { eu, outro } = await dadosDoContato(ctx, meuId, conexaoId);
  const comeco = new Date(inicio);
  const fim = new Date(comeco.getTime() + minutos * 60_000);
  const assunto = assuntoDoConvite(eu.name, outro.name);
  const descricao = descricaoDoConvite(minutos);
  return {
    outlook_url: linkDoOutlook({ assunto, descricao, inicio: comeco, fim, email: outro.email }),
    ics: gerarIcs({
      conexaoId,
      assunto,
      descricao,
      inicio: comeco,
      fim,
      organizador: { nome: eu.name, email: eu.email },
      convidado: { nome: outro.name, email: outro.email },
    }),
    ics_filename: `coffee-chat-${comeco.toISOString().slice(0, 10)}.ics`,
  };
}
