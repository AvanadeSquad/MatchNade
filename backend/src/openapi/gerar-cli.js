import { writeFile } from 'node:fs/promises';
import { gerarEspecificacao } from './especificacao.js';

// Grava a especificação em backend/openapi.json. Rode depois de mudar uma rota ou um schema.
const destino = new URL('../../openapi.json', import.meta.url);
await writeFile(destino, `${JSON.stringify(gerarEspecificacao(), null, 2)}\n`);
console.log('openapi.json atualizado.');
