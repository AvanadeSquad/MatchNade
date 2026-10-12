import 'dotenv/config';
import { criarProvedores } from '../src/ai/provedores.js';
import { carregarConfig } from '../src/config/env.js';
import { avaliar, carregarBios } from './avaliar.js';
import { provedorSimulado } from './provedor-simulado.js';

// Avalia a extração de tags com as bios fictícias de bios.json.
// Usa os provedores reais quando GEMINI_API_KEY ou GROQ_API_KEY estão definidas; senão, o simulado.
// Nunca imprime as chaves: só o nome do provedor e o modelo.
const config = carregarConfig({ ...process.env, NODE_ENV: 'test' });
const reais = criarProvedores(config.ia);
const provedores = reais.length ? reais : [provedorSimulado];

const resultado = await avaliar({ config, provedores, bios: await carregarBios() });
const pct = (valor) => `${(valor * 100).toFixed(1)}%`;

console.log(`Provedores: ${provedores.map((p) => `${p.nome} (${p.modelo})`).join(', ')}`);
console.log(`Bios avaliadas: ${resultado.bios}`);
console.log(`Precisão: ${pct(resultado.precisao)}`);
console.log(`Cobertura: ${pct(resultado.cobertura)}`);
console.log(`Respostas com cargo: ${resultado.respostasComCargo} (meta: 0)`);
console.log(`Respostas que obedeceram a texto injetado: ${resultado.respostasComInjecao} (meta: 0)`);
console.log(`Bios não vazias sem resposta da IA: ${resultado.fallbacks}`);
for (const bio of resultado.porBio) {
  if (bio.faltaram.length) console.log(`  ${bio.id}: faltaram ${bio.faltaram.join(', ')}`);
}
for (const item of resultado.comCargo) console.log(`  ${item.id}: cargo devolvido ${item.cargos.join(', ')}`);
for (const item of resultado.comInjecao) console.log(`  ${item.id}: tag injetada devolvida ${item.tags.join(', ')}`);

process.exitCode = resultado.respostasComCargo > 0 ? 1 : 0;
