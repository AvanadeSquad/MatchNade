import { conflito, invalido, naoEncontrado } from '../utils/erros.js';
import { limparTexto, normalizarTag, unicas } from '../utils/tags.js';
import { inicioDaSemana } from './semana.js';

export const OBJETIVOS = ['NETWORKING', 'TROCA_DE_CONHECIMENTO', 'HOBBY', 'MENTORIA', 'CONHECER_GENTE'];

export async function buscarFuncionario(consulta, id) {
  const [linha] = await consulta(
    `SELECT id, name, email, bio, position, department, location, connection_goals, max_weekly_matches,
            is_active, is_paused, last_seen_at, created_at
       FROM employee WHERE id = $1 AND is_active`,
    [id],
  );
  return linha ?? null;
}

export async function buscarTagsDoFuncionario(consulta, id) {
  const linhas = await consulta(
    `SELECT t.id, t.name, t.category, ei.source
       FROM employee_interest ei JOIN interest_tag t ON t.id = ei.interest_id
      WHERE ei.employee_id = $1 ORDER BY t.name`,
    [id],
  );
  return {
    technical: linhas.filter((t) => t.category === 'TECHNICAL').map(({ id: tagId, name, source }) => ({ id: tagId, name, source })),
    hobby: linhas.filter((t) => t.category === 'HOBBY').map(({ id: tagId, name, source }) => ({ id: tagId, name, source })),
  };
}

export async function usoDaCota(consulta, id, agora = new Date()) {
  const [linha] = await consulta(
    `SELECT COUNT(*)::int AS usadas FROM connection_match WHERE requester_id = $1 AND created_at >= $2::timestamptz`,
    [id, inicioDaSemana(agora).toISOString()],
  );
  return linha.usadas;
}

// Exige que a pessoa tenha ao menos `minTags` interesses antes de interagir com outras.
export function exigirPerfilCompleto(perfil, minTags) {
  if (!perfil || perfil.tecnicas.length + perfil.hobbies.length < minTags) {
    throw conflito('PERFIL_INCOMPLETO', `Escolha ao menos ${minTags} interesses para ver pessoas.`);
  }
}

// O perfil está completo quando tem unidade, ao menos `minTags` interesses e um objetivo.
export function perfilCompleto(funcionario, totalTags, minTags) {
  return Boolean(funcionario.department) && totalTags >= minTags && funcionario.connection_goals.length > 0;
}

export async function montarPerfil({ banco, config }, id) {
  const funcionario = await buscarFuncionario(banco.query, id);
  if (!funcionario) throw naoEncontrado('Perfil não encontrado.');
  const tags = await buscarTagsDoFuncionario(banco.query, id);
  const usadas = await usoDaCota(banco.query, id);
  const [{ total }] = await banco.query(
    `SELECT COUNT(*)::int AS total FROM connection_match WHERE status = 'ACCEPTED' AND (requester_id = $1 OR receiver_id = $1)`,
    [id],
  );
  return {
    id: funcionario.id,
    name: funcionario.name,
    email: funcionario.email,
    bio: funcionario.bio,
    position: funcionario.position,
    department: funcionario.department,
    location: funcionario.location,
    connection_goals: funcionario.connection_goals,
    max_weekly_matches: funcionario.max_weekly_matches,
    is_paused: funcionario.is_paused,
    tags,
    profile_complete: perfilCompleto(funcionario, tags.technical.length + tags.hobby.length, config.regras.minTags),
    quota: { used: usadas, max: funcionario.max_weekly_matches },
    connections_count: total,
  };
}

// Atualiza só os campos enviados. Texto vazio em campo opcional limpa o valor.
export async function atualizarPerfil(banco, id, dados) {
  const campos = [];
  const valores = [];
  const definir = (coluna, valor, cast = '') => {
    valores.push(valor);
    campos.push(`${coluna} = $${valores.length}${cast}`);
  };

  if (dados.name !== undefined) definir('name', limparTexto(dados.name));
  if (dados.bio !== undefined) definir('bio', limparTexto(dados.bio) || null);
  if (dados.position !== undefined) definir('position', limparTexto(dados.position) || null);
  if (dados.department !== undefined) definir('department', limparTexto(dados.department) || null);
  if (dados.location !== undefined) definir('location', limparTexto(dados.location) || null);
  if (dados.connection_goals !== undefined) definir('connection_goals', JSON.stringify(unicas(dados.connection_goals)), '::jsonb');
  if (dados.max_weekly_matches !== undefined) definir('max_weekly_matches', dados.max_weekly_matches);

  if (campos.length) {
    valores.push(id);
    await banco.query(`UPDATE employee SET ${campos.join(', ')} WHERE id = $${valores.length}`, valores);
  }
}

