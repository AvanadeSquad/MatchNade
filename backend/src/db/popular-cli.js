import { carregarConfig } from '../config/env.js';
import { criarBanco } from './index.js';
import { popularBanco } from './populacao.js';

// Uso: npm run popular -- --perfis 1000 [--semente 2026] [--sem-historico]
const args = process.argv.slice(2);
const valor = (nome, padrao) => {
  const i = args.indexOf(`--${nome}`);
  return i >= 0 ? args[i + 1] : padrao;
};

const config = carregarConfig();
if (config.producao) {
  console.error('A população fictícia é proibida em produção.');
  process.exit(1);
}
const banco = await criarBanco({ databaseUrl: config.databaseUrl, dataDir: config.pglite.dataDir });
try {
  const inicio = Date.now();
  const resumo = await popularBanco(banco, {
    total: Number(valor('perfis', 500)),
    semente: Number(valor('semente', 2026)),
    historico: !args.includes('--sem-historico'),
  });
  console.log(JSON.stringify({ ...resumo, segundos: Number(((Date.now() - inicio) / 1000).toFixed(1)) }, null, 2));
} catch (erro) {
  console.error(erro.message);
  process.exitCode = 1;
} finally {
  await banco.close();
}
