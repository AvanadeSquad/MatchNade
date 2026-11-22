import { gerarHashSenha, normalizarRespostaSeguranca } from '../services/autenticacao.js';
import { calcularAfinidade, calcularIdf } from '../services/afinidade.js';
import { AVATARES, HORARIOS_CAFE, OBJETIVOS } from '../services/perfil.js';

// População fictícia realista para demonstração, indicadores e teste de carga. Cada pessoa tem cadastro completo
// (bio, cargo, unidade, cidade, objetivos, interesses, e os campos de personalização) e a base ganha histórico
// de conexões, mensagens, bloqueios e denúncias. Tudo é inventado e determinístico para uma mesma semente.
// Não cria nenhum registro de IA: o `ai_interaction_log` só deve conter chamadas que de fato aconteceram.

export const DOMINIO = 'exemplo.test';
export const SENHA_POPULACAO = 'senha-de-demonstracao-publica';

// Interesses técnicos por trilha profissional. A ordem de cada lista é a popularidade: as primeiras tags aparecem
// em muita gente e as últimas em pouca, como num catálogo real (poucas tags comuns e uma cauda longa de raras).
// prettier-ignore
export const TRILHAS = [
  {
    id: 'dados', peso: 0.17, unidade: 'Data & AI',
    tecnicas: ['Python', 'SQL', 'Power BI', 'Machine Learning', 'Engenharia de dados', 'Visualização de dados', 'Spark', 'Databricks', 'Estatística', 'dbt', 'Airflow', 'Deep Learning', 'NLP', 'Ciência de dados', 'Data Lakehouse', 'Azure Synapse'],
    hobbies: ['Xadrez', 'Jogos de tabuleiro', 'Corrida', 'Ficção científica', 'Astronomia', 'Sudoku'],
    cargos: ['Analista de Dados', 'Engenheiro de Dados', 'Cientista de Dados', 'Analista de BI'],
  },
  {
    id: 'cloud', peso: 0.16, unidade: 'Cloud',
    tecnicas: ['Azure', 'DevOps', 'Terraform', 'Kubernetes', 'Arquitetura de nuvem', 'Docker', 'CI/CD', 'Linux', 'Observabilidade', 'GitHub Actions', 'Bicep', 'Ansible', 'FinOps', 'Redes', 'AWS', 'Azure Functions'],
    hobbies: ['Ciclismo', 'Trilhas', 'Café especial', 'Games', 'Cervejas artesanais', 'Camping'],
    cargos: ['Engenheiro de Nuvem', 'Arquiteto de Soluções', 'Engenheiro DevOps', 'SRE'],
  },
  {
    id: 'web', peso: 0.2, unidade: 'Engenharia',
    tecnicas: ['React', 'Node.js', 'TypeScript', 'JavaScript', '.NET', 'Java', 'APIs REST', 'Angular', 'GraphQL', 'PostgreSQL', 'C#', 'Vue', 'Spring Boot', 'Next.js', 'Microsserviços', 'HTML e CSS'],
    hobbies: ['Games', 'Música', 'Séries', 'Futebol', 'Violão', 'Cinema'],
    cargos: ['Desenvolvedor Full Stack', 'Desenvolvedor Back-end', 'Desenvolvedora Front-end', 'Tech Lead'],
  },
  {
    id: 'design', peso: 0.12, unidade: 'Experience Design',
    tecnicas: ['Figma', 'UX Research', 'Design Systems', 'Acessibilidade', 'UI Design', 'Prototipação', 'Design Thinking', 'Pesquisa com usuários', 'Design de serviços', 'Tipografia', 'Motion Design', 'Content Design'],
    hobbies: ['Fotografia', 'Pintura', 'Leitura de ficção', 'Viagens', 'Cinema', 'Cerâmica', 'Teatro'],
    cargos: ['Analista de UX', 'Designer de Produto', 'UX Researcher', 'Designer de Serviços'],
  },
  {
    id: 'produto', peso: 0.1, unidade: 'Consultoria',
    tecnicas: ['Gestão de produto', 'Agile', 'Scrum', 'Gestão de projetos', 'Análise de negócios', 'Kanban', 'OKRs', 'Roadmap', 'Discovery', 'Métricas de produto', 'Liderança técnica', 'Product Ops'],
    hobbies: ['Leitura de ficção', 'Yoga', 'Culinária', 'Viagens', 'Podcasts', 'Voluntariado'],
    cargos: ['Product Owner', 'Gerente de Projetos', 'Consultora', 'Analista de Negócios'],
  },
  {
    id: 'seguranca', peso: 0.07, unidade: 'Segurança',
    tecnicas: ['Cibersegurança', 'LGPD', 'IAM', 'Zero Trust', 'Segurança em nuvem', 'Pentest', 'SOC', 'Gestão de vulnerabilidades', 'Criptografia', 'Threat modeling', 'Governança de risco', 'Forense digital'],
    hobbies: ['Xadrez', 'Escalada', 'Corrida', 'Jogos de tabuleiro', 'Boxe', 'RPG de mesa'],
    cargos: ['Analista de Segurança', 'Especialista em IAM', 'Analista de SOC', 'Consultor de Segurança'],
  },
  {
    id: 'erp', peso: 0.09, unidade: 'Tecnologia e Inovação',
    tecnicas: ['Power Platform', 'Salesforce', 'SAP', 'Dynamics 365', 'Power Automate', 'ServiceNow', 'CRM', 'Integração de sistemas', 'Low-code', 'Automação de processos', 'ABAP', 'Oracle'],
    hobbies: ['Futebol', 'Churrasco', 'Música', 'Viagens', 'Vôlei', 'Séries'],
    cargos: ['Consultor SAP', 'Desenvolvedora Power Platform', 'Consultor Salesforce', 'Analista Funcional'],
  },
  {
    id: 'qualidade', peso: 0.09, unidade: 'Operações',
    tecnicas: ['Testes automatizados', 'Qualidade de software', 'Playwright', 'Cypress', 'Mobile', 'Testes de desempenho', 'TDD', 'Appium', 'Kotlin', 'Swift', 'Flutter', 'React Native'],
    hobbies: ['Corrida', 'Natação', 'Fotografia', 'Games', 'Jardinagem', 'Surf'],
    cargos: ['Analista de Qualidade', 'Engenheiro de Testes', 'Desenvolvedor Mobile', 'QA Lead'],
  },
];

