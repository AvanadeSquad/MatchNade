// Dados fictícios para desenvolvimento, demonstração e testes. Todas as pessoas, e-mails
// e interesses são inventados; nenhum dado real entra no banco por aqui.

export const TAGS_TECNICAS = [
  'React', 'Node.js', 'Azure', 'Python', 'Power BI', 'Figma', 'UX Research', 'Design Systems', 'Terraform',
  'TypeScript', 'Java', '.NET', 'SQL', 'Kubernetes', 'DevOps', 'Machine Learning', 'Engenharia de dados',
  'Cibersegurança', 'Gestão de produto', 'Agile', 'Arquitetura de nuvem', 'GraphQL', 'Power Platform',
  'Acessibilidade', 'Mobile', 'Angular', 'Testes automatizados', 'Visualização de dados', 'SAP', 'Salesforce',
];

export const TAGS_HOBBY = [
  'Xadrez', 'Corrida', 'Fotografia', 'Leitura de ficção', 'Viagens', 'Jogos de tabuleiro', 'Culinária',
  'Café especial', 'Ficção científica', 'Futebol', 'Música', 'Violão', 'Cinema', 'Ciclismo', 'Yoga', 'Trilhas',
  'Games', 'Séries', 'Teatro', 'Pintura', 'Jardinagem', 'Podcasts', 'Surf', 'Vôlei', 'Natação', 'Escalada',
  'Vinho', 'Cervejas artesanais', 'Dança', 'Voluntariado',
];

const UNIDADES = ['Experience Design', 'Tecnologia e Inovação', 'Data & AI', 'Cloud', 'Engenharia', 'Consultoria', 'Segurança', 'Operações'];
const CIDADES = ['São Paulo', 'Recife', 'Rio de Janeiro', 'Belo Horizonte', 'Porto Alegre', 'Curitiba', 'Salvador', 'Brasília'];
const CARGOS = ['Analista de UX', 'Desenvolvedora Pleno', 'Engenheiro de Dados Sênior', 'Consultora', 'Arquiteto de Soluções', 'Gerente de Projetos', 'Analista de Qualidade'];
const OBJETIVOS = ['NETWORKING', 'TROCA_DE_CONHECIMENTO', 'HOBBY', 'MENTORIA', 'CONHECER_GENTE'];

// Pessoas com interesses definidos à mão; as demais são geradas de forma determinística.
const PESSOAS_FIXAS = [
  {
    nome: 'Ana Silva', unidade: 'Experience Design', cidade: 'São Paulo', cargo: 'Analista de UX',
    bio: 'Desenho interfaces e gosto de pesquisar como as pessoas usam produtos. Fora do trabalho fotografo, leio ficção e viajo sempre que dá.',
    tecnicas: ['Figma', 'React', 'UX Research'], hobbies: ['Fotografia', 'Leitura de ficção', 'Viagens'],
    objetivos: ['NETWORKING', 'TROCA_DE_CONHECIMENTO'],
  },
  {
    nome: 'Marina Costa', unidade: 'Tecnologia e Inovação', cidade: 'São Paulo', cargo: 'Analista de UX',
    bio: 'Trabalho com design systems e adoro um bom coffee chat. Jogo xadrez nas horas vagas.',
    tecnicas: ['Design Systems', 'Node.js', 'Figma'], hobbies: ['Xadrez', 'Fotografia'],
    objetivos: ['NETWORKING', 'HOBBY'],
  },
  {
    nome: 'Bruno Lima', unidade: 'Data & AI', cidade: 'Recife', cargo: 'Engenheiro de Dados Sênior',
    bio: 'Dados, Python e Power BI no dia a dia. Corro de manhã e jogo jogos de tabuleiro com os amigos.',
    tecnicas: ['Python', 'Azure', 'Power BI'], hobbies: ['Corrida', 'Jogos de tabuleiro'],
    objetivos: ['TROCA_DE_CONHECIMENTO'],
  },
  {
    nome: 'Camila Rocha', unidade: 'Cloud', cidade: 'Rio de Janeiro', cargo: 'Arquiteto de Soluções',
    bio: 'Infraestrutura como código e nuvem. Corro e leio ficção científica.',
    tecnicas: ['Azure', 'Node.js', 'Terraform'], hobbies: ['Corrida', 'Ficção científica'],
    objetivos: ['CONHECER_GENTE', 'MENTORIA'],
  },
  {
    nome: 'Lucas Andrade', unidade: 'Engenharia', cidade: 'Recife', cargo: 'Desenvolvedora Pleno',
    bio: 'Desenvolvo em React e Node.js e estou aprendendo nuvem. Café especial e xadrez fora do trabalho.',
    tecnicas: ['React', 'Node.js', 'Arquitetura de nuvem'], hobbies: ['Xadrez', 'Café especial'],
    objetivos: ['NETWORKING', 'TROCA_DE_CONHECIMENTO'],
  },
  {
    nome: 'Mariana Teixeira', unidade: 'Consultoria', cidade: 'Belo Horizonte', cargo: 'Consultora',
    bio: 'Gestão de produto e agilidade. Trilhas e culinária aos fins de semana.',
    tecnicas: ['Gestão de produto', 'Agile', 'Visualização de dados'], hobbies: ['Trilhas', 'Culinária', 'Yoga'],
    objetivos: ['MENTORIA', 'CONHECER_GENTE'],
  },
];

