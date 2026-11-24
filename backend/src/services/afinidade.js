import { chaveDoPar } from './semantica.js';

// Cálculo de afinidade: Jaccard ponderado pela raridade da tag (IDF), calculado
// separadamente para o eixo técnico e o pessoal, com média dos dois eixos e um
// pequeno bônus para pessoas de unidades diferentes. Não chama IA a cada cálculo: com a correspondência
// parcial ligada (S4-14), usa só a tabela de similaridade entre tags já calculada.

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

// Jaccard "suave": a tag que não está nos dois conjuntos conta pela similaridade com a tag mais parecida do outro
// lado (pares abaixo do limiar nem entram em `similares`), ponderada pela raridade. Perfis iguais valem 1; sem
// nenhum par parecido o resultado é o do Jaccard exato. `similares`: Map<"menor:maior", similaridade>.
export function jaccardSuave(a, b, idf, similares) {
  const conjuntoA = new Set(a);
  const conjuntoB = new Set(b);
  const melhor = (tag, outro) => {
    if (outro.has(tag)) return 1;
    let maior = 0;
    for (const candidata of outro) maior = Math.max(maior, similares.get(chaveDoPar(tag, candidata)) ?? 0);
    return maior;
  };
  let somaUniao = 0;
  let casado = 0;
  for (const tag of new Set([...conjuntoA, ...conjuntoB])) somaUniao += idf.get(tag) ?? 0;
  for (const tag of conjuntoA) casado += (idf.get(tag) ?? 0) * melhor(tag, conjuntoB);
  for (const tag of conjuntoB) casado += (idf.get(tag) ?? 0) * melhor(tag, conjuntoA);
  return somaUniao > 0 ? Math.min(1, casado / 2 / somaUniao) : 0;
}

// a e b: { tecnicas: number[], hobbies: number[], unidade: string }.
// `semantica` (opcional): { similares, peso }. Cada eixo vira exato + peso * (suave - exato); sem `similares`
// (ou vazio) o resultado é o do Jaccard exato. Devolve { score, tecnico, pessoal } com valores entre 0 e 1.
export function calcularAfinidade(a, b, idf, bonusUnidade = 0.05, semantica = null) {
  const eixo = (x, y) => {
    const exato = jaccardPonderado(x, y, idf);
    if (!semantica?.similares?.size || !semantica.peso) return exato;
    return exato + semantica.peso * (jaccardSuave(x, y, idf, semantica.similares) - exato);
  };
  const tecnico = eixo(a.tecnicas, b.tecnicas);
  const pessoal = eixo(a.hobbies, b.hobbies);
  let score = (tecnico + pessoal) / 2;
  // O bônus só desempata quem já tem afinidade: sem interesse em comum o score continua 0.
  if (score > 0 && a.unidade && b.unidade && a.unidade !== b.unidade) score = Math.min(1, score + bonusUnidade);
  return { score, tecnico, pessoal };
}

export const arredondar = (valor, casas = 2) => Math.round(valor * 10 ** casas) / 10 ** casas;