// Hobbies em ordem de popularidade (o início é mais comum). Inclui os do seed e outros.
// prettier-ignore
export const HOBBIES = [
  'Viagens', 'Música', 'Cinema', 'Séries', 'Leitura de ficção', 'Futebol', 'Culinária', 'Corrida', 'Games', 'Café especial',
  'Fotografia', 'Xadrez', 'Trilhas', 'Yoga', 'Jogos de tabuleiro', 'Ciclismo', 'Violão', 'Podcasts', 'Voluntariado', 'Natação',
  'Vôlei', 'Teatro', 'Pintura', 'Jardinagem', 'Vinho', 'Cervejas artesanais', 'Ficção científica', 'Dança', 'Surf', 'Escalada',
  'Churrasco', 'Camping', 'Astronomia', 'Sudoku', 'Boxe', 'RPG de mesa', 'Cerâmica', 'Idiomas', 'Panificação', 'Quadrinhos',
  'Tênis', 'Basquete', 'Crossfit', 'Montanhismo', 'Mergulho', 'Skate', 'Marcenaria', 'Tricô', 'Origami', 'Escrita',
  'Poesia', 'Ópera', 'Jazz', 'Forró', 'Samba', 'Rock', 'Anime', 'Poker', 'Mangá', 'Astrofotografia',
];

