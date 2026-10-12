// Teste de mutação: o Stryker altera o código (troca operadores, condições e valores) e confere
// se algum teste falha. Mutante que sobrevive aponta comportamento que os testes não verificam.
// É lento (roda a suíte para cada mutante), por isso não roda no CI. Rode com: npm run mutacao
//
// Usa o executor de comando em vez de @stryker-mutator/vitest-runner: com a vitest 5 deste projeto
// o executor próprio não ativava os mutantes, e todos sobreviviam mesmo quando um teste quebrava.
export default {
  testRunner: 'command',
  // Limite de tempo folgado e poucos workers: com várias suítes rodando ao mesmo tempo, um teste lento
  // estouraria o limite padrão de 5 s e o mutante seria contado como morto sem ter sido detectado.
  commandRunner: { command: 'npx vitest run --testTimeout=30000 --hookTimeout=30000 --maxWorkers=2' },
  coverageAnalysis: 'off',
  mutate: ['src/services/afinidade.js', 'src/utils/tags.js', 'src/services/semana.js', 'src/services/conexoes.js', 'src/services/chat.js'],
  reporters: ['clear-text', 'progress', 'html', 'json'],
  htmlReporter: { fileName: 'reports/mutacao/index.html' },
  jsonReporter: { fileName: 'reports/mutacao/relatorio.json' },
  tempDirName: '.stryker-tmp',
  concurrency: 2,
  timeoutMS: 120000,
};
