import 'dotenv/config';
import { criarProvedores } from '../src/ai/provedores.js';
import { carregarConfig } from '../src/config/env.js';
import { avaliar, carregarBios, montarRelatorio } from './avaliar.js';
import { provedorSimulado } from './provedor-simulado.js';

// Avalia a extração de tags com as bios fictícias de bios.json.
// Usa os provedores reais quando GEMINI_API_KEY ou GROQ_API_KEY estão definidas; senão, o simulado.
// Nunca imprime as chaves: só o nome do provedor e o modelo. Os erros dos provedores carregam só
// o status HTTP ou o tipo da falha (src/ai/provedores.js).
const config = carregarConfig({ ...process.env, NODE_ENV: 'test' });
const reais = criarProvedores(config.ia);
const provedores = reais.length ? reais : [provedorSimulado];

const resultado = await avaliar({ config, provedores, bios: await carregarBios() });
const { linhas, codigoSaida } = montarRelatorio(resultado, { provedores, real: reais.length > 0 });
for (const linha of linhas) console.log(linha);
process.exitCode = codigoSaida;
