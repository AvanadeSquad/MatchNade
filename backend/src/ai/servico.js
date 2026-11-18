import { limparTexto, mencionaDadoSensivel, mencionaHierarquia, normalizarTag, unicas } from '../utils/tags.js';
import { criarProvedores } from './provedores.js';
import { EXTRACAO, QUEBRA_GELO, blocoCatalogo } from './prompts.js';
import { Disjuntor, executarComResiliencia } from './resiliencia.js';

const MAX_TAGS_POR_EIXO = 12;
const MAX_BIO = 1000;
const MAX_CATALOGO = 150;

// Chave de comparação de tags: sem acento, sem maiúsculas e sem espaços ou pontuação
// ("Node JS" e "Node.js" viram "nodejs"; "violao" e "Violão" viram "violao"). Mantém # e +.
const chaveTag = (tag) =>
  String(tag)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}#+]/gu, '');

const semAcento = (texto) => String(texto).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

// Troca cada tag devolvida pela IA pela grafia e pela categoria do catálogo, quando ela já existe,
// e tira repetições entre as duas listas. Sem isso, "corrida" e "Corrida" virariam tags diferentes
// e as duas pessoas deixariam de aparecer como afins.
export function ajustarAoCatalogo(tecnicas, hobbies, catalogo) {
  const indice = new Map(catalogo.map((tag) => [chaveTag(tag.name), tag]));
  const saida = { TECHNICAL: [], HOBBY: [] };
  const vistas = new Set();
  for (const [categoria, lista] of [
    ['TECHNICAL', tecnicas],
    ['HOBBY', hobbies],
  ]) {
    for (const tag of lista) {
      const oficial = indice.get(chaveTag(tag));
      const nome = oficial?.name ?? tag;
      const destino = saida[oficial?.category] ? oficial.category : categoria;
      if (vistas.has(chaveTag(nome))) continue;
      vistas.add(chaveTag(nome));
      saida[destino].push(nome);
    }
  }
  return { technical_tags: saida.TECHNICAL, hobby_tags: saida.HOBBY };
}

function interpretarJson(texto) {
  try {
    const dados = JSON.parse(texto);
    return dados && typeof dados === 'object' ? dados : null;
  } catch {
    return null;
  }
}

function tagsValidas(lista) {
  if (!Array.isArray(lista)) return [];
  const normalizadas = lista
    .filter((item) => typeof item === 'string')
    .map(normalizarTag)
    .filter((tag) => tag && !mencionaDadoSensivel(tag));
  return unicas(normalizadas).slice(0, MAX_TAGS_POR_EIXO);
}