// prettier-ignore
const NOMES = [
  'Ana', 'Beatriz', 'Bruno', 'Camila', 'Carlos', 'Clara', 'Daniel', 'Débora', 'Eduardo', 'Elisa', 'Fernando', 'Gabriela',
  'Guilherme', 'Helena', 'Igor', 'Isabela', 'João', 'Joana', 'Júlia', 'Larissa', 'Leandro', 'Letícia', 'Lucas', 'Luísa',
  'Marcelo', 'Marina', 'Mateus', 'Mariana', 'Natália', 'Nicolas', 'Otávio', 'Paula', 'Pedro', 'Rafaela', 'Rafael', 'Renato',
  'Sabrina', 'Samuel', 'Sofia', 'Tiago', 'Valentina', 'Vítor', 'Yasmin', 'Alice', 'Arthur', 'Bianca', 'Caio', 'Diego',
  'Érica', 'Felipe', 'Giovana', 'Henrique', 'Iara', 'Jonas', 'Karina', 'Lívia', 'Murilo', 'Nathalia', 'Priscila', 'Ricardo',
];
// prettier-ignore
const SOBRENOMES = [
  'Almeida', 'Andrade', 'Araújo', 'Barbosa', 'Barros', 'Batista', 'Borges', 'Campos', 'Cardoso', 'Carvalho', 'Castro', 'Cavalcanti',
  'Correia', 'Costa', 'Dias', 'Duarte', 'Farias', 'Fernandes', 'Ferreira', 'Fonseca', 'Freitas', 'Gomes', 'Guimarães', 'Lima',
  'Lopes', 'Machado', 'Martins', 'Medeiros', 'Melo', 'Mendes', 'Moraes', 'Moreira', 'Moura', 'Nascimento', 'Nogueira', 'Nunes',
  'Oliveira', 'Pacheco', 'Pereira', 'Pinto', 'Ramos', 'Reis', 'Ribeiro', 'Rocha', 'Rodrigues', 'Santana', 'Santos', 'Silva',
  'Soares', 'Souza', 'Teixeira', 'Torres', 'Vasconcelos', 'Vieira', 'Xavier', 'Zanetti', 'Prado', 'Fontes', 'Matos', 'Cunha',
];
// prettier-ignore
const CIDADES = [['São Paulo', 0.3], ['Recife', 0.16], ['Rio de Janeiro', 0.14], ['Belo Horizonte', 0.1], ['Porto Alegre', 0.08], ['Curitiba', 0.08], ['Salvador', 0.07], ['Brasília', 0.07]];
const NIVEIS = ['Júnior', 'Pleno', 'Sênior'];
const PRONOMES = ['ela/dela', 'ele/dele', 'ela/dela', 'ele/dele', 'elu/delu'];
const RAZOES_DENUNCIA = [
  'Mensagem fora do tom profissional.',
  'Insistência em um convite recusado.',
  'Conteúdo que não tem relação com o trabalho.',
  'Perfil com informação que parece falsa.',
];
const SAUDACOES = [
  'Oi! Vi que temos interesses em comum, adorei o seu perfil.',
  'Olá! Tudo bem? Também curto {tag}.',
  'Que bom que deu match! Como você começou com {tag}?',
  'Oi, tudo certo? Fiquei curioso(a) sobre o seu trabalho com {tag}.',
];
const RESPOSTAS = [
  'Tudo ótimo! Comecei há uns anos e não parei mais.',
  'Que legal! Posso te mandar uns materiais que uso.',
  'Adoraria trocar uma ideia sobre isso.',
  'Boa! Qual é o seu maior desafio hoje com {tag}?',
  'Também gosto muito. Já participou de algum evento sobre isso?',
  'Combinado, vamos marcar um café virtual.',
  'Perfeito, te envio o convite.',
  'Obrigado(a) pela conversa, foi ótimo!',
];

// Gerador pseudoaleatório determinístico (mulberry32).
export function criarGerador(semente) {
  let estado = semente >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) | 0;
    let t = Math.imul(estado ^ (estado >>> 15), 1 | estado);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const inteiro = (aleatorio, minimo, maximo) => minimo + Math.floor(aleatorio() * (maximo - minimo + 1));
const escolher = (lista, aleatorio) => lista[Math.floor(aleatorio() * lista.length)];

// Sorteio ponderado sem repetição. `pesos[i]` é o peso do item i.
function sortearPonderado(lista, pesos, quantidade, aleatorio) {
  const itens = lista.map((valor, i) => ({ valor, peso: pesos[i] }));
  const escolhidos = [];
  while (escolhidos.length < quantidade && itens.length) {
    const total = itens.reduce((soma, item) => soma + item.peso, 0);
    let ponto = aleatorio() * total;
    let indice = 0;
    while (indice < itens.length - 1 && ponto >= itens[indice].peso) {
      ponto -= itens[indice].peso;
      indice += 1;
    }
    escolhidos.push(itens.splice(indice, 1)[0].valor);
  }
  return escolhidos;
}

