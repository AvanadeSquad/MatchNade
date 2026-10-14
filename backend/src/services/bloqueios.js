import { invalido, naoEncontrado } from '../utils/erros.js';
import { limparTexto } from '../utils/tags.js';

// Há bloqueio em qualquer direção entre as duas pessoas?
export async function bloqueadoEntre(consulta, a, b) {
  const [linha] = await consulta(
    `SELECT 1 AS existe FROM employee_block
      WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1) LIMIT 1`,
    [a, b],
  );
  return Boolean(linha);
}

async function garantirDestino(banco, meuId, alvoId) {
  if (alvoId === meuId) throw invalido('ALVO_INVALIDO', 'Você não pode fazer isso consigo mesmo.');
  const [alvo] = await banco.query('SELECT id FROM employee WHERE id = $1 AND is_active', [alvoId]);
  if (!alvo) throw naoEncontrado('Pessoa não encontrada.');
}

export async function bloquear(banco, meuId, alvoId) {
  await garantirDestino(banco, meuId, alvoId);
  await banco.query('INSERT INTO employee_block (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [meuId, alvoId]);
}

export async function desbloquear(banco, meuId, alvoId) {
  await banco.query('DELETE FROM employee_block WHERE blocker_id = $1 AND blocked_id = $2', [meuId, alvoId]);
}

export function listarBloqueados(banco, meuId) {
  return banco.query(
    `SELECT e.id, e.name FROM employee_block b JOIN employee e ON e.id = b.blocked_id
      WHERE b.blocker_id = $1 ORDER BY b.created_at DESC`,
    [meuId],
  );
}

export async function denunciar(banco, meuId, alvoId, motivo) {
  await garantirDestino(banco, meuId, alvoId);
  const texto = limparTexto(motivo);
  if (!texto) throw invalido('MOTIVO_OBRIGATORIO', 'Informe o motivo.');
  await banco.query('INSERT INTO employee_report (reporter_id, reported_id, reason) VALUES ($1, $2, $3)', [
    meuId,
    alvoId,
    texto.slice(0, 500),
  ]);
}
