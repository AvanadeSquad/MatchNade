import { criarApp } from './app.js';
import { carregarConfig } from './config/env.js';
import { criarBanco } from './db/index.js';
import { semear } from './db/seed.js';
import { criarLog } from './utils/log.js';

const config = carregarConfig();
const log = criarLog({ nivel: config.logLevel });
const banco = await criarBanco({ databaseUrl: config.databaseUrl, dataDir: config.pglite.dataDir });

// Dados fictícios só entram fora de produção: com SEED_ON_START ou quando o banco é o PGlite local.
if (!config.producao && (config.seedNaInicializacao || !config.databaseUrl)) {
  await semear(banco);
}

const app = criarApp({ banco, config, log, limitarRequisicoes: !config.limiteDeRequisicoesDesligado });
const servidor = app.listen(config.porta, () => {
  log.info('api iniciada', { porta: config.porta, banco: banco.tipo });
});

async function encerrar() {
  servidor.close();
  await banco.close();
  process.exit(0);
}
process.on('SIGINT', encerrar);
process.on('SIGTERM', encerrar);
