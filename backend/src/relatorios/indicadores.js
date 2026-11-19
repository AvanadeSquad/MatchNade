import { calcularAfinidade } from '../services/afinidade.js';
import { carregarBase } from '../services/recomendacoes.js';

// Indicadores de uso e de funcionamento do sistema, calculados direto das tabelas. Somente leitura.
// Não grava nada e não inclui dados pessoais: só contagens, proporções e tempos.

const numero = (valor) => (valor === null || valor === undefined ? null : Number(valor));
const arredondar = (valor, casas = 1) => (valor === null || valor === undefined ? null : Number(Number(valor).toFixed(casas)));
const percentual = (parte, total) => (total > 0 ? arredondar((100 * parte) / total) : 0);

export function percentil(ordenados, p) {
  if (!ordenados.length) return null;
  const posicao = Math.min(ordenados.length - 1, Math.max(0, Math.ceil(p * ordenados.length) - 1));
  return ordenados[posicao];
}

async function indicadoresDaBase(banco) {
  const [totais] = await banco.query(
    `SELECT COUNT(*)::int AS pessoas,
            COUNT(*) FILTER (WHERE is_paused)::int AS pausadas,
            COUNT(*) FILTER (WHERE visibility = 'UNIT')::int AS so_unidade,
            COUNT(*) FILTER (WHERE avatar_id IS NOT NULL)::int AS com_avatar,
            COUNT(*) FILTER (WHERE pronouns IS NOT NULL)::int AS com_pronomes,
            COUNT(*) FILTER (WHERE jsonb_array_length(preferred_coffee_slots) > 0)::int AS com_horarios,
            COUNT(*) FILTER (WHERE bio IS NOT NULL AND bio <> '')::int AS com_bio,
            COUNT(*) FILTER (WHERE deletion_requested_at IS NOT NULL)::int AS exclusao_pedida,
            COUNT(*) FILTER (WHERE last_seen_at > NOW() - INTERVAL '7 days')::int AS ativas_7d,
            COUNT(*) FILTER (WHERE last_seen_at > NOW() - INTERVAL '30 days')::int AS ativas_30d
       FROM employee WHERE is_active`,
  );
  const porPessoa = await banco.query(
    `SELECT COUNT(*) FILTER (WHERE t.category = 'TECHNICAL')::int AS tecnicas, COUNT(*) FILTER (WHERE t.category = 'HOBBY')::int AS hobbies
       FROM employee e
       LEFT JOIN employee_interest i ON i.employee_id = e.id
       LEFT JOIN interest_tag t ON t.id = i.interest_id
      WHERE e.is_active GROUP BY e.id`,
  );
  const quantidades = porPessoa.map((l) => l.tecnicas + l.hobbies).sort((a, b) => a - b);
  const [fonte] = await banco.query(
    `SELECT COUNT(*) FILTER (WHERE source = 'AI')::int AS ia, COUNT(*) FILTER (WHERE source = 'MANUAL')::int AS manual FROM employee_interest`,
  );
  const unidades = await banco.query(
    `SELECT COALESCE(department, '(sem unidade)') AS nome, COUNT(*)::int AS pessoas FROM employee WHERE is_active GROUP BY 1 ORDER BY 2 DESC, 1`,
  );
  const cidades = await banco.query(
    `SELECT COALESCE(location, '(sem cidade)') AS nome, COUNT(*)::int AS pessoas FROM employee WHERE is_active GROUP BY 1 ORDER BY 2 DESC, 1`,
  );
  const objetivos = await banco.query(
    `SELECT objetivo AS nome, COUNT(*)::int AS pessoas
       FROM employee e, jsonb_array_elements_text(e.connection_goals) AS objetivo WHERE e.is_active GROUP BY 1 ORDER BY 2 DESC, 1`,
  );
  const tags = await banco.query(
    `SELECT t.name AS nome, t.category AS categoria, COUNT(i.employee_id)::int AS pessoas
       FROM interest_tag t LEFT JOIN employee_interest i ON i.interest_id = t.id GROUP BY t.id ORDER BY 3 DESC, 1`,
  );
  const comTag = tags.filter((t) => t.pessoas > 0);
  return {
    pessoas: totais.pessoas,
    ativas_7d: totais.ativas_7d,
    ativas_30d: totais.ativas_30d,
    completude: {
      com_bio: percentual(totais.com_bio, totais.pessoas),
      com_tres_ou_mais_interesses: percentual(quantidades.filter((q) => q >= 3).length, totais.pessoas),
      com_avatar: percentual(totais.com_avatar, totais.pessoas),
      com_pronomes: percentual(totais.com_pronomes, totais.pessoas),
      com_horarios_de_cafe: percentual(totais.com_horarios, totais.pessoas),
    },
    interesses_por_pessoa: {
      media: arredondar(quantidades.reduce((s, q) => s + q, 0) / Math.max(1, quantidades.length)),
      mediana: percentil(quantidades, 0.5),
      minimo: quantidades[0] ?? null,
      maximo: quantidades[quantidades.length - 1] ?? null,
    },
    origem_dos_interesses: { manual: fonte.manual, ia: fonte.ia },
    catalogo: {
      tags_no_catalogo: tags.length,
      tags_em_uso: comTag.length,
      tags_usadas_por_uma_so_pessoa: comTag.filter((t) => t.pessoas === 1).length,
    },
    unidades,
    cidades,
    objetivos,
    tags_mais_usadas: tags.slice(0, 10),
    tags_menos_usadas: comTag.slice(-5).reverse(),
    privacidade: {
      pausadas: totais.pausadas,
      visibilidade_so_unidade: totais.so_unidade,
      exclusao_pedida: totais.exclusao_pedida,
    },
  };
}

