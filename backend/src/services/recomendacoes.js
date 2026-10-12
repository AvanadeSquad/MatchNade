import { naoEncontrado } from '../utils/erros.js';
import { arredondar, calcularAfinidade, calcularIdf } from './afinidade.js';
import { expirarPendentes } from './expiracao.js';
import { exigirPerfilCompleto, usoDaCota } from './perfil.js';

// Carrega os perfis ativos com seus interesses e calcula os pesos de raridade (IDF).
export async function carregarBase(consulta) {
  const linhas = await consulta(
    `SELECT e.id, e.name, e.department, e.location, e.is_paused,
            t.id AS tag_id, t.name AS tag_name, t.category
       FROM employee e
       LEFT JOIN employee_interest ei ON ei.employee_id = e.id
       LEFT JOIN interest_tag t ON t.id = ei.interest_id
      WHERE e.is_active`,
  );

  const perfis = new Map();
  const nomes = new Map();
  const contagem = new Map();
  for (const linha of linhas) {
    if (!perfis.has(linha.id)) {
      perfis.set(linha.id, {
        id: linha.id,
        nome: linha.name,
        unidade: linha.department,
        cidade: linha.location,
        pausado: linha.is_paused,
        tecnicas: [],
        hobbies: [],
      });
    }
    if (linha.tag_id) {
      const perfil = perfis.get(linha.id);
      (linha.category === 'TECHNICAL' ? perfil.tecnicas : perfil.hobbies).push(linha.tag_id);
      nomes.set(linha.tag_id, { nome: linha.tag_name, categoria: linha.category });
      contagem.set(linha.tag_id, (contagem.get(linha.tag_id) ?? 0) + 1);
    }
  }
  return { perfis, nomes, idf: calcularIdf(perfis.size, contagem) };
}

// Afinidade entre duas pessoas já carregadas, com os interesses em comum (técnicos primeiro).
export function afinidadeEntre(base, a, b, bonusUnidade) {
  const resultado = calcularAfinidade(a, b, base.idf, bonusUnidade);
  const idsB = new Set([...b.tecnicas, ...b.hobbies]);
  const comuns = [...a.tecnicas, ...a.hobbies]
    .filter((id) => idsB.has(id))
    .map((id) => base.nomes.get(id))
    .sort((x, y) => (x.categoria === y.categoria ? x.nome.localeCompare(y.nome) : x.categoria === 'TECHNICAL' ? -1 : 1))
    .map((tag) => tag.nome);
  return { ...resultado, comuns };
}

export async function recomendar({ banco, config }, meuId, limiteSolicitado) {
  const limite = Math.min(Math.max(limiteSolicitado || config.regras.limitePadrao, 1), config.regras.limiteMaximo);
  await expirarPendentes(banco.query, config.regras.diasExpiracao);

  const base = await carregarBase(banco.query);
  const eu = base.perfis.get(meuId);
  if (!eu) throw naoEncontrado('Perfil não encontrado.');
  exigirPerfilCompleto(eu, config.regras.minTags);

  const [{ limite: maximo }] = await banco.query('SELECT max_weekly_matches AS limite FROM employee WHERE id = $1', [meuId]);
  const usadas = await usoDaCota(banco.query, meuId);
  if (usadas >= maximo) {
    return { recommendations: [], message: `Você já usou suas ${maximo} solicitações desta semana.` };
  }

  const excluidos = new Set([meuId]);
  const bloqueios = await banco.query('SELECT blocker_id, blocked_id FROM employee_block WHERE blocker_id = $1 OR blocked_id = $1', [
    meuId,
  ]);
  for (const b of bloqueios) excluidos.add(b.blocker_id === meuId ? b.blocked_id : b.blocker_id);
  const conexoes = await banco.query(
    `SELECT requester_id, receiver_id FROM connection_match
      WHERE (requester_id = $1 OR receiver_id = $1) AND status <> 'EXPIRED'`,
    [meuId],
  );
  for (const c of conexoes) excluidos.add(c.requester_id === meuId ? c.receiver_id : c.requester_id);

  const candidatos = [...base.perfis.values()]
    .filter((p) => !excluidos.has(p.id) && !p.pausado && p.tecnicas.length + p.hobbies.length >= config.regras.minTags)
    .map((p) => ({ perfil: p, ...afinidadeEntre(base, eu, p, config.regras.bonusUnidade) }))
    .sort((x, y) => y.score - x.score || x.perfil.nome.localeCompare(y.perfil.nome))
    .slice(0, limite);

  const recommendations = candidatos.map(({ perfil, score, comuns }) => ({
    employee_id: perfil.id,
    name: perfil.nome,
    department: perfil.unidade,
    city: perfil.cidade,
    affinity_score: arredondar(score),
    shared_interests: comuns,
  }));

  return recommendations.length
    ? { recommendations }
    : { recommendations, message: 'Você já viu todas as pessoas por enquanto. Volte mais tarde.' };
}