// Peso de popularidade por posição: 1 / (posição + 1) ^ 0.8.
const pesoZipf = (posicao) => 1 / (posicao + 1) ** 0.8;
const zipf = (tamanho) => Array.from({ length: tamanho }, (_, i) => pesoZipf(i));

function escolherPonderado(itens, aleatorio) {
  let ponto = aleatorio() * itens.reduce((soma, [, peso]) => soma + peso, 0);
  for (const [valor, peso] of itens) {
    ponto -= peso;
    if (ponto < 0) return valor;
  }
  return itens[itens.length - 1][0];
}

const semAcento = (texto) => texto.normalize('NFD').replace(/\p{M}/gu, '');

function nomeDaPosicao(i) {
  const base = NOMES.length * SOBRENOMES.length;
  const nome = NOMES[i % NOMES.length];
  const sobrenome = SOBRENOMES[Math.floor(i / NOMES.length) % SOBRENOMES.length];
  if (i < base) return `${nome} ${sobrenome}`;
  const letra = String.fromCharCode(65 + (Math.floor(i / base) % 26));
  return `${nome} ${letra}. ${sobrenome}`;
}

function montarBio(pessoa, aleatorio) {
  const [t1, t2, t3] = pessoa.tecnicas;
  const [h1, h2] = pessoa.hobbies;
  const anos = inteiro(aleatorio, 1, 12);
  const modelos = [
    `Trabalho com ${t1} e ${t2} há ${anos} anos. Fora do trabalho, curto ${h1}${h2 ? ` e ${h2}` : ''}.`,
    `${t1} no dia a dia e muita curiosidade por ${t3 ?? t2}. Nos fins de semana, ${h1}${h2 ? ` e ${h2}` : ''}.`,
    `Apaixonado(a) por ${t1}. Gosto de trocar ideia sobre ${t2} e de conhecer gente de outras áreas. ${h1} é o meu hobby favorito.`,
    `Atuo com ${t1}, ${t2}${t3 ? ` e ${t3}` : ''}. Quando sobra tempo, ${h1}${h2 ? ` e ${h2}` : ''}.`,
    `Foco em ${t1}. Aprendendo ${t3 ?? t2} e sempre aberto(a) a um café virtual. Fora do trabalho: ${h1}${h2 ? `, ${h2}` : ''}.`,
  ];
  return escolher(modelos, aleatorio);
}

