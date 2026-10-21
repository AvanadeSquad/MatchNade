const CHAVE = 'token';

// O token fica no localStorage. Se o navegador bloquear o acesso, a sessão vale só até recarregar.
let emMemoria = null;

export function obterToken() {
  try {
    return localStorage.getItem(CHAVE) ?? emMemoria;
  } catch {
    return emMemoria;
  }
}

export function salvarToken(token) {
  emMemoria = token;
  try {
    localStorage.setItem(CHAVE, token);
  } catch {
    // Sem armazenamento disponível, o token permanece só em memória.
  }
}

export function limparToken() {
  emMemoria = null;
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    // Nada a limpar.
  }
}
