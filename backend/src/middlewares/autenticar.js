import { naoAutenticado } from '../utils/erros.js';
import { buscarFuncionario } from '../services/perfil.js';

// Exige `Authorization: Bearer <jwt>` e carrega o id da pessoa em req.usuario.
export function autenticar({ banco, autenticacao }) {
  return async (req, _res, next) => {
    const cabecalho = req.get('authorization') ?? '';
    const [tipo, token] = cabecalho.split(' ');
    if (tipo !== 'Bearer' || !token) throw naoAutenticado();

    const id = autenticacao.verificar(token);
    const funcionario = await buscarFuncionario(banco.query, id);
    if (!funcionario) throw naoAutenticado('Sessão inválida. Entre novamente.');

    req.usuario = { id };
    next();
  };
}