// Gera `total` pessoas completas a partir da posição `inicio` (para continuar uma base já populada sem repetir nomes).
// `emailsUsados` evita e-mails que já existem.
export function gerarPessoas({ total, semente = 2026, inicio = 0, emailsUsados = new Set(), agora = new Date() }) {
  const aleatorio = criarGerador(semente + inicio);
  const usados = new Set(emailsUsados);
  const pesosTrilha = TRILHAS.map((t) => [t, t.peso]);
  const pessoas = [];
  for (let i = 0; i < total; i += 1) {
    const nome = nomeDaPosicao(inicio + i);
    let email = `${semAcento(nome)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.|\.$/g, '')}@${DOMINIO}`;
    for (let k = 2; usados.has(email); k += 1) email = email.replace(/(\.\d+)?@/, `.${k}@`);
    usados.add(email);

    const trilha = escolherPonderado(pesosTrilha, aleatorio);
    const tecnicas = sortearPonderado(trilha.tecnicas, zipf(trilha.tecnicas.length), inteiro(aleatorio, 3, 5), aleatorio);
    if (aleatorio() < 0.3) {
      const outra = escolher(
        TRILHAS.filter((t) => t.id !== trilha.id),
        aleatorio,
      );
      for (const tag of sortearPonderado(outra.tecnicas, zipf(outra.tecnicas.length), inteiro(aleatorio, 1, 2), aleatorio)) {
        if (!tecnicas.includes(tag)) tecnicas.push(tag);
      }
    }
    const deTrilha = sortearPonderado(trilha.hobbies, zipf(trilha.hobbies.length), inteiro(aleatorio, 1, 2), aleatorio);
    const globais = sortearPonderado(HOBBIES, zipf(HOBBIES.length), inteiro(aleatorio, 1, 3), aleatorio);
    const hobbies = [...new Set([...deTrilha, ...globais])];

    const pessoa = {
      nome,
      email,
      trilha: trilha.id,
      unidade: aleatorio() < 0.8 ? trilha.unidade : escolher(TRILHAS, aleatorio).unidade,
      cidade: escolherPonderado(CIDADES, aleatorio),
      cargo: `${escolher(trilha.cargos, aleatorio)} ${escolher(NIVEIS, aleatorio)}`,
      tecnicas,
      hobbies,
      objetivos: sortearPonderado(OBJETIVOS, [3, 2, 1, 1, 3], inteiro(aleatorio, 1, 3), aleatorio),
      maximoSemanal: inteiro(aleatorio, 2, 5),
      pausado: aleatorio() < 0.04,
      pronomes: aleatorio() < 0.35 ? escolher(PRONOMES, aleatorio) : null,
      avatar: aleatorio() < 0.45 ? escolher(AVATARES, aleatorio) : null,
      visibilidade: aleatorio() < 0.08 ? 'UNIT' : 'ALL',
      horarios: aleatorio() < 0.4 ? HORARIOS_CAFE.filter(() => aleatorio() < 0.3).slice(0, 4) : [],
      pergunta: escolher(['primeiro_pet', 'cidade_nascimento', 'primeira_escola', 'apelido_infancia', 'professor'], aleatorio),
      criadaHa: inteiro(aleatorio, 5, 120),
      vistaHa: aleatorio() < 0.75 ? inteiro(aleatorio, 0, 14) : null,
    };
    pessoa.bio = montarBio(pessoa, aleatorio);
    pessoa.criadaEm = new Date(agora.getTime() - pessoa.criadaHa * 86_400_000);
    pessoas.push(pessoa);
  }
  return pessoas;
}

// ---------- histórico ----------

const DIA = 86_400_000;
const SEMANA = 7 * DIA;
const DIAS_EXPIRACAO = 14;

// Sorteia o desfecho de cada pedido e a idade dele, coerentes com as regras: pendente tem até 13 dias, expirado tem
// mais de 14 e nunca foi respondido, aceito e recusado têm resposta depois do pedido.
function sortearPedido(aleatorio, agora) {
  const status = escolherPonderado(
    [
      ['ACCEPTED', 0.34],
      ['PENDING', 0.28],
      ['DECLINED', 0.2],
      ['EXPIRED', 0.18],
    ],
    aleatorio,
  );
  const idadeDias =
    status === 'PENDING'
      ? aleatorio() * (DIAS_EXPIRACAO - 1)
      : status === 'EXPIRED'
        ? DIAS_EXPIRACAO + 1 + aleatorio() * 55
        : 1 + aleatorio() * 68;
  const criado = new Date(agora.getTime() - idadeDias * DIA);
  const respondido =
    status === 'ACCEPTED' || status === 'DECLINED'
      ? new Date(Math.min(agora.getTime(), criado.getTime() + (0.02 + aleatorio() * 3) * DIA))
      : null;
  return { status, criado, respondido };
}

