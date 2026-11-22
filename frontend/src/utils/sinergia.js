import { CIDADE_DO_HUB, mesmaCidade } from './preferencias.js';

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

const BONUS_POLO = 0.05;

// Sinergia exibida para uma pessoa: os eixos técnico e pessoal reponderados pelo equilíbrio escolhido
// (profissional x pessoal). Com 50/50 coincide com a média dos dois eixos que a API usa. Colega de cidade
// de um polo habilitado ganha um pequeno bônus, só se já houver alguma sinergia. Sem os eixos, vale o score da API.
// É a única conta do percentual: a Descoberta e o perfil da pessoa mostram o mesmo número.
export function sinergiaExibida({ tecnica, pessoal, cidade, scoreDaApi }, { pesoProfissional, polos }) {
  const peso = pesoProfissional / 100;
  const temEixos = typeof tecnica === 'number' && typeof pessoal === 'number';
  let valor = temEixos ? peso * tecnica + (1 - peso) * pessoal : scoreDaApi;
  const cidadesDosPolos = polos.map((p) => CIDADE_DO_HUB[p]).filter(Boolean);
  if (valor > 0 && cidadesDosPolos.some((c) => mesmaCidade(c, cidade))) valor += BONUS_POLO;
  return Math.min(1, valor);
}

// Mesma conta para uma conexão da lista de matches e das conversas: usa os eixos que a API devolve e, sem eles,
// o score da API. Assim a pessoa vê o mesmo percentual na Descoberta, no perfil, em Matches e no chat.
export function sinergiaDaConexao(conexao, preferencias) {
  return sinergiaExibida(
    { tecnica: conexao.affinity_technical, pessoal: conexao.affinity_personal, cidade: conexao.city, scoreDaApi: conexao.affinity_score },
    preferencias,
  );
}
