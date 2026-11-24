import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { provedorEmbeddingsGemini } from '../src/ai/provedores.js';
import { carregarConfig } from '../src/config/env.js';
import { avaliarPares, varreduraDeLimiar } from './avaliar-semantica.js';

// Mede o score semântico com vetores reais do Gemini contra o gabarito de pares-tags.json e mostra a
// precisão e a cobertura por limiar. Precisa de GEMINI_API_KEY; sem a chave não há o que medir. Só nomes de tag
// vão ao provedor e a chave nunca é impressa.
const config = carregarConfig({ ...process.env, NODE_ENV: 'test' });
if (!config.ia.geminiKey) {
  console.error('Defina GEMINI_API_KEY para medir com vetores reais (sem a chave não há o que medir).');
  process.exit(1);
}

const { pares } = JSON.parse(await readFile(new URL('./pares-tags.json', import.meta.url), 'utf8'));
const nomes = [...new Set(pares.flatMap((p) => [p.a, p.b]))];
const provedor = provedorEmbeddingsGemini({ chave: config.ia.geminiKey, modelo: config.semantica.modelo });
const vetores = new Map();
try {
  const lista = await provedor.gerar(nomes);
  nomes.forEach((nome, i) => vetores.set(nome, lista[i]));
} catch (erro) {
  console.error(`Falha ao gerar os vetores: ${erro.message}`);
  process.exit(1);
}

const pct = (v) => (v === null ? '-' : `${(v * 100).toFixed(0)}%`);
console.log(`Modelo: ${provedor.modelo}. Pares avaliados: ${pares.length} (${nomes.length} tags).`);
console.log('limiar  precisão  cobertura  acerto');
for (const l of varreduraDeLimiar(pares, vetores, [0.5, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9])) {
  console.log(`${l.limiar.toFixed(2)}    ${pct(l.precisao).padStart(7)}  ${pct(l.cobertura).padStart(9)}  ${pct(l.acerto).padStart(6)}`);
}
const atual = avaliarPares(pares, vetores, config.semantica.limiar);
console.log(`\nNo limiar configurado (${config.semantica.limiar}): precisão ${pct(atual.precisao)}, cobertura ${pct(atual.cobertura)}.`);
if (atual.falsosPositivos) console.log('Atenção: há falsos positivos neste limiar; suba o SEMANTIC_THRESHOLD antes de ligar.');
