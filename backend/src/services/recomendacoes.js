import { naoEncontrado } from '../utils/erros.js';
import { arredondar, calcularAfinidade, calcularIdf } from './afinidade.js';
import { expirarPendentes } from './expiracao.js';
import { exigirPerfilCompleto, usoDaCota } from './perfil.js';

// Carrega os perfis ativos com seus interesses e calcula os pesos de raridade (IDF).
// Busca uma linha por pessoa, com os ids das tags agregados, e o catálogo de tags à parte:
// um JOIN plano repetiria nome e categoria da tag em cada par pessoa e tag.
export async function carregarBase(consulta) {
  const [linhas, catalogo] = await Promise.all([
    consulta(
      `SELECT e.id, e.name, e.department, e.location, e.is_paused,
              COALESCE(array_agg(ei.interest_id ORDER BY ei.interest_id) FILTER (WHERE ei.interest_id IS NOT NULL), '{}') AS tags
         FROM employee e
         LEFT JOIN employee_interest ei ON ei.employee_id = e.id
        WHERE e.is_active
        GROUP BY e.id`,
    ),
    consulta('SELECT id, name, category FROM interest_tag'),
  ]);

  const categorias = new Map(catalogo.map((t) => [t.id, { nome: t.name, categoria: t.category }]));
  const perfis = new Map();
  const nomes = new Map();
  const contagem = new Map();
  for (const linha of linhas) {
    const perfil = {
      id: linha.id,
      nome: linha.name,
      unidade: linha.department,
      cidade: linha.location,
      pausado: linha.is_paused,
      tecnicas: [],
      hobbies: [],
    };
    for (const tagId of linha.tags) {
      const tag = categorias.get(tagId);
      (tag.categoria === 'TECHNICAL' ? perfil.tecnicas : perfil.hobbies).push(tagId);
      nomes.set(tagId, tag);
      contagem.set(tagId, (contagem.get(tagId) ?? 0) + 1);
    }
    perfis.set(linha.id, perfil);
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