// Serviço de IA: extração de tags da bio e quebra-gelo do match. Nunca lança por falha
// de IA; devolve `fallback: true` para a tela seguir pelo caminho manual ou pelo texto padrão.
export function criarServicoIa({ config, banco, provedores = criarProvedores(config.ia) }) {
  const disjuntores = new Map(
    provedores.map((p) => [p.nome, new Disjuntor({ limite: config.ia.breakerFalhas, janelaMs: config.ia.breakerJanelaMs })]),
  );

  async function registrar(employeeId, prompt, { modelo, status, payload, latenciaMs }) {
    try {
      await banco.query(
        `INSERT INTO ai_interaction_log (employee_id, prompt_type, prompt_version, model, status, response_payload, latency_ms)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
        [employeeId, prompt.tipo, prompt.versao, modelo ?? null, status, payload ? JSON.stringify(payload) : null, latenciaMs ?? null],
      );
    } catch {
      // O registro é auxiliar: falhar ao gravar não pode derrubar a requisição.
    }
  }

  // Tags mais usadas do aplicativo, para a IA reaproveitar a grafia. Falhar aqui não impede a extração.
  async function carregarCatalogo() {
    try {
      const linhas = await banco.query(
        `SELECT t.name, t.category, COUNT(ei.employee_id)::int AS uso
           FROM interest_tag t
           LEFT JOIN employee_interest ei ON ei.interest_id = t.id
          GROUP BY t.id
          ORDER BY uso DESC, t.name
          LIMIT $1`,
        [MAX_CATALOGO],
      );
      return Array.isArray(linhas) ? linhas.filter((tag) => typeof tag?.name === 'string') : [];
    } catch {
      return [];
    }
  }

  async function chamar(prompt, usuario, sistema = prompt.sistema) {
    return executarComResiliencia({
      provedores,
      disjuntores,
      config: config.ia,
      requisicao: {
        sistema,
        usuario,
        temperatura: prompt.temperatura,
        maxTokens: prompt.maxTokens,
        schema: prompt.schema,
      },
    });
  }

  return {
    habilitada: provedores.length > 0,

    async extrairTags(employeeId, bio) {
      let limpa = limparTexto(bio).slice(0, MAX_BIO);
      // Remove as marcas até estabilizar, para </b</bio>io> não reconstruir uma marca válida.
      for (let anterior = ''; anterior !== limpa;) {
        anterior = limpa;
        limpa = limpa.replace(/<\/?bio>/gi, '');
      }
      const vazio = { technical_tags: [], hobby_tags: [], fallback: true };
      if (!provedores.length) return vazio;

      const inicio = Date.now();
      try {
        const catalogo = await carregarCatalogo();
        const resposta = await chamar(EXTRACAO, `<bio>${limpa}</bio>`, EXTRACAO.sistema + blocoCatalogo(catalogo));
        const dados = interpretarJson(resposta.texto);
        if (!dados || !Array.isArray(dados.technical_tags) || !Array.isArray(dados.hobby_tags)) {
          await registrar(employeeId, EXTRACAO, { modelo: resposta.modelo, status: 'FORA_DO_SCHEMA', latenciaMs: resposta.latenciaMs });
          return vazio;
        }
        const resultado = {
          ...ajustarAoCatalogo(tagsValidas(dados.technical_tags), tagsValidas(dados.hobby_tags), catalogo),
          fallback: false,
        };
        await registrar(employeeId, EXTRACAO, {
          modelo: resposta.modelo,
          status: 'OK',
          payload: resultado,
          latenciaMs: resposta.latenciaMs,
        });
        return resultado;
      } catch {
        await registrar(employeeId, EXTRACAO, { status: 'ERRO', latenciaMs: Date.now() - inicio });
        return vazio;
      }
    },

    // tagsComuns: nomes dos interesses presentes nos dois perfis. Só eles vão para o provedor:
    // a frase não pode citar interesse de uma pessoa só, e menos dado sai do sistema.
    async gerarQuebraGelo(employeeId, _tagsA, _tagsB, tagsComuns) {
      const padrao = { match_summary: QUEBRA_GELO.textoPadrao, fallback: true };
      if (!provedores.length || !tagsComuns.length) return padrao;

      const inicio = Date.now();
      try {
        const usuario = `<interesses_em_comum>${JSON.stringify(tagsComuns)}</interesses_em_comum>`;
        const resposta = await chamar(QUEBRA_GELO, usuario);
        const dados = interpretarJson(resposta.texto);
        const frase = typeof dados?.match_summary === 'string' ? limparTexto(dados.match_summary) : '';
        // Compara sem acento e sem maiúsculas: "fotografia" cita a tag "Fotografia".
        const cita = tagsComuns.some((tag) => semAcento(frase).includes(semAcento(tag)));
        const aceita =
          frase.length > 0 &&
          frase.length <= QUEBRA_GELO.limiteCaracteres &&
          !mencionaHierarquia(frase) &&
          !mencionaDadoSensivel(frase) &&
          cita;
        if (!aceita) {
          await registrar(employeeId, QUEBRA_GELO, { modelo: resposta.modelo, status: 'REJEITADO', latenciaMs: resposta.latenciaMs });
          return padrao;
        }
        await registrar(employeeId, QUEBRA_GELO, {
          modelo: resposta.modelo,
          status: 'OK',
          payload: { match_summary: frase },
          latenciaMs: resposta.latenciaMs,
        });
        return { match_summary: frase, fallback: false };
      } catch {
        await registrar(employeeId, QUEBRA_GELO, { status: 'ERRO', latenciaMs: Date.now() - inicio });
        return padrao;
      }
    },
  };
}
