// Pessoas que a usuária ignorou na descoberta. Ficam na sessão do navegador, separadas por usuária,
// para não reaparecerem ao recarregar nem vazarem para outra conta usada na mesma aba.
const chave = (usuarioId) => `ignorados:${usuarioId}`;

export function lerIgnorados(usuarioId) {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(chave(usuarioId)) ?? '[]'));
  } catch {
    return new Set();
  }
}

export function gravarIgnorados(usuarioId, conjunto) {
  try {
    sessionStorage.setItem(chave(usuarioId), JSON.stringify([...conjunto]));
  } catch {
    // Sem armazenamento, as ignoradas só valem até recarregar a página.
  }
}

export function ignorar(usuarioId, pessoaId) {
  const conjunto = lerIgnorados(usuarioId);
  conjunto.add(pessoaId);
  gravarIgnorados(usuarioId, conjunto);
}

export function limparIgnorados(usuarioId) {
  try {
    sessionStorage.removeItem(chave(usuarioId));
  } catch {
    // Nada a limpar.
  }
}
