import { naoEncontrado } from '../utils/erros.js';
import { arredondar } from './afinidade.js';
import { bloqueadoEntre } from './bloqueios.js';
import { expirarPendentes } from './expiracao.js';
import { buscarFuncionario, buscarTagsDoFuncionario, exigirPerfilCompleto } from './perfil.js';
import { afinidadeEntre, carregarBase } from './recomendacoes.js';

// Perfil de outra pessoa. Cargo e bio só são devolvidos depois do match.
export async function perfilDaPessoa({ banco, config }, meuId, outroId) {
  const outro = await buscarFuncionario(banco.query, outroId);
  if (!outro || outroId === meuId || (await bloqueadoEntre(banco.query, meuId, outroId))) {
    throw naoEncontrado('Pessoa não encontrada.');
  }
  const base = await carregarBase(banco.query);
  exigirPerfilCompleto(base.perfis.get(meuId), config.regras.minTags);

  // Expira antes de ler a conexão, para uma pendente vencida não aparecer como PENDING.
  await expirarPendentes(banco.query, config.regras.diasExpiracao);
  const [conexao] = await banco.query(
    `SELECT id, requester_id, status FROM connection_match
      WHERE ((requester_id = $1 AND receiver_id = $2) OR (requester_id = $2 AND receiver_id = $1))
        AND status IN ('PENDING', 'ACCEPTED')`,
    [meuId, outroId],
  );
  const confirmada = conexao?.status === 'ACCEPTED';
  if (outro.is_paused && !conexao) throw naoEncontrado('Pessoa não encontrada.');

  const afinidade = afinidadeEntre(base, base.perfis.get(meuId), base.perfis.get(outroId), config.regras.bonusUnidade);

  return {
    id: outro.id,
    name: outro.name,
    department: outro.department,
    city: outro.location,
    connection_goals: outro.connection_goals,
    tags: await buscarTagsDoFuncionario(banco.query, outroId),
    affinity: {
      score: arredondar(afinidade.score),
      technical: arredondar(afinidade.tecnico),
      personal: arredondar(afinidade.pessoal),
    },
    shared_interests: afinidade.comuns,
    connection: conexao
      ? { match_id: conexao.id, status: conexao.status, direction: conexao.requester_id === meuId ? 'SENT' : 'RECEIVED' }
      : null,
    ...(confirmada ? { position: outro.position, bio: outro.bio } : {}),
  };
}
