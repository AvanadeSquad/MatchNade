import { IconeEstrela, IconeLampada, IconeMentoria, IconePessoas, IconeUsuarioMais } from '../components/Icones.jsx';

// Objetivos de conexão aceitos pela API, com texto e ícone da tela de objetivos.
export const OBJETIVOS = [
  { id: 'NETWORKING', titulo: 'Networking', descricao: 'Conhecer pessoas de outras áreas e ampliar sua rede.', Icone: IconePessoas },
  {
    id: 'TROCA_DE_CONHECIMENTO',
    titulo: 'Troca de conhecimento',
    descricao: 'Aprender e ensinar sobre temas do seu dia a dia.',
    Icone: IconeLampada,
  },
  { id: 'HOBBY', titulo: 'Hobby', descricao: 'Encontrar quem curte as mesmas coisas fora do trabalho.', Icone: IconeEstrela },
  { id: 'MENTORIA', titulo: 'Mentoria', descricao: 'Dar ou receber orientação de carreira.', Icone: IconeMentoria },
  { id: 'CONHECER_GENTE', titulo: 'Só conhecer gente', descricao: 'Bater um papo sem compromisso.', Icone: IconeUsuarioMais },
];

export const nomeDoObjetivo = (id) => OBJETIVOS.find((o) => o.id === id)?.titulo ?? id;
