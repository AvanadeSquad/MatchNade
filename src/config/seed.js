// src/config/seed.js
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

async function runSeed() {
  const client = await pool.connect();

  try {
    console.log('🌱 Iniciando a população do banco de dados (Seed)...');

    await client.query('BEGIN');

    // 1. Limpar dados antigos mantendo a estrutura
    console.log('🧹 Limpando dados anteriores...');
    await client.query(`
      TRUNCATE TABLE 
        public.ai_interaction_log, 
        public.chat_message, 
        public.connection_match, 
        public.employee_block, 
        public.employee_report, 
        public.employee_interest, 
        public.employee, 
        public.interest_tag 
      RESTART IDENTITY CASCADE;
    `);

    // 2. Inserir Tags de Interesse (Técnicas e Hobbies)
    console.log('🏷️ Inserindo catálogo de tags...');
    const tagsData = [
      ['React', 'TECHNICAL'],
      ['Node.js', 'TECHNICAL'],
      ['Python', 'TECHNICAL'],
      ['Azure', 'TECHNICAL'],
      ['Figma', 'TECHNICAL'],
      ['Power BI', 'TECHNICAL'],
      ['Terraform', 'TECHNICAL'],
      ['UX Research', 'TECHNICAL'],
      ['Design Systems', 'TECHNICAL'],
      ['Docker', 'TECHNICAL'],
      ['TypeScript', 'TECHNICAL'],
      ['SQL', 'TECHNICAL'],
      ['Xadrez', 'HOBBY'],
      ['Fotografia', 'HOBBY'],
      ['Leitura de ficção', 'HOBBY'],
      ['Corrida', 'HOBBY'],
      ['Café especial', 'HOBBY'],
      ['Jogos de tabuleiro', 'HOBBY'],
      ['Culinária', 'HOBBY'],
      ['Futebol', 'HOBBY'],
      ['Música', 'HOBBY'],
      ['Viagens', 'HOBBY'],
    ];

    const tagMap = new Map();

    for (const [name, category] of tagsData) {
      const res = await client.query(
        `INSERT INTO public.interest_tag (name, category) 
         VALUES ($1, $2) RETURNING id, name;`,
        [name, category]
      );
      tagMap.set(res.rows[0].name, res.rows[0].id);
    }

    // 3. Inserir Colaboradores (Incluindo Lucas e Mariana)
    console.log('👥 Inserindo colaboradores de teste (30 perfis)...');

    const employeesData = [
      {
        auth_id: 'google-oauth2|lucas123',
        name: 'Lucas Silva',
        email: 'lucas.silva@avanade.com',
        bio: 'Dev Front-end há 1 ano na Avanade. Curto React, Node e soluções Cloud. Amante de um bom café especial e partidas de xadrez nas horas vagas.',
        position: 'Desenvolvedor Pleno',
        department: 'Engenharia de Software',
        location: 'Recife',
        goals: ['Networking', 'Troca de conhecimento'],
        tags: ['React', 'Node.js', 'Azure', 'Xadrez', 'Café especial'],
      },
      {
        auth_id: 'google-oauth2|mariana456',
        name: 'Mariana Costa',
        email: 'mariana.costa@avanade.com',
        bio: 'Tech Lead na Avanade há 5 anos. Apaixonada por Design Systems, arquitetura Node.js, fotografia de rua e torneios de xadrez.',
        position: 'Tech Lead Sênior',
        department: 'Technology & Innovation',
        location: 'São Paulo',
        goals: ['Networking', 'Mentoria', 'Hobbies'],
        tags: ['Design Systems', 'Node.js', 'Xadrez', 'Fotografia'],
      },
      {
        auth_id: 'google-oauth2|bruno789',
        name: 'Bruno Lima',
        email: 'bruno.lima@avanade.com',
        bio: 'Analista de Dados explorando Python e Power BI. Corredor de fim de semana e viciado em jogos de tabuleiro.',
        position: 'Analista de Dados',
        department: 'Data & AI',
        location: 'Recife',
        goals: ['Troca de conhecimento'],
        tags: ['Python', 'Azure', 'Power BI', 'Corrida', 'Jogos de tabuleiro'],
      },
      {
        auth_id: 'google-oauth2|camila101',
        name: 'Camila Rocha',
        email: 'camila.rocha@avanade.com',
        bio: 'Especialista Cloud mexendo com Terraform e Azure. Leitora de ficção científica e adoro correr no parque.',
        position: 'Engenheira Cloud',
        department: 'Cloud',
        location: 'Rio de Janeiro',
        goals: ['Networking'],
        tags: ['Azure', 'Node.js', 'Terraform', 'Corrida', 'Leitura de ficção'],
      },
      {
        auth_id: 'google-oauth2|ana202',
        name: 'Ana Silva',
        email: 'ana.silva@avanade.com',
        bio: 'UX Designer focada em Figma e pesquisas com usuários. Curto tirar fotos e viajar.',
        position: 'UX Designer',
        department: 'Experience Design',
        location: 'São Paulo',
        goals: ['Networking', 'Troca de conhecimento'],
        tags: ['Figma', 'React', 'UX Research', 'Fotografia', 'Viagens'],
      },
    ];

    const cidades = ['São Paulo', 'Recife', 'Rio de Janeiro', 'Belo Horizonte', 'Porto Alegre'];
    const depto = ['Technology', 'Cloud', 'Data & AI', 'Experience Design', 'Software Engineering'];
    const hobbiesList = ['Culinária', 'Futebol', 'Música', 'Viagens', 'Leitura de ficção', 'Jogos de tabuleiro'];
    const techList = ['React', 'Python', 'TypeScript', 'Docker', 'SQL', 'Azure'];

    for (let i = 6; i <= 30; i++) {
      const cidade = cidades[i % cidades.length];
      const dept = depto[i % depto.length];
      const tech1 = techList[i % techList.length];
      const tech2 = techList[(i + 1) % techList.length];
      const hobby1 = hobbiesList[i % hobbiesList.length];

      employeesData.push({
        auth_id: `google-oauth2|user_${i}`,
        name: `Colaborador Teste ${i}`,
        email: `colaborador${i}@avanade.com`,
        bio: `Bio de apresentação do colaborador ${i}. Atuo em ${dept} na unidade ${cidade}.`,
        position: 'Consultor',
        department: dept,
        location: cidade,
        goals: ['Networking', 'Coffee Chat'],
        tags: [tech1, tech2, hobby1],
      });
    }

    for (const emp of employeesData) {
      const empRes = await client.query(
        `INSERT INTO public.employee 
          (auth_provider_id, name, email, bio, position, department, location, connection_goals) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
         RETURNING id;`,
        [emp.auth_id, emp.name, emp.email, emp.bio, emp.position, emp.department, emp.location, emp.goals]
      );

      const employeeId = empRes.rows[0].id;

      for (const tagName of emp.tags) {
        const tagId = tagMap.get(tagName);
        if (tagId) {
          await client.query(
            `INSERT INTO public.employee_interest (employee_id, interest_id, source, confidence_score) 
             VALUES ($1, $2, 'MANUAL', 1.00);`,
            [employeeId, tagId]
          );
        }
      }
    }

    await client.query('COMMIT');
    console.log('🎉 Seed executado com sucesso! 30 perfis e tags foram criados no banco.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro ao executar o seed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

runSeed();