import { conflito, invalido } from '../utils/erros.js';

// Dias entre o pedido de exclusão e o apagamento definitivo.
export const PRAZO_EXCLUSAO_DIAS = 30;

// Chave da trava consultiva da varredura, diferente das travas das migrações (724001) e do seed (724002).
const TRAVA_VARREDURA = 724003;
const MOTIVO_MAX = 300;
const DIA_MS = 86_400_000;

export const previstoPara = (pedidoEm) => new Date(new Date(pedidoEm).getTime() + PRAZO_EXCLUSAO_DIAS * DIA_MS);

// Tira do texto livre da denúncia o que identifica alguém: e-mail, link e telefone. Nomes não dá para
// detectar, então o texto arquivado continua sem nenhuma ligação com a pessoa denunciada.
export function sanitizarMotivoDenuncia(texto) {
  return String(texto ?? '')
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[removido]')
    .replace(/https?:\/\/\S+|www\.\S+/gi, '[removido]')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '[removido]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MOTIVO_MAX)
    .trim();
}

// Copia as denúncias recebidas para o arquivo anônimo. Roda na mesma transação que apaga a pessoa.
export async function arquivarDenunciasRecebidas(consulta, id) {
  const denuncias = await consulta('SELECT reason, created_at FROM employee_report WHERE reported_id = $1', [id]);
  for (const denuncia of denuncias) {
    const motivo = sanitizarMotivoDenuncia(denuncia.reason);
    if (!motivo) continue;
    await consulta('INSERT INTO moderation_report_archive (reason, created_at) VALUES ($1, $2)', [motivo, denuncia.created_at]);
  }
}

// Apaga a pessoa de vez. Os registros de IA guardam tags derivadas da bio, por isso saem junto; as demais
// tabelas caem em cascata. Deve rodar dentro de uma transação.
export async function excluirDefinitivamente(consulta, id) {
  await arquivarDenunciasRecebidas(consulta, id);
  await consulta('DELETE FROM ai_interaction_log WHERE employee_id = $1', [id]);
  await consulta('DELETE FROM employee WHERE id = $1', [id]);
}

// Marca a conta para exclusão: oculta a pessoa e derruba todas as sessões. Exige o e-mail da própria conta.
export async function solicitarExclusao(banco, id, emailInformado) {
  const [conta] = await banco.query('SELECT email FROM employee WHERE id = $1', [id]);
  const informado = String(emailInformado ?? '')
    .trim()
    .toLowerCase();
  if (!conta || !informado || informado !== conta.email.toLowerCase()) {
    throw invalido('CONFIRMACAO_INVALIDA', 'Digite o e-mail da sua conta para confirmar a exclusão.');
  }
  const [marcada] = await banco.query(
    `UPDATE employee
        SET is_active = false, deletion_requested_at = NOW(), token_version = token_version + 1
      WHERE id = $1 AND deletion_requested_at IS NULL
      RETURNING deletion_requested_at`,
    [id],
  );
  if (!marcada) throw conflito('EXCLUSAO_JA_SOLICITADA', 'A exclusão desta conta já foi solicitada.');
  return { requested_at: marcada.deletion_requested_at, scheduled_for: previstoPara(marcada.deletion_requested_at) };
}

// Desfaz o pedido dentro do prazo. As conexões e as mensagens voltam, porque nada foi apagado.
export async function cancelarExclusao(banco, id) {
  const [cancelada] = await banco.query(
    `UPDATE employee SET is_active = true, deletion_requested_at = NULL
      WHERE id = $1 AND deletion_requested_at IS NOT NULL RETURNING id`,
    [id],
  );
  if (!cancelada) throw conflito('SEM_EXCLUSAO_PENDENTE', 'Esta conta não está marcada para exclusão.');
}

// Apaga as contas cujo prazo venceu. Sob trava consultiva: duas varreduras ao mesmo tempo (ou duas
// instâncias da API) não se atropelam, porque a segunda espera a primeira terminar e então não acha mais nada
// vencido. Espera em vez de desistir: desistir devolveria 0 mesmo com contas vencidas, e a trava vale para o
// banco inteiro. Devolve quantas contas apagou.
export async function varrerContasVencidas(banco, { agora = new Date(), dias = PRAZO_EXCLUSAO_DIAS } = {}) {
  return banco.tx(async ({ query }) => {
    await query('SELECT pg_advisory_xact_lock($1)', [TRAVA_VARREDURA]);
    const vencidas = await query(
      `SELECT id FROM employee
        WHERE deletion_requested_at IS NOT NULL AND deletion_requested_at <= $1::timestamptz - make_interval(days => $2::int)
        ORDER BY id`,
      [agora.toISOString(), dias],
    );
    for (const { id } of vencidas) await excluirDefinitivamente(query, id);
    return vencidas.length;
  });
}

// Varredura chamada de vários pontos (início da API, a cada hora e no login). `executar` roda no máximo uma
// vez por `minimoMs` e nunca lança: um erro da varredura não pode derrubar quem entrou na API.
// `relogio` existe para os testes.
export function criarLimpeza({ banco, log, intervaloMs = 3_600_000, minimoMs = 300_000, relogio = () => Date.now() }) {
  let ultima = Number.NEGATIVE_INFINITY;
  let rodando = false;

  async function executar() {
    const agora = relogio();
    if (rodando || agora - ultima < minimoMs) return;
    rodando = true;
    ultima = agora;
    try {
      const quantidade = await varrerContasVencidas(banco);
      if (quantidade > 0) log.info('contas excluídas', { quantidade });
    } catch (erro) {
      log.error('falha na varredura de contas vencidas', { mensagem: erro?.message });
    } finally {
      rodando = false;
    }
  }

  // Roda agora e a cada `intervaloMs`. O timer não segura o processo aberto. Devolve a função que o para.
  function iniciar() {
    executar();
    const timer = setInterval(executar, intervaloMs);
    timer.unref?.();
    return () => clearInterval(timer);
  }

  return { executar, iniciar };
}
