import { readFile } from 'node:fs/promises';
import { criarServicoIa } from '../src/ai/servico.js';
import { mencionaHierarquia } from '../src/utils/tags.js';

const caminhoBios = new URL('./bios.json', import.meta.url);

// Termos de cargo procurados nas tags devolvidas, além dos que mencionaHierarquia já reconhece.
const CARGOS_EXTRAS = ['ceo', 'diretor', 'gerente', 'tech lead', 'principal engineer'];

const chave = (tag) => tag.toLowerCase();

export const carregarBios = async () => JSON.parse(await readFile(caminhoBios, 'utf8'));

function citaCargo(tag) {
  return mencionaHierarquia(tag) || CARGOS_EXTRAS.includes(chave(tag));
}

// Roda a extração de tags em cada bio e calcula precisão, cobertura e respostas com cargo.
// Precisão: tags devolvidas que eram esperadas. Cobertura: tags esperadas que foram devolvidas.
// As duas são calculadas sobre o total de tags (micro), comparando sem diferenciar maiúsculas.
export async function avaliar({ config, provedores, bios }) {
  const banco = { query: async () => [] };
  const ia = criarServicoIa({ config, banco, provedores });
  let devolvidas = 0;
  let esperadas = 0;
  let acertos = 0;
  let falhas = 0;
  const comCargo = [];
  const comInjecao = [];
  const porBio = [];

  for (const item of bios) {
    const resposta = await ia.extrairTags(null, item.bio);
    const obtidas = [...resposta.technical_tags, ...resposta.hobby_tags];
    const alvo = new Set([...item.technical, ...item.hobby].map(chave));
    const certas = obtidas.filter((tag) => alvo.has(chave(tag)));
    devolvidas += obtidas.length;
    esperadas += alvo.size;
    acertos += certas.length;
    if (resposta.fallback && item.bio) falhas += 1;
    const cargos = obtidas.filter(citaCargo);
    if (cargos.length) comCargo.push({ id: item.id, cargos });
    const proibidas = new Set((item.proibidas ?? []).map(chave));
    const injetadas = obtidas.filter((tag) => proibidas.has(chave(tag)));
    if (injetadas.length) comInjecao.push({ id: item.id, tags: injetadas });
    porBio.push({ id: item.id, tipo: item.tipo, obtidas, faltaram: [...alvo].filter((t) => !obtidas.some((o) => chave(o) === t)) });
  }

  return {
    bios: bios.length,
    precisao: devolvidas ? acertos / devolvidas : 1,
    cobertura: esperadas ? acertos / esperadas : 1,
    respostasComCargo: comCargo.length,
    comCargo,
    respostasComInjecao: comInjecao.length,
    comInjecao,
    fallbacks: falhas,
    porBio,
  };
}
