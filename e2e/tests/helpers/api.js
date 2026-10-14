// Apoio aos testes: login sem Google e preparação de pessoas pela API.
// O login usa POST {API}/test/login, rota que a API só registra com E2E_TEST_MODE=true.

export const API_URL = process.env.E2E_API_URL || 'http://localhost:3100/api/v1';

let contador = 0;

// E-mail e sufixo únicos por execução, para os testes não colidirem no banco compartilhado.
export function identificadorUnico(prefixo) {
  contador += 1;
  return `${prefixo}${Date.now().toString(36)}${contador}`;
}

export async function entrarPorApi(request, email) {
  const resposta = await request.post(`${API_URL}/test/login`, { data: { email } });
  if (!resposta.ok()) throw new Error(`Login de teste falhou para ${email}: HTTP ${resposta.status()}`);
  return (await resposta.json()).token;
}

const cabecalho = (token) => ({ Authorization: `Bearer ${token}` });

export async function chamar(request, token, metodo, caminho, dados) {
  const resposta = await request[metodo](`${API_URL}${caminho}`, { headers: cabecalho(token), data: dados });
  return resposta;
}

// Deixa a página autenticada: grava o token no localStorage antes de qualquer script do app.
export async function autenticarPagina(page, token) {
  await page.addInitScript((valor) => window.localStorage.setItem('token', valor), token);
}

// Cria uma pessoa com cadastro completo e os interesses informados. Devolve { id, nome, email, token }.
export async function criarPessoaPronta(request, { nome, tecnicas, hobbies, cargo }) {
  const sufixo = identificadorUnico('p');
  const email = `${sufixo}@exemplo.test`;
  const token = await entrarPorApi(request, email);

  await chamar(request, token, 'put', '/profile', {
    name: nome,
    department: 'Unidade de Teste',
    location: 'Recife',
    connection_goals: ['NETWORKING'],
    ...(cargo ? { position: cargo } : {}),
  });
  const interesses = [
    ...tecnicas.map((name) => ({ name, category: 'TECHNICAL' })),
    ...hobbies.map((name) => ({ name, category: 'HOBBY' })),
  ];
  const resposta = await chamar(request, token, 'put', '/profile/interests', { interests: interesses });
  if (!resposta.ok()) throw new Error(`Não foi possível salvar interesses: HTTP ${resposta.status()}`);
  const perfil = await resposta.json();
  return { id: perfil.id, nome, email, token };
}

// Interesses exclusivos de um teste: ninguém mais os tem, então as duas pessoas ficam com afinidade máxima entre si.
export function interessesExclusivos() {
  const marca = identificadorUnico('x');
  return { tecnicas: [`Tema técnico ${marca}`, `Ferramenta ${marca}`], hobbies: [`Hobby ${marca}`] };
}
