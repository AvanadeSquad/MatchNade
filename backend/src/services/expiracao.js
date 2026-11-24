// Solicitações pendentes há mais de `dias` viram EXPIRED.
export async function expirarPendentes(consulta, dias) {
  await consulta(
    `UPDATE connection_match SET status = 'EXPIRED'
      WHERE status = 'PENDING' AND created_at < NOW() - ($1 || ' days')::interval`,
    [String(dias)],
  );
}
