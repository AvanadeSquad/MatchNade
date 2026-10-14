// Log estruturado: uma linha JSON por evento, com horário, nível e mensagem.
// Recebe só os campos que quem chama passa; nunca registra corpo de requisição, token, bio,
// e-mail ou mensagens do chat.

export const NIVEIS = ['debug', 'info', 'warn', 'error', 'silent'];

export function criarLog({ nivel = 'info', escrever = (linha) => process.stdout.write(`${linha}\n`) } = {}) {
  const minimo = NIVEIS.indexOf(nivel);
  const registrar =
    (nivelDoEvento) =>
    (mensagem, campos = {}) => {
      if (NIVEIS.indexOf(nivelDoEvento) < minimo) return;
      escrever(JSON.stringify({ time: new Date().toISOString(), level: nivelDoEvento, msg: mensagem, ...campos }));
    };
  return { debug: registrar('debug'), info: registrar('info'), warn: registrar('warn'), error: registrar('error') };
}

// Resumo seguro de um erro: nome, código e pilha sem a primeira linha. A mensagem fica de fora
// porque erros do banco podem trazer valores, como o e-mail que violou um índice único.
export function resumirErro(erro) {
  const pilha =
    typeof erro?.stack === 'string'
      ? erro.stack
          .split('\n')
          .slice(1)
          .map((l) => l.trim())
      : [];
  return { erro: erro?.name ?? 'Error', codigo: erro?.code ?? null, pilha };
}
