// Convites de Coffee Chat trafegam como mensagens comuns do chat, com um prefixo fixo.
// Assim as duas pessoas veem o convite e a resposta sem nenhuma rota nova na API,
// e o texto continua legível para quem ler a mensagem crua.

const PREFIXO = '[Coffee Chat]';
const CONVITE = /^\[Coffee Chat\] Convite para Coffee Chat Virtual \(15 min\)\nSugerido: (.+)$/;
const ACEITE = /^\[Coffee Chat\] Convite aceito: (.+)$/;

export const textoDoConvite = (quando) => `${PREFIXO} Convite para Coffee Chat Virtual (15 min)\nSugerido: ${quando}`;
export const textoDoAceite = (quando) => `${PREFIXO} Convite aceito: ${quando}`;

// Devolve { tipo: 'convite' | 'aceite', quando } ou null para mensagens comuns.
export function lerMensagemDeCafe(corpo = '') {
  const convite = corpo.match(CONVITE);
  if (convite) return { tipo: 'convite', quando: convite[1].trim() };
  const aceite = corpo.match(ACEITE);
  if (aceite) return { tipo: 'aceite', quando: aceite[1].trim() };
  return null;
}

// Último café aceito numa lista de mensagens, ou null.
export function cafeAgendado(mensagens) {
  for (let i = mensagens.length - 1; i >= 0; i -= 1) {
    const cafe = lerMensagemDeCafe(mensagens[i].body);
    if (cafe?.tipo === 'aceite') return cafe.quando;
  }
  return null;
}

const DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

// Próximos dias úteis a partir de amanhã, para a pessoa escolher a data do café.
export function proximosDiasUteis(quantidade = 5, hoje = new Date()) {
  const dias = [];
  const data = new Date(hoje);
  while (dias.length < quantidade) {
    data.setDate(data.getDate() + 1);
    if (data.getDay() === 0 || data.getDay() === 6) continue;
    const dd = String(data.getDate()).padStart(2, '0');
    const mm = String(data.getMonth() + 1).padStart(2, '0');
    dias.push(`${DIAS[data.getDay()]}, ${dd}/${mm}`);
  }
  return dias;
}

export const HORARIOS = ['09:00', '09:30', '10:00', '10:30', '11:00', '14:00', '14:30', '15:00', '16:00', '17:00'];

// Cafés agendados por conversa, guardados no navegador para a lista de matches.
const chave = (usuarioId) => `cafes:${usuarioId}`;

export function lerCafes(usuarioId) {
  try {
    const dados = JSON.parse(localStorage.getItem(chave(usuarioId)) ?? '{}');
    return dados && typeof dados === 'object' ? dados : {};
  } catch {
    return {};
  }
}

export function registrarCafe(usuarioId, conexaoId, quando) {
  const cafes = lerCafes(usuarioId);
  if (cafes[conexaoId] === quando) return;
  if (quando) cafes[conexaoId] = quando;
  else delete cafes[conexaoId];
  try {
    localStorage.setItem(chave(usuarioId), JSON.stringify(cafes));
  } catch {
    // Sem armazenamento, o registro vale só nesta página.
  }
}
