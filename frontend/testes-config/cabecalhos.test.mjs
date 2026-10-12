import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { URL } from 'node:url';

// O Vercel lê os cabeçalhos de vercel.json e o Netlify de public/_headers. Os dois precisam
// enviar exatamente a mesma política, senão a segurança muda conforme a hospedagem.
const raiz = new URL('../', import.meta.url);

function doVercel() {
  const config = JSON.parse(readFileSync(new URL('vercel.json', raiz), 'utf8'));
  const bloco = config.headers.find((h) => h.source === '/(.*)');
  return Object.fromEntries(bloco.headers.map((h) => [h.key, h.value]));
}

// Formato do Netlify: uma linha com o caminho e, abaixo, "  Nome: valor" indentado.
function doNetlify() {
  const linhas = readFileSync(new URL('public/_headers', raiz), 'utf8').split('\n');
  assert.equal(linhas[0], '/*', 'os cabeçalhos devem valer para todas as rotas');
  const cabecalhos = {};
  for (const linha of linhas.slice(1).filter((l) => l.trim())) {
    assert.match(linha, /^ {2}[A-Za-z-]+: .+$/, `linha fora do formato: ${linha}`);
    const separador = linha.indexOf(': ');
    cabecalhos[linha.slice(0, separador).trim()] = linha.slice(separador + 2);
  }
  return cabecalhos;
}

test('vercel.json e public/_headers enviam os mesmos cabeçalhos com os mesmos valores', () => {
  assert.deepEqual(doNetlify(), doVercel());
});

test('a política de conteúdo não usa unsafe-eval e libera a API e o login do Google', () => {
  const csp = doVercel()['Content-Security-Policy'];
  assert.doesNotMatch(csp, /unsafe-eval/);
  assert.match(csp, /connect-src [^;]*https:\/\/\*\.onrender\.com/);
  assert.match(csp, /script-src 'self' https:\/\/accounts\.google\.com\/gsi\/client;/);
});
