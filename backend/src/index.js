import { criarApp } from './app.js';
import { carregarConfig } from './config/env.js';
import { criarBanco } from './db/index.js';
import { semear } from './db/seed.js';

const config = carregarConfig();
const banco = await criarBanco({ databaseUrl: config.databaseUrl, dataDir: config.pglite.dataDir });

// Dados fictícios só entram fora de produção: com SEED_ON_START ou quando o banco é o PGlite local.
if (!config.producao && (config.seedNaInicializacao || !config.databaseUrl)) {
  await semear(banco);
}

const app = criarApp({ banco, config, limitarRequisicoes: !config.limiteDeRequisicoesDesligado });
const servidor = app.listen(config.porta, () => {
  console.log(`API em http://localhost:${config.porta}/api/v1 (banco: ${banco.tipo})`);
});

async function encerrar() {
  servidor.close();
  await banco.close();
  process.exit(0);
}
process.on('SIGINT', encerrar);
process.on('SIGTERM', encerrar);
