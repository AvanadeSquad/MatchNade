import { naoAutenticado } from '../utils/erros.js';
import { buscarFuncionario } from '../services/perfil.js';

// Exige `Authorization: Bearer <jwt>` e carrega o id da pessoa em req.usuario.
// Token emitido antes da última redefinição de senha (versão de sessão menor) é recusado.
export function autenticar({ banco, autenticacao }) {
  return async (req, _res, next) => {
    const cabecalho = req.get('authorization') ?? '';
    const [tipo, token] = cabecalho.split(' ');
    if (tipo !== 'Bearer' || !token) throw naoAutenticado();

    const { id, versao } = autenticacao.verificarComVersao(token);
    const funcionario = await buscarFuncionario(banco.query, id);
    if (!funcionario) throw naoAutenticado('Sessão inválida. Entre novamente.');
    if (funcionario.token_version !== versao) throw naoAutenticado('Sessão expirada. Entre novamente.');

    req.usuario = { id };
    next();
  };
}
