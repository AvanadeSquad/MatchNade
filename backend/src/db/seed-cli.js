import { carregarConfig } from '../config/env.js';
import { criarBanco } from './index.js';
import { semear } from './seed.js';

const config = carregarConfig();
const banco = await criarBanco({ databaseUrl: config.databaseUrl, dataDir: config.pglite.dataDir });
const inseriu = await semear(banco, { demonstracao: !config.producao });
console.log(inseriu ? 'Dados de exemplo criados.' : 'O banco já tem dados; nada foi alterado.');
await banco.close();