// Afinidade medida em uma amostra de pessoas (uma a cada N, determinística) contra todas as outras.
async function indicadoresDeAfinidade(banco, amostra) {
  const base = await carregarBase(banco.query);
  const perfis = [...base.perfis.values()].filter((p) => !p.pausado);
  const passo = Math.max(1, Math.floor(perfis.length / Math.max(1, amostra)));
  const escolhidas = perfis.filter((_, i) => i % passo === 0).slice(0, amostra);
  const faixas = new Array(10).fill(0);
  const melhor = [];
  const vintena = [];
  let pares = 0;
  let zeros = 0;
  let entreUnidades = 0;
  let entreUnidadesNoTop20 = 0;
  let topVinte = 0;
  for (const eu of escolhidas) {
    const pontuados = [];
    for (const outro of perfis) {
      if (outro.id === eu.id) continue;
      const { score } = calcularAfinidade(eu, outro, base.idf);
      pares += 1;
      if (score === 0) zeros += 1;
      else {
        faixas[Math.min(9, Math.floor(score * 10))] += 1;
        pontuados.push({ score, diferente: eu.unidade !== outro.unidade });
      }
    }
    pontuados.sort((a, b) => b.score - a.score);
    if (pontuados.length) {
      melhor.push(pontuados[0].score);
      vintena.push(pontuados[Math.min(19, pontuados.length - 1)].score);
    }
    for (const p of pontuados.slice(0, 20)) {
      topVinte += 1;
      if (p.diferente) entreUnidadesNoTop20 += 1;
    }
    entreUnidades += pontuados.filter((p) => p.diferente).length;
  }
  melhor.sort((a, b) => a - b);
  vintena.sort((a, b) => a - b);
  const comScore = pares - zeros;
  return {
    pessoas_na_amostra: escolhidas.length,
    pares_avaliados: pares,
    pares_sem_nenhum_interesse_em_comum: percentual(zeros, pares),
    histograma_de_pares_com_afinidade: faixas.map((quantidade, i) => ({ faixa: `${i * 10}% a ${i * 10 + 10}%`, pares: quantidade })),
    melhor_sugestao_mediana: arredondar((percentil(melhor, 0.5) ?? 0) * 100),
    vigesima_sugestao_mediana: arredondar((percentil(vintena, 0.5) ?? 0) * 100),
    pares_com_afinidade_entre_unidades_diferentes: percentual(entreUnidades, comScore),
    top20_entre_unidades_diferentes: percentual(entreUnidadesNoTop20, topVinte),
  };
}

