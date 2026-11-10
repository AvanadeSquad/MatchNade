import { naoEncontrado } from '../utils/erros.js';

// Reúne tudo o que a pessoa pode levar consigo (LGPD, direito de acesso). Nunca entram: hash de senha, hash da
// resposta de segurança, versão de sessão, contadores de bloqueio e qualquer dado de outra pessoa além do nome
// de quem já era conexão. Conexões com conta oculta ou marcada para exclusão ficam de fora, como no chat.
export async function exportarDados(banco, id) {
  const { query } = banco;
  const [conta] = await query(
    `SELECT id, name, email, bio, position, department, location, connection_goals, max_weekly_matches,
            is_paused, created_at, last_seen_at, deletion_requested_at
       FROM employee WHERE id = $1 AND (is_active OR deletion_requested_at IS NOT NULL)`,
    [id],
  );
  if (!conta) throw naoEncontrado('Perfil não encontrado.');

  const interesses = await query(
    `SELECT t.name, t.category, ei.source
       FROM employee_interest ei JOIN interest_tag t ON t.id = ei.interest_id
      WHERE ei.employee_id = $1 ORDER BY t.name`,
    [id],
  );

  const conexoes = await query(
    `SELECT m.id, m.status, m.created_at, m.responded_at, m.icebreaker,
            (m.requester_id = $1) AS enviada_por_mim, o.name AS outra_pessoa
       FROM connection_match m
       JOIN employee o ON o.id = CASE WHEN m.requester_id = $1 THEN m.receiver_id ELSE m.requester_id END
      WHERE (m.requester_id = $1 OR m.receiver_id = $1) AND o.is_active
      ORDER BY m.id`,
    [id],
  );

  const mensagens = await query(
    `SELECT c.match_id, c.body, c.created_at, (c.sender_id = $1) AS enviada_por_mim
       FROM chat_message c
       JOIN connection_match m ON m.id = c.match_id
       JOIN employee o ON o.id = CASE WHEN m.requester_id = $1 THEN m.receiver_id ELSE m.requester_id END
      WHERE (m.requester_id = $1 OR m.receiver_id = $1) AND o.is_active
      ORDER BY c.id`,
    [id],
  );

  const bloqueios = await query(
    `SELECT o.name AS pessoa, b.created_at
       FROM employee_block b JOIN employee o ON o.id = b.blocked_id
      WHERE b.blocker_id = $1 AND o.is_active ORDER BY b.created_at`,
    [id],
  );

  const denuncias = await query(
    `SELECT o.name AS pessoa, r.reason, r.created_at
       FROM employee_report r JOIN employee o ON o.id = r.reported_id
      WHERE r.reporter_id = $1 AND o.is_active ORDER BY r.id`,
    [id],
  );

  return {
    exported_at: new Date().toISOString(),
    profile: {
      name: conta.name,
      email: conta.email,
      bio: conta.bio,
      position: conta.position,
      department: conta.department,
      location: conta.location,
      connection_goals: conta.connection_goals,
      max_weekly_matches: conta.max_weekly_matches,
      is_paused: conta.is_paused,
      created_at: conta.created_at,
      last_seen_at: conta.last_seen_at,
      deletion_requested_at: conta.deletion_requested_at,
    },
    interests: interesses.map(({ name, category, source }) => ({ name, category, source })),
    connections: conexoes.map((c) => ({
      id: c.id,
      with: c.outra_pessoa,
      status: c.status,
      sent_by_me: c.enviada_por_mim,
      created_at: c.created_at,
      responded_at: c.responded_at,
      icebreaker: c.icebreaker,
    })),
    messages: mensagens.map((m) => ({ connection_id: m.match_id, sent_by_me: m.enviada_por_mim, body: m.body, created_at: m.created_at })),
    blocks: bloqueios.map((b) => ({ person: b.pessoa, created_at: b.created_at })),
    reports_made: denuncias.map((d) => ({ person: d.pessoa, reason: d.reason, created_at: d.created_at })),
  };
}
