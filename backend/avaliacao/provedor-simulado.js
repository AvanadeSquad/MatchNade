// Provedor de IA simulado para a avaliação: não chama rede e responde de forma determinística.
// Imita um modelo ingênuo que procura termos conhecidos na bio, inclusive cargos e texto injetado,
// para medir se o restante do fluxo (normalização e filtros) segura o que um modelo real poderia devolver.

const TECNICAS = [
  'React',
  'TypeScript',
  'Python',
  'SQL',
  'Power BI',
  'Azure DevOps',
  'Azure',
  'Terraform',
  'Kubernetes',
  'Java',
  'Spring Boot',
  'Docker',
  'C#',
  '.NET',
  'Figma',
  'Pentest',
  'Machine Learning',
  'PyTorch',
  'Flutter',
  'Kotlin',
  'Playwright',
  'Cypress',
  'SAP',
  'Power Apps',
  'Power Automate',
  'Scrum',
  'Jira',
  'Go',
  'AWS',
  'Node.js',
  'MongoDB',
  'Angular',
];

// Sinônimos que o modelo ingênuo converte para a forma esperada.
const SINONIMOS_TECNICOS = {
  'segurança da informação': 'Segurança da Informação',
  'pesquisa com usuários': 'UX Research',
  'testes de invasão': 'Pentest',
};

const HOBBIES = {
  corro: 'Corrida',
  corrida: 'Corrida',
  xadrez: 'Xadrez',
  trilha: 'Trilha',
  fotografia: 'Fotografia',
  violão: 'Violão',
  cozinho: 'Culinária',
  cozinhar: 'Culinária',
  ciclismo: 'Ciclismo',
  leio: 'Leitura',
  videogame: 'Videogame',
  aquarela: 'Aquarela',
  ioga: 'Ioga',
  mergulho: 'Mergulho',
  'jogos de tabuleiro': 'Jogos de tabuleiro',
  futebol: 'Futebol',
  bateria: 'Bateria',
  crochê: 'Crochê',
  plantas: 'Jardinagem',
  natação: 'Natação',
  escalada: 'Escalada',
  podcasts: 'Podcasts',
  dança: 'Dança',
  surfe: 'Surfe',
};

// Termos de cargo que um modelo ingênuo devolveria; o fluxo precisa descartá-los.
const CARGOS = ['Gerente', 'Coordenadora', 'Sênior', 'Tech Lead', 'Principal Engineer', 'Staff', 'Analista', 'CEO', 'Diretor'];

// Tag que só existe no texto injetado; um modelo que obedecesse à injeção a devolveria.
const INJETADAS = ['Hackeado'];

const contem = (texto, termo) =>
  new RegExp(`(^|[^\\p{L}\\p{N}])${termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}\\p{N}])`, 'iu').test(texto);

export function extrairSimulado(usuario) {
  const bio = usuario.replace(/^<bio>|<\/bio>$/g, '');
  const technical = TECNICAS.filter((t) => contem(bio, t));
  for (const [chave, valor] of Object.entries(SINONIMOS_TECNICOS)) if (contem(bio, chave)) technical.push(valor);
  // Azure dentro de "Azure DevOps" não conta como tag separada.
  const tecnicas = technical.filter((t) => !(t === 'Azure' && contem(bio, 'Azure DevOps') && !/Azure(?! DevOps)/.test(bio)));
  const hobby = [
    ...new Set(
      Object.entries(HOBBIES)
        .filter(([chave]) => contem(bio, chave))
        .map(([, valor]) => valor),
    ),
  ];
  const cargos = CARGOS.filter((c) => contem(bio, c));
  const injetadas = INJETADAS.filter((c) => contem(bio, c));
  return { technical_tags: [...tecnicas, ...cargos, ...injetadas], hobby_tags: hobby };
}

export const provedorSimulado = {
  nome: 'simulado',
  modelo: 'simulado-v1',
  async gerar({ usuario }) {
    return JSON.stringify(extrairSimulado(usuario));
  },
};
