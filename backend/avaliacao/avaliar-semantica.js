import { cosseno } from '../src/services/semantica.js';

// Mede o score semântico contra o gabarito de pares (pares-tags.json): para um limiar, um par é "relacionado"
// quando o cosseno dos vetores chega a ele. `vetores`: Map<nome da tag, vetor>. Par sem vetor fica fora da conta.
export function avaliarPares(pares, vetores, limiar) {
  const r = { total: 0, verdadeirosPositivos: 0, falsosPositivos: 0, falsosNegativos: 0, verdadeirosNegativos: 0, semVetor: [] };
  for (const { a, b, relacionada } of pares) {
    if (!vetores.has(a) || !vetores.has(b)) {
      r.semVetor.push([a, b]);
      continue;
    }
    const prevista = cosseno(vetores.get(a), vetores.get(b)) >= limiar;
    r.total += 1;
    if (prevista && relacionada) r.verdadeirosPositivos += 1;
    else if (prevista) r.falsosPositivos += 1;
    else if (relacionada) r.falsosNegativos += 1;
    else r.verdadeirosNegativos += 1;
  }
  const previstos = r.verdadeirosPositivos + r.falsosPositivos;
  const reais = r.verdadeirosPositivos + r.falsosNegativos;
  return {
    ...r,
    precisao: previstos ? r.verdadeirosPositivos / previstos : null,
    cobertura: reais ? r.verdadeirosPositivos / reais : null,
    acerto: r.total ? (r.verdadeirosPositivos + r.verdadeirosNegativos) / r.total : null,
  };
}

// Uma linha por limiar, em ordem crescente, para escolher o limiar do SEMANTIC_THRESHOLD.
export function varreduraDeLimiar(pares, vetores, limiares) {
  return [...limiares].sort((x, y) => x - y).map((limiar) => ({ limiar, ...avaliarPares(pares, vetores, limiar) }));
}