const NOMES_GERADOS = [
  'Diego Alves', 'Helena Prado', 'Rafael Nunes', 'Beatriz Moura', 'Felipe Cardoso', 'Larissa Fontes', 'Thiago Ribeiro',
  'Juliana Matos', 'Gustavo Pires', 'Patrícia Neves', 'André Barros', 'Fernanda Lopes', 'Rodrigo Campos',
  'Carolina Dias', 'Vinícius Araújo', 'Tatiane Gomes', 'Eduardo Santos', 'Renata Farias', 'Matheus Duarte',
  'Isabela Cunha', 'Leonardo Freitas', 'Priscila Torres', 'Henrique Melo', 'Aline Barbosa',
];

// Gerador pseudoaleatório determinístico (mulberry32) para o seed ser reproduzível.
function gerador(semente) {
  let estado = semente;
  return () => {
    estado = (estado + 0x6d2b79f5) | 0;
    let t = Math.imul(estado ^ (estado >>> 15), 1 | estado);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sortear(lista, quantidade, aleatorio) {
  const copia = [...lista];
  const escolhidos = [];
  while (escolhidos.length < quantidade && copia.length) {
    escolhidos.push(copia.splice(Math.floor(aleatorio() * copia.length), 1)[0]);
  }
  return escolhidos;
}

const emailDe = (nome) =>
  `${nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, '.')}@exemplo.test`;

export function montarPessoas() {
  const aleatorio = gerador(2026);
  const geradas = NOMES_GERADOS.map((nome) => ({
    nome,
    unidade: sortear(UNIDADES, 1, aleatorio)[0],
    cidade: sortear(CIDADES, 1, aleatorio)[0],
    cargo: sortear(CARGOS, 1, aleatorio)[0],
    bio: null,
    tecnicas: sortear(TAGS_TECNICAS, 3 + Math.floor(aleatorio() * 3), aleatorio),
    hobbies: sortear(TAGS_HOBBY, 2 + Math.floor(aleatorio() * 3), aleatorio),
    objetivos: sortear(OBJETIVOS, 1 + Math.floor(aleatorio() * 2), aleatorio),
  }));
  return [...PESSOAS_FIXAS, ...geradas].map((p) => ({ ...p, email: emailDe(p.nome) }));
}

// Popula o banco se estiver vazio. Com `demonstracao`, cria também conexões e mensagens
// de exemplo para a usuária Ana Silva. Devolve true se inseriu dados.
export async function semear(banco, { demonstracao = true } = {}) {
  const [{ total }] = await banco.query('SELECT COUNT(*)::int AS total FROM employee');
  if (total > 0) return false;

  await banco.tx(async ({ query }) => {
    const idsTag = new Map();
    const inserirTags = async (nomes, categoria) => {
      for (const nome of nomes) {
        const [tag] = await query('INSERT INTO interest_tag (name, category) VALUES ($1, $2) RETURNING id', [nome, categoria]);
        idsTag.set(nome, tag.id);
      }
    };
    await inserirTags(TAGS_TECNICAS, 'TECHNICAL');
    await inserirTags(TAGS_HOBBY, 'HOBBY');

    const idsPessoa = new Map();
    for (const pessoa of montarPessoas()) {
      const [criada] = await query(
        `INSERT INTO employee (auth_provider_id, name, email, bio, position, department, location, connection_goals)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb) RETURNING id`,
        [`seed-${pessoa.email}`, pessoa.nome, pessoa.email, pessoa.bio, pessoa.cargo, pessoa.unidade, pessoa.cidade, JSON.stringify(pessoa.objetivos)],
      );
      idsPessoa.set(pessoa.nome, criada.id);
      for (const nome of [...pessoa.tecnicas, ...pessoa.hobbies]) {
        await query('INSERT INTO employee_interest (employee_id, interest_id, source) VALUES ($1, $2, $3)', [criada.id, idsTag.get(nome), 'MANUAL']);
      }
    }

    if (!demonstracao) return;
    const ana = idsPessoa.get('Ana Silva');

    // Solicitação recebida por Ana (aparece em "Recebidas").
    await query(`INSERT INTO connection_match (requester_id, receiver_id, status, match_score) VALUES ($1, $2, 'PENDING', 0.31)`, [
      idsPessoa.get('Camila Rocha'),
      ana,
    ]);

    // Match confirmado entre Ana e Marina, com conversa.
    const [match] = await query(
      `INSERT INTO connection_match (requester_id, receiver_id, status, match_score, responded_at)
       VALUES ($1, $2, 'ACCEPTED', 0.44, NOW()) RETURNING id`,
      [ana, idsPessoa.get('Marina Costa')],
    );
    const mensagens = [
      [idsPessoa.get('Marina Costa'), 'Oi, Ana! Vi que você curte fotografia também.'],
      [ana, 'Oi, Marina! Curto sim. Você fotografa o quê?'],
    ];
    for (const [remetente, corpo] of mensagens) {
      await query('INSERT INTO chat_message (match_id, sender_id, body) VALUES ($1, $2, $3)', [match.id, remetente, corpo]);
    }
  });

  return true;
}
