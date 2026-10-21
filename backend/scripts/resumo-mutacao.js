import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Resume o relatório JSON do Stryker (reports/mutacao/relatorio.json) por arquivo, separando os
// mutantes mortos por um teste dos que só estouraram o tempo. O Stryker conta Timeout como
// detectado; a coluna "sem timeouts" conta esses mutantes como não detectados, o pior caso.
// Caminho opcional como argumento, relativo à pasta atual.
const caminho = resolve(process.argv[2] ?? 'reports/mutacao/relatorio.json');

let relatorio;
try {
  relatorio = JSON.parse(await readFile(caminho, 'utf8'));
} catch {
  console.error(`Relatório não encontrado em ${caminho}. Rode antes: npm run mutacao`);
  process.exit(1);
}

const pct = (parte, total) =>
  total
    ? new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(parte / total)
    : 'n/a';

// Erros de compilação e de execução e mutantes ignorados ficam fora da conta, como no Stryker.
function contar(mutantes) {
  const c = { Killed: 0, Timeout: 0, Survived: 0, NoCoverage: 0 };
  for (const { status } of mutantes) if (status in c) c[status] += 1;
  const validos = c.Killed + c.Timeout + c.Survived + c.NoCoverage;
  return { ...c, validos, pontuacao: pct(c.Killed + c.Timeout, validos), semTimeouts: pct(c.Killed, validos) };
}

const linhas = Object.entries(relatorio.files)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([arquivo, { mutants }]) => ({ arquivo, ...contar(mutants) }));
const total = { arquivo: 'Total', ...contar(Object.values(relatorio.files).flatMap((f) => f.mutants)) };

console.log('| Arquivo | Pontuação | Sem timeouts | Mortos | Timeout | Sobreviventes | Sem cobertura |');
console.log('|---|---|---|---|---|---|---|');
for (const l of [...linhas, total]) {
  console.log(`| ${l.arquivo} | ${l.pontuacao} | ${l.semTimeouts} | ${l.Killed} | ${l.Timeout} | ${l.Survived} | ${l.NoCoverage} |`);
}
