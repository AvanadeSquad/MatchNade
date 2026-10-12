import { conflito, invalido, naoEncontrado, proibido } from '../utils/erros.js';
import { arredondar } from './afinidade.js';
import { expirarPendentes } from './expiracao.js';
import { bloqueadoEntre } from './bloqueios.js';
import { exigirPerfilCompleto, usoDaCota } from './perfil.js';
import { afinidadeEntre, carregarBase } from './recomendacoes.js';

export async function buscarConexaoDoParticipante(consulta, conexaoId, meuId) {
  const [conexao] = await consulta('SELECT * FROM connection_match WHERE id = $1', [conexaoId]);
  if (!conexao || (conexao.requester_id !== meuId && conexao.receiver_id !== meuId)) {
    throw naoEncontrado('Conexão não encontrada.');
  }
  return conexao;
}

export const outraPessoa = (conexao, meuId) => (conexao.requester_id === meuId ? conexao.receiver_id : conexao.requester_id);

// Demonstra interesse. Se a outra pessoa já tinha demonstrado, a conexão vira match (ACCEPTED).
export async function demonstrarInteresse({ banco, config }, meuId, receiverId) {
  if (receiverId === meuId) throw invalido('RECEIVER_INVALIDO', 'Escolha outra pessoa.');
  await expirarPendentes(banco.query, config.regras.diasExpiracao);

  const [destino] = await banco.query('SELECT id, is_paused FROM employee WHERE id = $1 AND is_active', [receiverId]);
  if (!destino || destino.is_paused) throw invalido('RECEIVER_INVALIDO', 'Esta pessoa não está disponível.');
  if (await bloqueadoEntre(banco.query, meuId, receiverId)) {
    throw proibido('BLOQUEADO', 'Não é possível conectar com esta pessoa.');
  }

  const base = await carregarBase(banco.query);
  const eu = base.perfis.get(meuId);
  exigirPerfilCompleto(eu, config.regras.minTags);
  const score = arredondar(afinidadeEntre(base, eu, base.perfis.get(receiverId), config.regras.bonusUnidade).score, 4);

  return banco.tx(async ({ query }) => {
    // Serializa pedidos simultâneos entre o mesmo par de pessoas (A->B e B->A) e os pedidos
    // da mesma pessoa, para o match mútuo e a cota semanal não serem ultrapassados em corrida.
    await query('SELECT pg_advisory_xact_lock($1, $2)', [Math.min(meuId, receiverId), Math.max(meuId, receiverId)]);
    const [{ maximo }] = await query('SELECT max_weekly_matches AS maximo FROM employee WHERE id = $1 FOR UPDATE', [meuId]);

    const existentes = await query(
      `SELECT * FROM connection_match
        WHERE (requester_id = $1 AND receiver_id = $2) OR (requester_id = $2 AND receiver_id = $1)`,
      [meuId, receiverId],
    );
    const minha = existentes.find((c) => c.requester_id === meuId);
    const deles = existentes.find((c) => c.requester_id === receiverId);

    if (deles?.status === 'PENDING') {
      await query(`UPDATE connection_match SET status = 'ACCEPTED', responded_at = NOW() WHERE id = $1`, [deles.id]);
      return { status: 'ACCEPTED', match_id: deles.id, new: true };
    }
    if (deles && deles.status !== 'EXPIRED') throw conflito('JA_EXISTE', 'Você já tem uma conexão com esta pessoa.');
    if (minha && minha.status !== 'EXPIRED') throw conflito('JA_EXISTE', 'Você já demonstrou interesse nesta pessoa.');

    if ((await usoDaCota(query, meuId)) >= maximo) {
      throw proibido('COTA_ESGOTADA', `Você já usou suas ${maximo} solicitações desta semana.`);
    }

    // Uma solicitação expirada pode ser refeita: a mesma linha volta a ser pendente.
    if (minha) {
      await query(
        `UPDATE connection_match SET status = 'PENDING', match_score = $1, created_at = NOW(), responded_at = NULL WHERE id = $2`,
        [score, minha.id],
      );
      return { status: 'PENDING', match_id: minha.id };
    }
    const [criada] = await query(
      `INSERT INTO connection_match (requester_id, receiver_id, status, match_score) VALUES ($1, $2, 'PENDING', $3) RETURNING id`,
      [meuId, receiverId, score],
    );
    return { status: 'PENDING', match_id: criada.id };
  });
}

