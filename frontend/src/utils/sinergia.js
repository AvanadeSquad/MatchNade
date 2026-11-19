// Filtro de sinergia mínima da Descoberta. O valor comparado é a sinergia exibida no cartão (já reponderada
// pelo equilíbrio da pessoa), arredondada para percentual inteiro, para o filtro bater com o número na tela.
export const SINERGIA_MINIMA_OPCOES = [
  { id: 0, rotulo: 'Qualquer' },
  { id: 20, rotulo: '20%+' },
  { id: 40, rotulo: '40%+' },
  { id: 60, rotulo: '60%+' },
  { id: 80, rotulo: '80%+' },
];

// `lista`: itens com `sinergia` entre 0 e 1. `minimo`: percentual de 0 a 100 (0 não filtra nada).
export function filtrarPorSinergiaMinima(lista, minimo) {
  if (!minimo || minimo <= 0) return lista;
  return lista.filter((item) => Math.round(item.sinergia * 100) >= minimo);
}