function montarHistorico(pessoas, ids, aleatorio, agora) {
  // Índice invertido: tag -> posições das pessoas, para sugerir pares com ao menos um interesse em comum.
  const porTag = new Map();
  pessoas.forEach((p, i) => {
    for (const tag of [...p.tecnicas, ...p.hobbies]) {
      if (!porTag.has(tag)) porTag.set(tag, []);
      porTag.get(tag).push(i);
    }
  });
  const contagem = new Map([...porTag].map(([tag, lista]) => [tag, lista.length]));
  const idf = calcularIdf(pessoas.length, contagem);
  const perfil = (p) => ({ tecnicas: p.tecnicas, hobbies: p.hobbies, unidade: p.unidade });

  const pares = new Set();
  const porSemana = new Map();
  const conexoes = [];
  const quantidadeDePedidos = () =>
    escolherPonderado(
      [
        [0, 0.35],
        [1, 0.25],
        [2, 0.2],
        [3, 0.12],
        [4, 0.04],
        [5, 0.025],
        [6, 0.015],
      ],
      aleatorio,
    );

  pessoas.forEach((remetente, i) => {
    for (let k = quantidadeDePedidos(); k > 0; k -= 1) {
      const tag = escolher([...remetente.tecnicas, ...remetente.hobbies], aleatorio);
      const candidatos = porTag.get(tag);
      const j = aleatorio() < 0.85 ? escolher(candidatos, aleatorio) : Math.floor(aleatorio() * pessoas.length);
      const destino = pessoas[j];
      const chave = i < j ? `${i}:${j}` : `${j}:${i}`;
      if (i === j || pares.has(chave) || destino.pausado) continue;
      if (destino.visibilidade === 'UNIT' && destino.unidade !== remetente.unidade) continue;
      const pedido = sortearPedido(aleatorio, agora);
      const semana = `${i}:${Math.floor(pedido.criado.getTime() / SEMANA)}`;
      if ((porSemana.get(semana) ?? 0) >= remetente.maximoSemanal) continue;
      pares.add(chave);
      porSemana.set(semana, (porSemana.get(semana) ?? 0) + 1);
      const score = calcularAfinidade(perfil(remetente), perfil(destino), idf).score;
      conexoes.push({ de: i, para: j, ...pedido, score: Math.round(score * 1e4) / 1e4 });
    }
  });

  // Mensagens só nas conexões aceitas.
  const mensagens = [];
  const frase = (modelos, tag) => escolher(modelos, aleatorio).replace('{tag}', tag);
  for (const c of conexoes) {
    if (c.status !== 'ACCEPTED') continue;
    const [a, b] = [pessoas[c.de], pessoas[c.para]];
    const tagComum = [...a.tecnicas, ...a.hobbies].find((t) => b.tecnicas.includes(t) || b.hobbies.includes(t)) ?? a.tecnicas[0];
    const quantidade = Math.min(14, inteiro(aleatorio, 1, 4) + Math.floor(-Math.log(1 - aleatorio()) * 3));
    let instante = c.respondido.getTime();
    for (let n = 0; n < quantidade; n += 1) {
      instante += Math.round((0.01 + aleatorio() * 0.4) * DIA);
      if (instante > agora.getTime()) break;
      const remetente = n % 2 === 0 ? c.de : c.para;
      mensagens.push({
        conexao: c,
        remetente,
        corpo: n === 0 ? frase(SAUDACOES, tagComum) : frase(RESPOSTAS, tagComum),
        em: new Date(instante),
      });
    }
    if (aleatorio() < 0.25 && instante + 3_600_000 < agora.getTime()) {
      const quando = `${escolher(['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira'], aleatorio)}, ${String(inteiro(aleatorio, 1, 28)).padStart(2, '0')}/${String(inteiro(aleatorio, 1, 12)).padStart(2, '0')} às ${escolher(HORARIOS_CAFE, aleatorio)}`;
      mensagens.push({
        conexao: c,
        remetente: c.de,
        corpo: `[Coffee Chat] Convite para Coffee Chat Virtual (15 min)\nSugerido: ${quando}`,
        em: new Date(instante + 1_800_000),
      });
      mensagens.push({
        conexao: c,
        remetente: c.para,
        corpo: `[Coffee Chat] Convite aceito: ${quando}`,
        em: new Date(instante + 3_600_000),
      });
    }
  }

  const bloqueios = [];
  const denuncias = [];
  pessoas.forEach((p, i) => {
    if (aleatorio() < 0.012) {
      const j = Math.floor(aleatorio() * pessoas.length);
      if (j !== i) bloqueios.push({ de: i, para: j, em: new Date(agora.getTime() - aleatorio() * 40 * DIA) });
    }
    if (aleatorio() < 0.004) {
      const j = Math.floor(aleatorio() * pessoas.length);
      if (j !== i)
        denuncias.push({
          de: i,
          para: j,
          motivo: escolher(RAZOES_DENUNCIA, aleatorio),
          em: new Date(agora.getTime() - aleatorio() * 40 * DIA),
        });
    }
  });
  return { conexoes, mensagens, bloqueios, denuncias, ids };
}

// ---------- banco ----------

