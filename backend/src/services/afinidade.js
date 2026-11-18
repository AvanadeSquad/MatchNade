// Cálculo de afinidade: Jaccard ponderado pela raridade da tag (IDF), calculado
// separadamente para o eixo técnico e o pessoal, com média dos dois eixos e um
// pequeno bônus para pessoas de unidades diferentes. Não usa IA.

// idf[tag] = ln(1 + N / df). N = perfis ativos; df = perfis que têm a tag.
// O 1 somado mantém o peso positivo mesmo quando todos têm a tag (df = N pesa ln 2): sem ele, duas pessoas
// com perfis idênticos numa base pequena apareceriam com afinidade 0. Tag rara continua pesando mais que tag comum.
export function calcularIdf(totalPerfis, contagemPorTag) {
  const idf = new Map();
  for (const [tagId, df] of contagemPorTag) {
    idf.set(tagId, df > 0 && totalPerfis > 0 ? Math.log(1 + totalPerfis / df) : 0);
  }
  return idf;
}

// Jaccard ponderado entre dois conjuntos de ids de tag. Eixo vazio vale 0.
export function jaccardPonderado(a, b, idf) {
  const conjuntoB = new Set(b);
  const uniao = new Set([...a, ...b]);
  let intersecao = 0;
  let somaUniao = 0;
  for (const tag of uniao) {
    const peso = idf.get(tag) ?? 0;
    somaUniao += peso;
    if (a.includes(tag) && conjuntoB.has(tag)) intersecao += peso;
  }
  return somaUniao > 0 ? intersecao / somaUniao : 0;
}

// a e b: { tecnicas: number[], hobbies: number[], unidade: string }.
// Devolve { score, tecnico, pessoal } com valores entre 0 e 1.
export function calcularAfinidade(a, b, idf, bonusUnidade = 0.05) {
  const tecnico = jaccardPonderado(a.tecnicas, b.tecnicas, idf);
  const pessoal = jaccardPonderado(a.hobbies, b.hobbies, idf);
  let score = (tecnico + pessoal) / 2;
  // O bônus só desempata quem já tem afinidade: sem interesse em comum o score continua 0.
  if (score > 0 && a.unidade && b.unidade && a.unidade !== b.unidade) score = Math.min(1, score + bonusUnidade);
  return { score, tecnico, pessoal };
}

export const arredondar = (valor, casas = 2) => Math.round(valor * 10 ** casas) / 10 ** casas;
