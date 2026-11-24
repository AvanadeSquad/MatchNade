import { invalido, proibido } from '../utils/erros.js';
import { bloqueadoEntre } from './bloqueios.js';
import { buscarConexaoDoParticipante, outraPessoa } from './conexoes.js';

export const LIMITE_MENSAGEM = 1000;

// O chat só existe para conexões aceitas e sem bloqueio entre as pessoas.
async function exigirChatAberto(consulta, conexaoId, meuId) {
  const conexao = await buscarConexaoDoParticipante(consulta, conexaoId, meuId);
  if (conexao.status !== 'ACCEPTED') throw proibido('SEM_MATCH', 'O chat só abre depois do match.');
  if (await bloqueadoEntre(consulta, meuId, outraPessoa(conexao, meuId))) {
    throw proibido('BLOQUEADO', 'Esta conversa não está disponível.');
  }
  return conexao;
}

// Mensagens com id maior que `depois`, em ordem cronológica. Serve ao polling do chat.
export async function listarMensagens({ banco }, meuId, conexaoId, { depois = 0, limite = 100 } = {}) {
  await exigirChatAberto(banco.query, conexaoId, meuId);
  const mensagens = await banco.query(
    `SELECT id, sender_id, body, created_at FROM chat_message
      WHERE match_id = $1 AND id > $2 ORDER BY id ASC LIMIT $3`,
    [conexaoId, depois, Math.min(Math.max(limite, 1), 200)],
  );
  return { messages: mensagens };
}

export async function enviarMensagem({ banco }, meuId, conexaoId, texto) {
  const corpo = String(texto ?? '').trim();
  if (!corpo) throw invalido('MENSAGEM_VAZIA', 'Escreva uma mensagem.');
  if (corpo.length > LIMITE_MENSAGEM) throw invalido('MENSAGEM_LONGA', `A mensagem pode ter até ${LIMITE_MENSAGEM} caracteres.`);
  await exigirChatAberto(banco.query, conexaoId, meuId);

  const [mensagem] = await banco.query(
    'INSERT INTO chat_message (match_id, sender_id, body) VALUES ($1, $2, $3) RETURNING id, sender_id, body, created_at',
    [conexaoId, meuId, corpo],
  );
  return mensagem;
}