async function indicadoresDeConexoes(banco) {
  const status = await banco.query(`SELECT status, COUNT(*)::int AS total FROM connection_match GROUP BY status`);
  const por = Object.fromEntries(status.map((s) => [s.status, s.total]));
  const total = status.reduce((soma, s) => soma + s.total, 0);
  const respondidos = (por.ACCEPTED ?? 0) + (por.DECLINED ?? 0);
  const [tempo] = await banco.query(
    `SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM responded_at - created_at) / 3600) AS mediana_h,
            percentile_cont(0.9) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM responded_at - created_at) / 3600) AS p90_h
       FROM connection_match WHERE responded_at IS NOT NULL`,
  );
  const [pedidos] = await banco.query(
    `SELECT COUNT(DISTINCT requester_id)::int AS quem_enviou, COUNT(DISTINCT receiver_id)::int AS quem_recebeu FROM connection_match`,
  );
  const [scores] = await banco.query(
    `SELECT AVG(match_score) FILTER (WHERE status = 'ACCEPTED') AS aceitas, AVG(match_score) FILTER (WHERE status = 'DECLINED') AS recusadas,
            AVG(match_score) FILTER (WHERE status = 'EXPIRED') AS expiradas FROM connection_match`,
  );
  const [mensagens] = await banco.query(
    `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE body LIKE '[Coffee Chat] Convite para%')::int AS convites,
            COUNT(*) FILTER (WHERE body LIKE '[Coffee Chat] Convite aceito%')::int AS aceites FROM chat_message`,
  );
  const [conversas] = await banco.query(`SELECT COUNT(DISTINCT match_id)::int AS com_mensagem FROM chat_message`);
  const emPercentual = (v) => (numero(v) === null ? null : arredondar(numero(v) * 100));
  return {
    total,
    por_status: { aceitas: por.ACCEPTED ?? 0, pendentes: por.PENDING ?? 0, recusadas: por.DECLINED ?? 0, expiradas: por.EXPIRED ?? 0 },
    taxa_de_aceite_entre_respondidos: percentual(por.ACCEPTED ?? 0, respondidos),
    taxa_de_aceite_geral: percentual(por.ACCEPTED ?? 0, total),
    tempo_de_resposta_horas: { mediana: arredondar(numero(tempo.mediana_h)), p90: arredondar(numero(tempo.p90_h)) },
    pessoas_que_enviaram: pedidos.quem_enviou,
    pessoas_que_receberam: pedidos.quem_recebeu,
    afinidade_media_por_desfecho: {
      aceitas: emPercentual(scores.aceitas),
      recusadas: emPercentual(scores.recusadas),
      expiradas: emPercentual(scores.expiradas),
    },
    mensagens: {
      total: mensagens.total,
      por_conexao_aceita: arredondar(mensagens.total / Math.max(1, por.ACCEPTED ?? 0)),
      conexoes_aceitas_com_conversa: percentual(conversas.com_mensagem, por.ACCEPTED ?? 0),
      convites_de_coffee_chat: mensagens.convites,
      convites_aceitos: mensagens.aceites,
    },
  };
}

async function indicadoresDeModeracao(banco) {
  const [m] = await banco.query(
    `SELECT (SELECT COUNT(*)::int FROM employee_block) AS bloqueios, (SELECT COUNT(*)::int FROM employee_report) AS denuncias`,
  );
  return m;
}

// Retrato do uso de IA. Vem só de `ai_interaction_log`, que guarda tipo, versão, modelo, status e latência.
// Se a base nunca chamou a IA, as listas ficam vazias: o relatório mostra isso em vez de inventar números.
async function indicadoresDeIa(banco) {
  const grupos = await banco.query(
    `SELECT prompt_type AS tipo, prompt_version AS versao, COALESCE(model, '(sem modelo)') AS modelo, status, COUNT(*)::int AS chamadas,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms) AS p50_ms, percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_ms
       FROM ai_interaction_log GROUP BY 1, 2, 3, 4 ORDER BY 1, 2, 3, 4`,
  );
  const [total] = await banco.query(
    `SELECT COUNT(*)::int AS chamadas, COUNT(*) FILTER (WHERE status = 'SUCCESS')::int AS sucesso FROM ai_interaction_log`,
  );
  return {
    chamadas: total.chamadas,
    taxa_de_sucesso: total.chamadas ? percentual(total.sucesso, total.chamadas) : null,
    grupos: grupos.map((g) => ({ ...g, p50_ms: arredondar(numero(g.p50_ms), 0), p95_ms: arredondar(numero(g.p95_ms), 0) })),
  };
}

const TABELAS = [
  'employee',
  'interest_tag',
  'employee_interest',
  'connection_match',
  'chat_message',
  'employee_block',
  'employee_report',
  'ai_interaction_log',
];

async function indicadoresDoBanco(banco) {
  const linhas = {};
  for (const tabela of TABELAS) linhas[tabela] = (await banco.query(`SELECT COUNT(*)::int AS n FROM ${tabela}`))[0].n;
  return { tipo: banco.tipo, linhas };
}

