import { resumirErro } from '../utils/log.js';

// Verificação de prontidão: o banco precisa responder a um SELECT 1 em até `limiteBancoMs`.
// O resultado fica guardado por alguns segundos para que chamadas repetidas, que não exigem login,
// não virem uma consulta ao banco cada uma. Uma falha fica guardada por menos tempo, para a
// recuperação do banco aparecer logo. Chamadas simultâneas aproveitam a mesma consulta em andamento.
// O aviso de falha leva o `request_id` da requisição que disparou a consulta, para ser correlacionado.
export function criarProntidao({ banco, log, agora = Date.now, guardarOkMs = 5000, guardarFalhaMs = 2000, limiteBancoMs = 2000 }) {
  let guardado = null;
  let emAndamento = null;

  async function consultar(contexto) {
    let espera;
    const tempoEsgotado = new Promise((_, rejeitar) => {
      espera = setTimeout(() => rejeitar(new Error('banco não respondeu a tempo')), limiteBancoMs);
    });
    try {
      await Promise.race([banco.query('SELECT 1'), tempoEsgotado]);
      return true;
    } catch (erro) {
      log.warn('banco indisponivel', { ...contexto, ...resumirErro(erro) });
      return false;
    } finally {
      clearTimeout(espera);
    }
  }

  // Devolve true quando o banco está pronto. `contexto` (por exemplo `{ request_id }`) entra no aviso.
  return async function verificar(contexto = {}) {
    if (guardado && agora() < guardado.expiraEm) return guardado.pronto;
    emAndamento ??= consultar(contexto).then((pronto) => {
      guardado = { pronto, expiraEm: agora() + (pronto ? guardarOkMs : guardarFalhaMs) };
      emAndamento = null;
      return pronto;
    });
    return emAndamento;
  };
}
