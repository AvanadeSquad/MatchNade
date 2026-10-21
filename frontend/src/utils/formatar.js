// Iniciais do nome para o avatar: primeira letra do primeiro e do último nome.
export function iniciais(nome = '') {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (primeira + ultima).toUpperCase();
}

export const primeiroNome = (nome = '') => nome.trim().split(/\s+/)[0] ?? '';

// 0.62 -> "62%"
export const porcentagem = (valor) => `${Math.round((valor ?? 0) * 100)}%`;

const formatadorHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
export const hora = (iso) => formatadorHora.format(new Date(iso));

const formatadorDia = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' });
const formatadorDiaCurto = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });
const formatadorSemana = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' });

const mesmoDia = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const capitalizar = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);

// Separador de dia no chat: "Hoje, 14 de outubro", "Ontem, 13 de outubro" ou "12 de outubro".
export function diaDaConversa(iso, agora = new Date()) {
  const data = new Date(iso);
  const ontem = new Date(agora);
  ontem.setDate(agora.getDate() - 1);
  if (mesmoDia(data, agora)) return `Hoje, ${formatadorDia.format(data)}`;
  if (mesmoDia(data, ontem)) return `Ontem, ${formatadorDia.format(data)}`;
  return capitalizar(formatadorDia.format(data));
}

// Horário curto na lista de conversas: "14:08", "Ontem", "Ter" ou "20 out".
export function quandoCurto(iso, agora = new Date()) {
  const data = new Date(iso);
  const ontem = new Date(agora);
  ontem.setDate(agora.getDate() - 1);
  if (mesmoDia(data, agora)) return hora(iso);
  if (mesmoDia(data, ontem)) return 'Ontem';
  if (agora - data < 6 * 24 * 60 * 60 * 1000) return capitalizar(formatadorSemana.format(data).replace('.', ''));
  return formatadorDiaCurto.format(data).replace('.', '');
}

// Junta nomes em português: "A", "A e B", "A, B e C".
export function listaEmTexto(itens) {
  if (itens.length <= 1) return itens.join('');
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`;
}

// "Tecnologia e Inovação • São Paulo", omitindo o que estiver vazio.
export const unidadeECidade = (unidade, cidade) => [unidade, cidade].filter(Boolean).join(' • ');

// Tom do avatar derivado do nome, para cada pessoa ter sempre a mesma cor.
export function tomDoNome(nome = '') {
  let soma = 0;
  for (const letra of nome) soma = (soma * 31 + letra.charCodeAt(0)) % 360;
  return soma;
}
