// Acesso ao banco e ao provedor para o score semântico: gera os vetores das tags, recalcula a tabela de
// similaridade entre pares e a lê para a recomendação. A IA nunca bloqueia: falha do provedor só deixa a tag sem vetor.
import { chaveDoPar, similaridadesEntreTags } from './semantica.js';

const LOTE_DE_INSERCAO = 5000;

// Gera o vetor das tags que ainda não têm (só o nome vai ao provedor). Falha num lote não derruba os demais.
// Devolve { geradas, restantes }.
export async function carregarVetores({ banco, provedor, tamanhoLote = 50 }) {
  const tags = await banco.query('SELECT id, name FROM interest_tag WHERE embedding IS NULL ORDER BY id');
  let geradas = 0;
  for (let i = 0; i < tags.length; i += tamanhoLote) {
    const lote = tags.slice(i, i + tamanhoLote);
    let vetores;
    try {
      vetores = await provedor.gerar(lote.map((t) => t.name));
    } catch {
      continue;
    }
    if (vetores.length !== lote.length) continue;
    await banco.query(
      `UPDATE interest_tag t SET embedding = x.v::jsonb, embedding_model = $3
         FROM unnest($1::int[], $2::text[]) AS x(id, v) WHERE t.id = x.id`,
      [lote.map((t) => t.id), vetores.map((v) => JSON.stringify(v)), provedor.modelo ?? null],
    );
    geradas += lote.length;
  }
  return { geradas, restantes: tags.length - geradas };
}

// Refaz do zero a tabela de pares com similaridade >= limiar. Devolve { pares }.
export async function recalcularSimilaridades({ banco, limiar }) {
  const tags = await banco.query('SELECT id, embedding FROM interest_tag WHERE embedding IS NOT NULL ORDER BY id');
  const pares = [...similaridadesEntreTags(tags, limiar)].map(([chave, similaridade]) => {
    const [a, b] = chave.split(':').map(Number);
    return [a, b, Math.min(1, similaridade)];
  });
  await banco.tx(async (tx) => {
    await tx.query('DELETE FROM tag_similarity');
    for (let i = 0; i < pares.length; i += LOTE_DE_INSERCAO) {
      const lote = pares.slice(i, i + LOTE_DE_INSERCAO);
      await tx.query(
        `INSERT INTO tag_similarity (tag_a, tag_b, similarity)
         SELECT a, b, s FROM unnest($1::int[], $2::int[], $3::real[]) AS x(a, b, s)`,
        [lote.map((p) => p[0]), lote.map((p) => p[1]), lote.map((p) => p[2])],
      );
    }
  });
  return { pares: pares.length };
}

// Lê os pares já calculados como Map<"menor:maior", similaridade>, para a conta da afinidade.
export async function carregarSimilaridades(consulta, limiar) {
  const linhas = await consulta('SELECT tag_a, tag_b, similarity FROM tag_similarity WHERE similarity >= $1', [limiar]);
  return new Map(linhas.map((l) => [chaveDoPar(l.tag_a, l.tag_b), l.similarity]));
}
