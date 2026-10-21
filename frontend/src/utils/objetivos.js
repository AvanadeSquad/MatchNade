import { IconeCha, IconeEstrela, IconeLampada, IconeMentoria, IconePessoas } from '../components/Icones.jsx';

// Objetivos de conexão aceitos pela API, com texto e ícone.
export const OBJETIVOS = [
  {
    id: 'CONHECER_GENTE',
    titulo: 'Coffee Chat Virtual (15 min)',
    curto: 'Coffee Chat',
    descricao: 'Aceitar convites rápidos e informais para conhecer colegas de outras equipes.',
    Icone: IconeCha,
  },
  {
    id: 'MENTORIA',
    titulo: 'Mentoria de carreira',
    curto: 'Mentoria',
    descricao: 'Dar ou receber orientação de carreira, inclusive para quem está em transição de área.',
    Icone: IconeMentoria,
  },
  {
    id: 'TROCA_DE_CONHECIMENTO',
    titulo: 'Troca técnica',
    curto: 'Troca Técnica',
    descricao: 'Aprender e ensinar sobre temas do dia a dia e colaborar em projetos cross-regionais.',
    Icone: IconeLampada,
  },
  {
    id: 'NETWORKING',
    titulo: 'Networking',
    curto: 'Networking',
    descricao: 'Ampliar a rede com pessoas de outras unidades, squads e comunidades.',
    Icone: IconePessoas,
  },
  {
    id: 'HOBBY',
    titulo: 'Hobbies em comum',
    curto: 'Hobbies',
    descricao: 'Encontrar quem curte as mesmas coisas fora do trabalho.',
    Icone: IconeEstrela,
  },
];

export const nomeDoObjetivo = (id) => OBJETIVOS.find((o) => o.id === id)?.curto ?? id;

// Propósitos da etapa de interesses do cadastro. Cada um vira um conjunto de objetivos na API.
export const PROPOSITOS = [
  {
    id: 'COLEGAS',
    titulo: 'Conectar com colegas',
    descricao: 'Interesses mútuos, vivências culturais, trocas de rotina e cafés informais entre equipes globais.',
    objetivos: ['CONHECER_GENTE', 'HOBBY', 'NETWORKING'],
    recomendado: true,
  },
  {
    id: 'OPORTUNIDADES',
    titulo: 'Encontrar oportunidades',
    descricao: 'Mentoria, colaboração em novas squads, projetos cross-regionais e intercâmbio de competências.',
    objetivos: ['MENTORIA', 'TROCA_DE_CONHECIMENTO', 'NETWORKING'],
  },
];

// Propósito que melhor descreve os objetivos já salvos.
export function propositoDosObjetivos(objetivos = []) {
  if (objetivos.includes('MENTORIA') || objetivos.includes('TROCA_DE_CONHECIMENTO')) {
    if (!objetivos.includes('CONHECER_GENTE') && !objetivos.includes('HOBBY')) return 'OPORTUNIDADES';
  }
  return 'COLEGAS';
}

// Filtros de objetivo da descoberta, cada um casando com um ou mais objetivos da pessoa sugerida.
export const FILTROS_DE_OBJETIVO = [
  { id: 'CAFE', rotulo: 'Coffee Chat', objetivos: ['CONHECER_GENTE', 'HOBBY', 'NETWORKING'], Icone: IconeCha },
  { id: 'MENTORIA', rotulo: 'Mentoria', objetivos: ['MENTORIA'], Icone: IconeMentoria },
  { id: 'TECNICA', rotulo: 'Troca Técnica', objetivos: ['TROCA_DE_CONHECIMENTO'], Icone: IconeLampada },
];
