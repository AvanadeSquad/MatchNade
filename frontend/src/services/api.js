import { limparToken, obterToken } from './sessao.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

// Erro devolvido pela API no formato { code, message }.
export class ErroApi extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const EVENTO_SESSAO_EXPIRADA = 'sessao-expirada';

// Chamada JSON à API com o token no cabeçalho Authorization.
// Resposta 401 apaga o token e avisa a aplicação; resposta 204 devolve null.
export async function api(caminho, { metodo = 'GET', corpo, sinal } = {}) {
  const token = obterToken();
  let resposta;
  try {
    resposta = await fetch(`${API_URL}${caminho}`, {
      method: metodo,
      signal: sinal,
      headers: {
        ...(corpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
    });
  } catch (erro) {
    if (erro?.name === 'AbortError') throw erro;
    throw new ErroApi(0, 'SEM_CONEXAO', 'Não foi possível falar com o servidor. Verifique sua conexão.');
  }

  if (resposta.status === 204) return null;
  const dados = await resposta.json().catch(() => null);

  if (!resposta.ok) {
    if (resposta.status === 401 && token) {
      limparToken();
      window.dispatchEvent(new Event(EVENTO_SESSAO_EXPIRADA));
    }
    throw new ErroApi(resposta.status, dados?.code ?? 'ERRO', dados?.message ?? 'Algo deu errado. Tente novamente.');
  }
  return dados;
}

// Ids vindos da URL entram no caminho da API já codificados.
const id = (valor) => encodeURIComponent(valor);

export const API = {
  loginGoogle: (credential) => api('/auth/google', { metodo: 'POST', corpo: { credential } }),
  loginComSenha: (email, senha) => api('/auth/senha', { metodo: 'POST', corpo: { email, senha } }),
  definirSenha: (corpo) => api('/auth/senha', { metodo: 'PUT', corpo }),
  usuariosDeDesenvolvimento: () => api('/auth/dev-users'),
  loginDesenvolvimento: (email) => api('/auth/dev-login', { metodo: 'POST', corpo: { email } }),

  perfil: () => api('/profile'),
  atualizarPerfil: (dados) => api('/profile', { metodo: 'PUT', corpo: dados }),
  analisarBio: (raw_bio) => api('/profile/enrich-bio', { metodo: 'POST', corpo: { raw_bio } }),
  salvarInteresses: (interests) => api('/profile/interests', { metodo: 'PUT', corpo: { interests } }),
  pausar: (is_paused) => api('/profile/pause', { metodo: 'PATCH', corpo: { is_paused } }),
  excluirPerfil: () => api('/profile', { metodo: 'DELETE' }),
  tags: (categoria) => api(`/tags${categoria ? `?category=${categoria}` : ''}`),
  criarTag: (name, category) => api('/tags', { metodo: 'POST', corpo: { name, category } }),

  recomendacoes: (limite = 20) => api(`/matches/recommendations?limit=${limite}`),
  // Com `espiar`, a consulta não marca as conexões confirmadas como vistas.
  conexoes: ({ espiar = false } = {}) => api(`/matches${espiar ? '?peek=true' : ''}`),
  demonstrarInteresse: (receiver_id) => api('/matches', { metodo: 'POST', corpo: { receiver_id } }),
  responder: (conexao, action) => api(`/matches/${id(conexao)}`, { metodo: 'PATCH', corpo: { action } }),
  quebraGelo: (conexao) => api(`/matches/${id(conexao)}/icebreaker`),
  mensagens: (conexao, depois = 0, sinal) => api(`/matches/${id(conexao)}/messages?after=${depois}`, { sinal }),
  enviarMensagem: (conexao, body) => api(`/matches/${id(conexao)}/messages`, { metodo: 'POST', corpo: { body } }),

  pessoa: (pessoa) => api(`/employees/${id(pessoa)}`),
  bloquear: (pessoa) => api(`/employees/${id(pessoa)}/block`, { metodo: 'POST' }),
  desbloquear: (pessoa) => api(`/employees/${id(pessoa)}/block`, { metodo: 'DELETE' }),
  denunciar: (pessoa, reason) => api(`/employees/${id(pessoa)}/report`, { metodo: 'POST', corpo: { reason } }),
  bloqueados: () => api('/blocks'),
};
