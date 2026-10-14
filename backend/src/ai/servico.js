import { limparTexto, mencionaHierarquia, normalizarTag, unicas } from '../utils/tags.js';
import { criarProvedores } from './provedores.js';
import { EXTRACAO, QUEBRA_GELO } from './prompts.js';
import { Disjuntor, executarComResiliencia } from './resiliencia.js';

const MAX_TAGS_POR_EIXO = 12;
const MAX_BIO = 1000;

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
    .filter(Boolean);
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

  async function chamar(prompt, usuario) {
    return executarComResiliencia({
      provedores,
      disjuntores,
      config: config.ia,
      requisicao: {
        sistema: prompt.sistema,
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
      for (let anterior = ''; anterior !== limpa; ) {
        anterior = limpa;
        limpa = limpa.replace(/<\/?bio>/gi, '');
      }
      const vazio = { technical_tags: [], hobby_tags: [], fallback: true };
      if (!provedores.length) return vazio;

      const inicio = Date.now();
      try {
        const resposta = await chamar(EXTRACAO, `<bio>${limpa}</bio>`);
        const dados = interpretarJson(resposta.texto);
        if (!dados || !Array.isArray(dados.technical_tags) || !Array.isArray(dados.hobby_tags)) {
          await registrar(employeeId, EXTRACAO, { modelo: resposta.modelo, status: 'FORA_DO_SCHEMA', latenciaMs: resposta.latenciaMs });
          return vazio;
        }
        const resultado = {
          technical_tags: tagsValidas(dados.technical_tags),
          hobby_tags: tagsValidas(dados.hobby_tags),
          fallback: false,
        };
        await registrar(employeeId, EXTRACAO, { modelo: resposta.modelo, status: 'OK', payload: resultado, latenciaMs: resposta.latenciaMs });
        return resultado;
      } catch {
        await registrar(employeeId, EXTRACAO, { status: 'ERRO', latenciaMs: Date.now() - inicio });
        return vazio;
      }
    },

    // tagsComuns: nomes dos interesses presentes nos dois perfis.
    async gerarQuebraGelo(employeeId, tagsA, tagsB, tagsComuns) {
      const padrao = { match_summary: QUEBRA_GELO.textoPadrao, fallback: true };
      if (!provedores.length || !tagsComuns.length) return padrao;

      const inicio = Date.now();
      try {
        const usuario = `Usuário A: ${JSON.stringify(tagsA)}\nUsuário B: ${JSON.stringify(tagsB)}`;
        const resposta = await chamar(QUEBRA_GELO, usuario);
        const dados = interpretarJson(resposta.texto);
        const frase = typeof dados?.match_summary === 'string' ? limparTexto(dados.match_summary) : '';
        const cita = tagsComuns.some((tag) => frase.toLowerCase().includes(tag.toLowerCase()));
        const aceita = frase.length > 0 && frase.length <= QUEBRA_GELO.limiteCaracteres && !mencionaHierarquia(frase) && cita;
        if (!aceita) {
          await registrar(employeeId, QUEBRA_GELO, { modelo: resposta.modelo, status: 'REJEITADO', latenciaMs: resposta.latenciaMs });
          return padrao;
        }
        await registrar(employeeId, QUEBRA_GELO, { modelo: resposta.modelo, status: 'OK', payload: { match_summary: frase }, latenciaMs: resposta.latenciaMs });
        return { match_summary: frase, fallback: false };
      } catch {
        await registrar(employeeId, QUEBRA_GELO, { status: 'ERRO', latenciaMs: Date.now() - inicio });
        return padrao;
      }
    },
  };
}
