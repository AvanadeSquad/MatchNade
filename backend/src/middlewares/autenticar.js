import { naoAutenticado, proibido } from '../utils/erros.js';
import { buscarFuncionarioDaSessao } from '../services/perfil.js';

// Única coisa que uma conta marcada para exclusão pode fazer: ver o próprio perfil, cancelar ou apagar agora.
const ROTAS_EM_EXCLUSAO = new Set(['GET /profile', 'GET /profile/export', 'POST /profile/deletion/cancel', 'DELETE /profile']);

// Exige `Authorization: Bearer <jwt>` e carrega o id da pessoa em req.usuario.
// Token emitido antes da última redefinição de senha (versão de sessão menor) é recusado.
export function autenticar({ banco, autenticacao }) {
  return async (req, _res, next) => {
    const cabecalho = req.get('authorization') ?? '';
    const [tipo, token] = cabecalho.split(' ');
    if (tipo !== 'Bearer' || !token) throw naoAutenticado();

    const { id, versao } = autenticacao.verificarComVersao(token);
    const funcionario = await buscarFuncionarioDaSessao(banco.query, id);
    if (!funcionario) throw naoAutenticado('Sessão inválida. Entre novamente.');
    if (funcionario.token_version !== versao) throw naoAutenticado('Sessão expirada. Entre novamente.');

    const emExclusao = Boolean(funcionario.deletion_requested_at);
    if (emExclusao && !ROTAS_EM_EXCLUSAO.has(`${req.method} ${req.route?.path}`)) {
      throw proibido('CONTA_EM_EXCLUSAO', 'Esta conta está marcada para exclusão. Cancele a exclusão para voltar a usar o app.');
    }

    req.usuario = { id, emExclusao };
    next();
  };
}