export async function coletarIndicadores(banco, { amostra = 200, agora = new Date() } = {}) {
  return {
    gerado_em: agora.toISOString(),
    banco: await indicadoresDoBanco(banco),
    base: await indicadoresDaBase(banco),
    afinidade: await indicadoresDeAfinidade(banco, amostra),
    conexoes: await indicadoresDeConexoes(banco),
    moderacao: await indicadoresDeModeracao(banco),
    ia: await indicadoresDeIa(banco),
  };
}

const tabela = (cabecalho, linhas) =>
  [`| ${cabecalho.join(' | ')} |`, `| ${cabecalho.map(() => '---').join(' | ')} |`, ...linhas.map((l) => `| ${l.join(' | ')} |`)].join(
    '\n',
  );
const pct = (v) => (v === null || v === undefined ? 'n/d' : `${String(v).replace('.', ',')}%`);
const dec = (v) => (v === null || v === undefined ? 'n/d' : String(v).replace('.', ','));
const categoria = (c) => (c === 'TECHNICAL' ? 'Técnica' : 'Hobby');

export function formatarMarkdown(r, desempenho = null) {
  const b = r.base;
  const a = r.afinidade;
  const c = r.conexoes;
  const partes = [];
  partes.push(
    `# Indicadores do MatchNade\n\nGerado em ${r.gerado_em} sobre um banco ${r.banco.tipo}. Só contagens, proporções e tempos, sem dado pessoal.`,
  );

  partes.push(
    `## Base de pessoas\n\n${b.pessoas} pessoas ativas (${b.ativas_7d} vistas nos últimos 7 dias, ${b.ativas_30d} nos últimos 30).\n\n` +
      tabela(
        ['Cadastro', 'Pessoas'],
        [
          ['Com bio', pct(b.completude.com_bio)],
          ['Com 3 ou mais interesses', pct(b.completude.com_tres_ou_mais_interesses)],
          ['Com avatar', pct(b.completude.com_avatar)],
          ['Com pronomes', pct(b.completude.com_pronomes)],
          ['Com horários de café', pct(b.completude.com_horarios_de_cafe)],
        ],
      ) +
      `\n\nInteresses por pessoa: média ${dec(b.interesses_por_pessoa.media)}, mediana ${b.interesses_por_pessoa.mediana}, de ${b.interesses_por_pessoa.minimo} a ${b.interesses_por_pessoa.maximo}. ` +
      `Origem: ${b.origem_dos_interesses.manual} marcados à mão e ${b.origem_dos_interesses.ia} sugeridos pela IA.`,
  );

  partes.push(
    `## Catálogo de interesses\n\n${b.catalogo.tags_em_uso} de ${b.catalogo.tags_no_catalogo} tags estão em uso; ${b.catalogo.tags_usadas_por_uma_so_pessoa} aparecem em uma pessoa só.\n\n` +
      '**Mais usadas**\n\n' +
      tabela(
        ['Tag', 'Categoria', 'Pessoas'],
        b.tags_mais_usadas.map((t) => [t.nome, categoria(t.categoria), t.pessoas]),
      ) +
      '\n\n**Menos usadas (em uso)**\n\n' +
      tabela(
        ['Tag', 'Categoria', 'Pessoas'],
        b.tags_menos_usadas.map((t) => [t.nome, categoria(t.categoria), t.pessoas]),
      ),
  );

  const distribuicao = (lista) => lista.map((u) => [u.nome, u.pessoas, pct(percentual(u.pessoas, b.pessoas))]);
  partes.push(
    `## Distribuição\n\n**Unidades**\n\n${tabela(['Unidade', 'Pessoas', '%'], distribuicao(b.unidades))}\n\n` +
      `**Cidades**\n\n${tabela(['Cidade', 'Pessoas', '%'], distribuicao(b.cidades))}\n\n` +
      `**Objetivos de conexão** (uma pessoa pode ter mais de um)\n\n${tabela(
        ['Objetivo', 'Pessoas'],
        b.objetivos.map((o) => [o.nome, o.pessoas]),
      )}`,
  );

  partes.push(
    `## Afinidade\n\nMedida em ${a.pessoas_na_amostra} pessoas contra todas as outras (${a.pares_avaliados} pares), com a fórmula de produção (Jaccard ponderado por raridade, por eixo).\n\n` +
      tabela(
        ['Indicador', 'Valor'],
        [
          ['Pares sem nenhum interesse em comum', pct(a.pares_sem_nenhum_interesse_em_comum)],
          ['Afinidade da melhor sugestão (mediana)', pct(a.melhor_sugestao_mediana)],
          ['Afinidade da 20ª sugestão (mediana)', pct(a.vigesima_sugestao_mediana)],
          ['Pares com afinidade entre unidades diferentes', pct(a.pares_com_afinidade_entre_unidades_diferentes)],
          ['Top 20 que cruza unidades', pct(a.top20_entre_unidades_diferentes)],
        ],
      ) +
      `\n\n**Pares com afinidade, por faixa**\n\n${tabela(
        ['Faixa', 'Pares'],
        a.histograma_de_pares_com_afinidade.map((f) => [f.faixa, f.pares]),
      )}`,
  );

  partes.push(
    `## Conexões\n\n${c.total} pedidos: ${c.por_status.aceitas} aceitos, ${c.por_status.pendentes} pendentes, ${c.por_status.recusadas} recusados, ${c.por_status.expiradas} expirados.\n\n` +
      tabela(
        ['Indicador', 'Valor'],
        [
          ['Taxa de aceite entre quem respondeu', pct(c.taxa_de_aceite_entre_respondidos)],
          ['Taxa de aceite sobre todos os pedidos', pct(c.taxa_de_aceite_geral)],
          ['Tempo de resposta (mediana, horas)', dec(c.tempo_de_resposta_horas.mediana)],
          ['Tempo de resposta (p90, horas)', dec(c.tempo_de_resposta_horas.p90)],
          ['Pessoas que enviaram pedido', c.pessoas_que_enviaram],
          ['Pessoas que receberam pedido', c.pessoas_que_receberam],
          ['Afinidade média das aceitas', pct(c.afinidade_media_por_desfecho.aceitas)],
          ['Afinidade média das recusadas', pct(c.afinidade_media_por_desfecho.recusadas)],
          ['Afinidade média das expiradas', pct(c.afinidade_media_por_desfecho.expiradas)],
          ['Mensagens por conexão aceita', dec(c.mensagens.por_conexao_aceita)],
          ['Conexões aceitas com conversa', pct(c.mensagens.conexoes_aceitas_com_conversa)],
          ['Convites de Coffee Chat / aceitos', `${c.mensagens.convites_de_coffee_chat} / ${c.mensagens.convites_aceitos}`],
        ],
      ),
  );

  partes.push(
    `## Privacidade e moderação\n\n` +
      tabela(
        ['Indicador', 'Valor'],
        [
          ['Contas pausadas', b.privacidade.pausadas],
          ['Perfis visíveis só para a própria unidade', b.privacidade.visibilidade_so_unidade],
          ['Exclusões de conta pedidas (em prazo)', b.privacidade.exclusao_pedida],
          ['Bloqueios', r.moderacao.bloqueios],
          ['Denúncias', r.moderacao.denuncias],
        ],
      ),
  );

  partes.push(
    `## IA\n\n` +
      (r.ia.chamadas === 0
        ? 'Nenhuma chamada registrada em `ai_interaction_log` neste banco. Os números de IA só aparecem aqui quando a IA foi de fato usada.'
        : `${r.ia.chamadas} chamadas registradas, ${pct(r.ia.taxa_de_sucesso)} com sucesso.\n\n` +
          tabela(
            ['Tipo', 'Versão', 'Modelo', 'Status', 'Chamadas', 'p50 (ms)', 'p95 (ms)'],
            r.ia.grupos.map((g) => [g.tipo, g.versao, g.modelo, g.status, g.chamadas, g.p50_ms, g.p95_ms]),
          )),
  );

  partes.push(`## Tamanho do banco\n\n${tabela(['Tabela', 'Linhas'], Object.entries(r.banco.linhas))}`);

  if (desempenho?.length) {
    partes.push(
      `## Desempenho das rotas\n\nMedido no próprio processo, sem rede, ${desempenho[0].repeticoes} repetições após uma de aquecimento.\n\n` +
        tabela(
          ['Rota', 'Mediana (ms)', 'p90 (ms)'],
          desempenho.map((d) => [d.rota, dec(d.mediana_ms), dec(d.p90_ms)]),
        ),
    );
  }
  return `${partes.join('\n\n')}\n`;
}