// Cria a tag se não existir (comparando sem diferenciar maiúsculas) e devolve a tag.
export async function garantirTag(consulta, nome, categoria) {
  const normalizado = normalizarTag(nome);
  if (!normalizado) throw invalido('TAG_INVALIDA', 'Essa tag não é válida. Use de 2 a 40 caracteres e evite cargos ou termos genéricos.');
  const [existente] = await consulta('SELECT id, name, category FROM interest_tag WHERE LOWER(name) = LOWER($1)', [normalizado]);
  if (existente) return existente;
  const [criada] = await consulta('INSERT INTO interest_tag (name, category) VALUES ($1, $2) RETURNING id, name, category', [
    normalizado,
    categoria,
  ]);
  return criada;
}

// Substitui os interesses da pessoa. itens: [{ name, category, source?, confidence? }].
export async function salvarInteresses({ banco, config }, id, itens) {
  const vistos = new Set();
  const unicos = itens.filter((item) => {
    const chave = limparTexto(item.name).toLowerCase();
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
  if (unicos.length < config.regras.minTags) {
    throw invalido('MENOS_DE_3_TAGS', `Escolha ao menos ${config.regras.minTags} interesses.`);
  }

  await banco.tx(async ({ query }) => {
    await query('DELETE FROM employee_interest WHERE employee_id = $1', [id]);
    for (const item of unicos) {
      const tag = await garantirTag(query, item.name, item.category);
      await query(
        `INSERT INTO employee_interest (employee_id, interest_id, source, confidence_score)
         VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
        [id, tag.id, item.source ?? 'MANUAL', item.confidence ?? null],
      );
    }
  });
}

export async function definirPausa(banco, id, pausado) {
  await banco.query('UPDATE employee SET is_paused = $1 WHERE id = $2', [pausado, id]);
}

// Exclusão definitiva dos dados da pessoa (as demais tabelas caem em cascata).
export async function excluirPerfil(banco, id) {
  await banco.query('DELETE FROM employee WHERE id = $1', [id]);
}

export async function listarTags(banco, categoria) {
  const filtro = categoria ? 'WHERE category = $1' : '';
  return banco.query(
    `SELECT t.id, t.name, t.category,
            (SELECT COUNT(*)::int FROM employee_interest ei JOIN employee e ON e.id = ei.employee_id
              WHERE ei.interest_id = t.id AND e.is_active) AS uso
       FROM interest_tag t ${filtro} ORDER BY uso DESC, t.name`,
    categoria ? [categoria] : [],
  );
}

export async function obterOuCriarPorGoogle(banco, { sub, email, nome }) {
  const [existente] = await banco.query('SELECT id, is_active FROM employee WHERE auth_provider_id = $1 OR email = $2', [sub, email]);
  if (existente) {
    if (!existente.is_active) throw conflito('CONTA_INATIVA', 'Esta conta está inativa.');
    await banco.query('UPDATE employee SET auth_provider_id = $1 WHERE id = $2', [sub, existente.id]);
    return { id: existente.id, novo: false };
  }
  const nomeFinal = limparTexto(nome) || email.split('@')[0];
  const [criado] = await banco.query(
    `INSERT INTO employee (auth_provider_id, name, email) VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING RETURNING id`,
    [sub, nomeFinal, email],
  );
  if (criado) return { id: criado.id, novo: true };
  // Outro acesso simultâneo criou a pessoa primeiro.
  const [existe] = await banco.query('SELECT id FROM employee WHERE auth_provider_id = $1 OR LOWER(email) = LOWER($2)', [sub, email]);
  return { id: existe.id, novo: false };
}
