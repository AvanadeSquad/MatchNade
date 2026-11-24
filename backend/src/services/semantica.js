// Similaridade semântica entre tags: cada tag tem um vetor (embedding) gerado uma vez a partir do nome,
// e a similaridade entre duas tags (cosseno) vira correspondência parcial na afinidade. Funções puras:
// o acesso ao banco e ao provedor ficam em `semantica-carga.js`. Só nomes de tag chegam ao provedor.

// Chave do par sem ordem: menor id primeiro.
export const chaveDoPar = (a, b) => (a < b ? `${a}:${b}` : `${b}:${a}`);

// Cosseno entre dois vetores. Vetor ausente, zerado ou de tamanho diferente vale 0 (nunca NaN).
export function cosseno(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || a.length !== b.length) return 0;
  let produto = 0;
  let normaA = 0;
  let normaB = 0;
  for (let i = 0; i < a.length; i += 1) {
    produto += a[i] * b[i];
    normaA += a[i] * a[i];
    normaB += b[i] * b[i];
  }
  return normaA > 0 && normaB > 0 ? produto / Math.sqrt(normaA * normaB) : 0;
}

// tags: [{ id, embedding }]. Devolve Map<chave do par, similaridade> só com os pares de similaridade >= limiar.
export function similaridadesEntreTags(tags, limiar) {
  const comVetor = tags.filter((t) => Array.isArray(t.embedding) && t.embedding.length > 0);
  const pares = new Map();
  for (let i = 0; i < comVetor.length; i += 1) {
    for (let j = i + 1; j < comVetor.length; j += 1) {
      const similaridade = cosseno(comVetor[i].embedding, comVetor[j].embedding);
      if (similaridade >= limiar) pares.set(chaveDoPar(comVetor[i].id, comVetor[j].id), similaridade);
    }
  }
  return pares;
}

// Para explicar a afinidade: as tags de `a` que não estão em `b`, cada uma com a tag mais parecida de `b`
// (também fora de `a`). Ordenado do mais parecido para o menos. As tags em comum já aparecem em shared_interests.
export function paresRelacionados(a, b, similares, nomes, maximo = 3) {
  const idsA = new Set(a);
  const idsB = new Set(b);
  const soDeA = [...idsA].filter((id) => !idsB.has(id));
  const soDeB = [...idsB].filter((id) => !idsA.has(id));
  const pares = [];
  for (const minha of soDeA) {
    let melhor = null;
    for (const dela of soDeB) {
      const similaridade = similares.get(chaveDoPar(minha, dela));
      if (similaridade !== undefined && (!melhor || similaridade > melhor.similaridade)) melhor = { dela, similaridade };
    }
    if (melhor) pares.push({ minha: nomes.get(minha).nome, dela: nomes.get(melhor.dela).nome, similaridade: melhor.similaridade });
  }
  return pares.sort((x, y) => y.similaridade - x.similaridade || x.minha.localeCompare(y.minha)).slice(0, maximo);
}
