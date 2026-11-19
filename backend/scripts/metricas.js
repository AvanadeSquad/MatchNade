import { writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { carregarConfig } from '../src/config/env.js';
import { criarBanco } from '../src/db/index.js';
import { coletarIndicadores, formatarMarkdown } from '../src/relatorios/indicadores.js';
import { listarConexoes } from '../src/services/conexoes.js';
import { perfilDaPessoa } from '../src/services/pessoas.js';
import { recomendar } from '../src/services/recomendacoes.js';

// Uso: npm run metricas -- [--saida arquivo.md] [--json] [--amostra 200] [--desempenho]
// Lê o banco de DATABASE_URL (ou PGLITE_DATA_DIR) e imprime os indicadores. Não escreve no banco.
const args = process.argv.slice(2);
const valor = (nome, padrao) => {
  const i = args.indexOf(`--${nome}`);
  return i >= 0 ? args[i + 1] : padrao;
};

const config = carregarConfig();
const banco = await criarBanco({ databaseUrl: config.databaseUrl, dataDir: config.pglite.dataDir });

async function medir(rota, fn, repeticoes = 20) {
  await fn();
  const tempos = [];
  for (let i = 0; i < repeticoes; i += 1) {
    const inicio = performance.now();
    await fn();
    tempos.push(performance.now() - inicio);
  }
  tempos.sort((a, b) => a - b);
  return {
    rota,
    repeticoes,
    mediana_ms: Number(tempos[Math.floor(tempos.length / 2)].toFixed(1)),
    p90_ms: Number(tempos[Math.floor(tempos.length * 0.9)].toFixed(1)),
  };
}

try {
  const indicadores = await coletarIndicadores(banco, { amostra: Number(valor('amostra', 200)) });
  let desempenho = null;
  if (args.includes('--desempenho')) {
    const [alvo] = await banco.query('SELECT id FROM employee WHERE max_weekly_matches >= 3 ORDER BY id LIMIT 1');
    const [outro] = await banco.query('SELECT id FROM employee WHERE id <> $1 ORDER BY id DESC LIMIT 1', [alvo.id]);
    const ctx = { banco, config };
    desempenho = [
      await medir('GET /matches/recommendations', () => recomendar(ctx, alvo.id, 20)),
      await medir('GET /matches (lista de conexões)', () => listarConexoes(ctx, alvo.id, { marcarVisto: false })),
      await medir('GET /employees/:id', () => perfilDaPessoa(ctx, alvo.id, outro.id)),
    ];
  }
  const texto = args.includes('--json')
    ? `${JSON.stringify({ ...indicadores, desempenho }, null, 2)}\n`
    : formatarMarkdown(indicadores, desempenho);
  const saida = valor('saida', '');
  if (saida) await writeFile(saida, texto, 'utf8');
  else process.stdout.write(texto);
} finally {
  await banco.close();
}
