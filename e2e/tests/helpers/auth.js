// Login nos testes, sem passar pelo Google.
// O Google bloqueia login automatizado, entao os testes usam um endpoint
// que so existe quando o backend roda com E2E_TEST_MODE=true:
//   POST {API}/test/login  { "email": "..." }  ->  { "token": "..." }
// Esse endpoint ainda precisa ser criado no backend. Nunca deve existir em producao.

const API_URL = process.env.E2E_API_URL || 'http://localhost:3000/api/v1';

async function obterToken(request, email) {
  const resposta = await request.post(`${API_URL}/test/login`, { data: { email } });
  if (!resposta.ok()) {
    throw new Error(`Login de teste falhou para ${email}: HTTP ${resposta.status()}`);
  }
  const { token } = await resposta.json();
  return token;
}

// Deixa a pagina autenticada como o usuario informado.
// A chave do localStorage deve ser a mesma que o frontend usa para guardar o token.
async function entrarComo(page, request, email, chave = 'token') {
  const token = await obterToken(request, email);
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), [chave, token]);
  return token;
}

module.exports = { API_URL, obterToken, entrarComo };
