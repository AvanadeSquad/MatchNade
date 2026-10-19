// Preferências que a API ainda não guarda (telefone, hub, CEP, equilíbrio do algoritmo, alcance geográfico,
// polos habilitados e notificações). Ficam no navegador, separadas por conta. O que a API guarda
// (nome, unidade, cidade, bio, interesses, objetivos, cota semanal e pausa) vai sempre para a API.

export const HUBS = [
  'Avanade São Paulo (Chácara Santo Antônio)',
  'Avanade São Paulo (Morumbi)',
  'Avanade Recife (Porto Digital)',
  'Avanade Rio de Janeiro',
  'Avanade Belo Horizonte',
  'Avanade Curitiba',
  'Avanade Porto Alegre',
  'Avanade Brasília',
  'Remoto / Home office',
];

// Cidade de cada hub: sugere a cidade no cadastro e prioriza colegas dos polos habilitados na descoberta.
export const CIDADE_DO_HUB = {
  'Avanade São Paulo (Chácara Santo Antônio)': 'São Paulo',
  'Avanade São Paulo (Morumbi)': 'São Paulo',
  'Avanade Recife (Porto Digital)': 'Recife',
  'Avanade Rio de Janeiro': 'Rio de Janeiro',
  'Avanade Belo Horizonte': 'Belo Horizonte',
  'Avanade Curitiba': 'Curitiba',
  'Avanade Porto Alegre': 'Porto Alegre',
  'Avanade Brasília': 'Brasília',
};

// Compara cidades ignorando maiúsculas, acentos e o estado ("São Paulo, SP" = "sao paulo").
export const mesmaCidade = (a, b) => {
  const normalizar = (c) => (c ?? '').split(',')[0].normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
  return Boolean(a && b) && normalizar(a) === normalizar(b);
};

// Unidades usadas no cadastro (sugestões; a pessoa pode digitar outra).
export const AREAS = [
  'Experience Design',
  'Tecnologia e Inovação',
  'Data & AI',
  'Cloud',
  'Engenharia',
  'Consultoria',
  'Segurança',
  'Operações',
];

export const ALCANCES = [
  { id: 'LOCAL', rotulo: 'Local', descricao: 'Mesma cidade' },
  { id: 'REGIONAL', rotulo: 'Regional (Brasil)', descricao: 'Todo o Brasil' },
  { id: 'CONTINENTAL', rotulo: 'Continental (LATAM)', descricao: 'América Latina' },
];

export const PADRAO = {
  telefone: '',
  emailPessoal: '',
  hub: '',
  cep: '',
  pesoProfissional: 70,
  alcance: 'REGIONAL',
  polos: [],
  notificacoes: true,
  configurado: false,
};

const chave = (usuarioId) => `preferencias:${usuarioId}`;

export function lerPreferencias(usuarioId) {
  try {
    const salvo = JSON.parse(localStorage.getItem(chave(usuarioId)) ?? '{}');
    return { ...PADRAO, ...(salvo && typeof salvo === 'object' ? salvo : {}) };
  } catch {
    return { ...PADRAO };
  }
}

export function salvarPreferencias(usuarioId, parcial) {
  const novas = { ...lerPreferencias(usuarioId), ...parcial };
  try {
    localStorage.setItem(chave(usuarioId), JSON.stringify(novas));
  } catch {
    // Sem armazenamento, as preferências valem só até recarregar a página.
  }
  return novas;
}

export function limparPreferencias(usuarioId) {
  try {
    localStorage.removeItem(chave(usuarioId));
  } catch {
    // Nada a limpar.
  }
}