// Aceita ou recusa uma solicitação recebida. Quem não participa da conexão recebe 404.
export async function responderSolicitacao({ banco, config }, meuId, conexaoId, acao) {
  await expirarPendentes(banco.query, config.regras.diasExpiracao);
  const conexao = await buscarConexaoDoParticipante(banco.query, conexaoId, meuId);
  if (conexao.receiver_id !== meuId) throw proibido('NAO_E_DESTINATARIO', 'Só quem recebeu a solicitação pode responder.');
  if (await bloqueadoEntre(banco.query, meuId, conexao.requester_id)) {
    throw proibido('BLOQUEADO', 'Não é possível conectar com esta pessoa.');
  }

  const status = acao === 'accept' ? 'ACCEPTED' : 'DECLINED';
  const atualizadas = await banco.query(
    `UPDATE connection_match SET status = $1, responded_at = NOW()
      WHERE id = $2 AND status = 'PENDING' RETURNING id`,
    [status, conexaoId],
  );
  if (!atualizadas.length) throw conflito('JA_RESPONDIDA', 'Esta solicitação não está mais pendente.');
  return { match_id: conexaoId, status };
}

// Lista as conexões em três grupos. O cargo só aparece nas confirmadas.
// Com `marcarVisto: false` a consulta não atualiza o último acesso, e o selo "novo" continua.
export async function listarConexoes({ banco, config }, meuId, { marcarVisto = true } = {}) {
  await expirarPendentes(banco.query, config.regras.diasExpiracao);
  const base = await carregarBase(banco.query);
  const eu = base.perfis.get(meuId);

  const linhas = await banco.query(
    `SELECT c.id, c.requester_id, c.receiver_id, c.status, c.responded_at, c.created_at,
            o.id AS outro_id, o.name, o.department, o.location, o.position
       FROM connection_match c
       JOIN employee o ON o.id = CASE WHEN c.requester_id = $1 THEN c.receiver_id ELSE c.requester_id END
      WHERE (c.requester_id = $1 OR c.receiver_id = $1) AND c.status IN ('PENDING', 'ACCEPTED') AND o.is_active
        AND NOT EXISTS (
          SELECT 1 FROM employee_block b
           WHERE (b.blocker_id = $1 AND b.blocked_id = o.id) OR (b.blocker_id = o.id AND b.blocked_id = $1))
      ORDER BY COALESCE(c.responded_at, c.created_at) DESC`,
    [meuId],
  );
  const [{ last_seen_at: ultimoAcesso }] = await banco.query('SELECT last_seen_at FROM employee WHERE id = $1', [meuId]);

  const resumo = (linha) => {
    const afinidade = afinidadeEntre(base, eu, base.perfis.get(linha.outro_id), config.regras.bonusUnidade);
    return {
      match_id: linha.id,
      employee_id: linha.outro_id,
      name: linha.name,
      department: linha.department,
      city: linha.location,
      affinity_score: arredondar(afinidade.score),
      shared_interests: afinidade.comuns,
    };
  };

  const resultado = { recebidas: [], aguardando: [], confirmadas: [] };
  for (const linha of linhas) {
    if (linha.status === 'ACCEPTED') {
      const aceitaEm = new Date(linha.responded_at ?? linha.created_at);
      resultado.confirmadas.push({
        ...resumo(linha),
        position: linha.position,
        new: !ultimoAcesso || aceitaEm > new Date(ultimoAcesso),
      });
    } else if (linha.receiver_id === meuId) {
      resultado.recebidas.push(resumo(linha));
    } else {
      resultado.aguardando.push(resumo(linha));
    }
  }

  if (marcarVisto) await banco.query('UPDATE employee SET last_seen_at = NOW() WHERE id = $1', [meuId]);
  return resultado;
}

// Quebra-gelo do match: gerado uma vez e guardado para não repetir chamadas de IA.
export async function obterQuebraGelo({ banco, config, ia }, meuId, conexaoId) {
  const conexao = await buscarConexaoDoParticipante(banco.query, conexaoId, meuId);
  const outroId = outraPessoa(conexao, meuId);
  if (conexao.status !== 'ACCEPTED' || (await bloqueadoEntre(banco.query, meuId, outroId))) {
    throw proibido('SEM_MATCH', 'O quebra-gelo só existe depois do match.');
  }
  if (conexao.icebreaker) return { match_summary: conexao.icebreaker };

  const base = await carregarBase(banco.query);
  const eu = base.perfis.get(meuId);
  const outro = base.perfis.get(outroId);
  const nomesDe = (perfil) => [...perfil.tecnicas, ...perfil.hobbies].map((id) => base.nomes.get(id).nome);
  const { comuns } = afinidadeEntre(base, eu, outro, config.regras.bonusUnidade);

  const resposta = await ia.gerarQuebraGelo(meuId, nomesDe(eu), nomesDe(outro), comuns);
  if (resposta.fallback) return { match_summary: resposta.match_summary, fallback: true };

  await banco.query('UPDATE connection_match SET icebreaker = $1 WHERE id = $2 AND icebreaker IS NULL', [
    resposta.match_summary,
    conexaoId,
  ]);
  const [gravado] = await banco.query('SELECT icebreaker FROM connection_match WHERE id = $1', [conexaoId]);
  return { match_summary: gravado.icebreaker };
}
