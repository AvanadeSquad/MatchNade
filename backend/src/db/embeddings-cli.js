import { provedorEmbeddingsGemini } from '../ai/provedores.js';
import { carregarConfig } from '../config/env.js';
import { carregarVetores, recalcularSimilaridades } from '../services/semantica-carga.js';
import { criarBanco } from './index.js';

// Uso: npm run embeddings
// Gera o vetor das tags que ainda não têm (só o nome da tag vai ao Gemini) e recalcula a tabela de pares
// acima de SEMANTIC_THRESHOLD. Pode ser repetido: só as tags sem vetor chamam o provedor. Para a conta da
// afinidade passar a usar os pares, ligue SEMANTIC_AFFINITY_ENABLED=true depois de medir (npm run avaliar-semantica).
const config = carregarConfig();
if (!config.ia.geminiKey) {
  console.error('Defina GEMINI_API_KEY para gerar os vetores das tags.');
  process.exit(1);
}
const banco = await criarBanco({ databaseUrl: config.databaseUrl, dataDir: config.pglite.dataDir });
try {
  const provedor = provedorEmbeddingsGemini({ chave: config.ia.geminiKey, modelo: config.semantica.modelo });
  const vetores = await carregarVetores({ banco, provedor });
  const { pares } = await recalcularSimilaridades({ banco, limiar: config.semantica.limiar });
  console.log(JSON.stringify({ modelo: provedor.modelo, ...vetores, pares, limiar: config.semantica.limiar }, null, 2));
  if (vetores.restantes) console.log('Algumas tags ficaram sem vetor (o provedor falhou); rode de novo. Elas valem só pelo score exato.');
} catch (erro) {
  console.error(erro.message);
  process.exitCode = 1;
} finally {
  await banco.close();
}