export class BancoComDadosReais extends Error {
  constructor(quantidade) {
    super(
      `O banco tem ${quantidade} ${quantidade === 1 ? 'pessoa' : 'pessoas'} com e-mail fora de @${DOMINIO}. ` +
        'A população fictícia só entra em banco vazio ou que tenha apenas dados fictícios. Nada foi alterado.',
    );
    this.name = 'BancoComDadosReais';
  }
}

const ISO = (data) => (data ? data.toISOString() : '');
const em = (data) => data.toISOString();

async function emLotes(lista, tamanho, fn) {
  for (let i = 0; i < lista.length; i += tamanho) await fn(lista.slice(i, i + tamanho));
}

// Insere a população no banco e devolve o resumo. Recusa produção e banco com pessoas fora do domínio fictício.
export async function popularBanco(banco, { total, semente = 2026, historico = true, agora = new Date() } = {}) {
  if (process.env.NODE_ENV === 'production') throw new Error('A população fictícia é proibida em produção.');
  if (!Number.isInteger(total) || total < 1) throw new Error('Informe um número de perfis maior que zero.');
  const [{ alheias }] = await banco.query(`SELECT COUNT(*)::int AS alheias FROM employee WHERE email NOT LIKE $1`, [`%@${DOMINIO}`]);
  if (alheias > 0) throw new BancoComDadosReais(alheias);

  const existentes = await banco.query('SELECT email FROM employee');
  const pessoas = gerarPessoas({ total, semente, inicio: existentes.length, emailsUsados: new Set(existentes.map((e) => e.email)), agora });

  // Catálogo: só entram as tags que a população usa, sem duplicar as que já existem (comparação sem maiúsculas).
  const catalogo = new Map();
  for (const p of pessoas) {
    for (const t of p.tecnicas) catalogo.set(t, 'TECHNICAL');
    for (const h of p.hobbies) if (!catalogo.has(h)) catalogo.set(h, 'HOBBY');
  }
  const nomes = [...catalogo.keys()];
  await banco.query(
    `INSERT INTO interest_tag (name, category)
     SELECT n, c FROM unnest($1::text[], $2::text[]) AS t(n, c)
     ON CONFLICT (LOWER(name)) DO NOTHING`,
    [nomes, nomes.map((n) => catalogo.get(n))],
  );
  const tagsDoBanco = await banco.query('SELECT id, name FROM interest_tag');
  const idDaTag = new Map(tagsDoBanco.map((t) => [t.name.toLowerCase(), t.id]));

  const senhaHash = await gerarHashSenha(SENHA_POPULACAO);
  const respostaHash = await gerarHashSenha(normalizarRespostaSeguranca('resposta de demonstracao'));

  const ids = new Array(pessoas.length);
  const idPorEmail = new Map();
  await emLotes(
    pessoas.map((p, i) => [p, i]),
    1000,
    async (lote) => {
      const col = (fn) => lote.map(([p]) => fn(p));
      const linhas = await banco.query(
        `INSERT INTO employee (auth_provider_id, name, email, bio, position, department, location, connection_goals, max_weekly_matches,
                             is_paused, pronouns, visibility, avatar_id, preferred_coffee_slots, password_hash, security_question_id,
                             security_answer_hash, created_at, last_seen_at)
       SELECT 'pop-' || e, n, e, b, c, d, l, g::jsonb, m, pa, NULLIF(pr, ''), v, NULLIF(av, ''), s::jsonb, $15::text, q, $16::text, cr::timestamptz, NULLIF(ls, '')::timestamptz
         FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::int[], $9::bool[],
                     $10::text[], $11::text[], $12::text[], $13::text[], $14::text[], $17::text[], $18::text[])
              AS t(n, e, b, c, d, l, g, m, pa, pr, v, av, s, q, cr, ls)
       RETURNING id, email`,
        [
          col((p) => p.nome),
          col((p) => p.email),
          col((p) => p.bio),
          col((p) => p.cargo),
          col((p) => p.unidade),
          col((p) => p.cidade),
          col((p) => JSON.stringify(p.objetivos)),
          col((p) => p.maximoSemanal),
          col((p) => p.pausado),
          col((p) => p.pronomes ?? ''),
          col((p) => p.visibilidade),
          col((p) => p.avatar ?? ''),
          col((p) => JSON.stringify(p.horarios)),
          col((p) => p.pergunta),
          senhaHash,
          respostaHash,
          col((p) => em(p.criadaEm)),
          col((p) => (p.vistaHa === null ? '' : em(new Date(agora.getTime() - p.vistaHa * DIA)))),
        ],
      );
      for (const linha of linhas) idPorEmail.set(linha.email, linha.id);
    },
  );
  pessoas.forEach((p, i) => {
    ids[i] = idPorEmail.get(p.email);
  });

  const interesses = pessoas.flatMap((p, i) => [...p.tecnicas, ...p.hobbies].map((tag) => [ids[i], idDaTag.get(tag.toLowerCase())]));
  await emLotes(interesses, 5000, (lote) =>
    banco.query(
      `INSERT INTO employee_interest (employee_id, interest_id, source)
       SELECT e, t, 'MANUAL' FROM unnest($1::int[], $2::int[]) AS x(e, t) ON CONFLICT DO NOTHING`,
      [lote.map(([e]) => e), lote.map(([, t]) => t)],
    ),
  );

  const resumo = {
    pessoas: pessoas.length,
    tags: nomes.length,
    interesses: interesses.length,
    conexoes: 0,
    mensagens: 0,
    bloqueios: 0,
    denuncias: 0,
  };
  if (!historico) return resumo;

  const h = montarHistorico(pessoas, ids, criarGerador(semente * 7 + pessoas.length), agora);
  await emLotes(h.conexoes, 3000, async (lote) => {
    const linhas = await banco.query(
      `INSERT INTO connection_match (requester_id, receiver_id, status, match_score, created_at, responded_at)
       SELECT r, d, s, sc, cr::timestamptz, NULLIF(re, '')::timestamptz
         FROM unnest($1::int[], $2::int[], $3::text[], $4::float8[], $5::text[], $6::text[]) AS t(r, d, s, sc, cr, re)
       RETURNING id, requester_id, receiver_id`,
      [
        lote.map((c) => ids[c.de]),
        lote.map((c) => ids[c.para]),
        lote.map((c) => c.status),
        lote.map((c) => c.score),
        lote.map((c) => em(c.criado)),
        lote.map((c) => ISO(c.respondido)),
      ],
    );
    const porPar = new Map(linhas.map((l) => [`${l.requester_id}:${l.receiver_id}`, l.id]));
    for (const c of lote) c.id = porPar.get(`${ids[c.de]}:${ids[c.para]}`);
  });
  const mensagens = h.mensagens.filter((m) => m.conexao.id);
  await emLotes(mensagens, 5000, (lote) =>
    banco.query(
      `INSERT INTO chat_message (match_id, sender_id, body, created_at)
       SELECT m, s, b, c::timestamptz FROM unnest($1::int[], $2::int[], $3::text[], $4::text[]) AS t(m, s, b, c)`,
      [lote.map((x) => x.conexao.id), lote.map((x) => ids[x.remetente]), lote.map((x) => x.corpo), lote.map((x) => em(x.em))],
    ),
  );
  if (h.bloqueios.length) {
    await banco.query(
      `INSERT INTO employee_block (blocker_id, blocked_id, created_at)
       SELECT a, b, c::timestamptz FROM unnest($1::int[], $2::int[], $3::text[]) AS t(a, b, c) ON CONFLICT DO NOTHING`,
      [h.bloqueios.map((b) => ids[b.de]), h.bloqueios.map((b) => ids[b.para]), h.bloqueios.map((b) => em(b.em))],
    );
  }
  if (h.denuncias.length) {
    await banco.query(
      `INSERT INTO employee_report (reporter_id, reported_id, reason, created_at)
       SELECT a, b, r, c::timestamptz FROM unnest($1::int[], $2::int[], $3::text[], $4::text[]) AS t(a, b, r, c)`,
      [
        h.denuncias.map((d) => ids[d.de]),
        h.denuncias.map((d) => ids[d.para]),
        h.denuncias.map((d) => d.motivo),
        h.denuncias.map((d) => em(d.em)),
      ],
    );
  }
  return {
    ...resumo,
    conexoes: h.conexoes.length,
    mensagens: mensagens.length,
    bloqueios: h.bloqueios.length,
    denuncias: h.denuncias.length,
  };
}
