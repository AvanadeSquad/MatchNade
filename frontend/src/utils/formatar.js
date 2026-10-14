// Iniciais do nome para o avatar: primeira letra do primeiro e do último nome.
export function iniciais(nome = '') {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (primeira + ultima).toUpperCase();
}

// 0.62 -> "62%"
export const porcentagem = (valor) => `${Math.round((valor ?? 0) * 100)}%`;

const formatadorHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
export const hora = (iso) => formatadorHora.format(new Date(iso));

// Junta nomes em português: "A", "A e B", "A, B e C".
export function listaEmTexto(itens) {
  if (itens.length <= 1) return itens.join('');
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`;
}

// "Tecnologia e Inovação • São Paulo", omitindo o que estiver vazio.
export const unidadeECidade = (unidade, cidade) => [unidade, cidade].filter(Boolean).join(' • ');
