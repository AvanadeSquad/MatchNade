// Última mensagem lida em cada conversa, guardada no navegador por conta. Serve ao filtro
// "Não lidas" e ao ponto laranja da lista de conversas; a API não registra leitura.
const chave = (usuarioId) => `lidas:${usuarioId}`;

export function lerLidas(usuarioId) {
  try {
    const dados = JSON.parse(localStorage.getItem(chave(usuarioId)) ?? '{}');
    return dados && typeof dados === 'object' ? dados : {};
  } catch {
    return {};
  }
}

export function marcarLida(usuarioId, conexaoId, mensagemId) {
  const lidas = lerLidas(usuarioId);
  if ((lidas[conexaoId] ?? 0) >= mensagemId) return lidas;
  lidas[conexaoId] = mensagemId;
  try {
    localStorage.setItem(chave(usuarioId), JSON.stringify(lidas));
  } catch {
    // Sem armazenamento, a leitura vale só nesta página.
  }
  return lidas;
}

// Conversa não lida: a última mensagem é da outra pessoa e veio depois da última lida.
export const naoLida = (ultima, conexaoId, usuarioId, lidas) =>
  Boolean(ultima && ultima.sender_id !== usuarioId && ultima.id > (lidas[conexaoId] ?? 0));
