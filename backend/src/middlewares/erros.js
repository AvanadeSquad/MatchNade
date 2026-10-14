import { ZodError } from 'zod';
import { ErroApi } from '../utils/erros.js';

export function rotaNaoEncontrada(_req, res) {
  res.status(404).json({ code: 'NAO_ENCONTRADO', message: 'Rota não encontrada.' });
}

// Converte qualquer erro no formato { code, message }. Erros inesperados vão para `registrar`
// junto com a requisição, para o log trazer o id dela.
export function tratarErros(registrar = console.error) {
  return (erro, req, res, _next) => {
    if (erro instanceof ErroApi) {
      return res.status(erro.status).json({ code: erro.code, message: erro.message });
    }
    if (erro instanceof ZodError) {
      return res.status(400).json({
        code: 'DADOS_INVALIDOS',
        message: 'Confira os dados enviados.',
        details: erro.issues.map((i) => ({ campo: i.path.join('.'), problema: i.message })),
      });
    }
    if (erro?.type === 'entity.parse.failed' || erro?.type === 'entity.too.large') {
      return res.status(400).json({ code: 'CORPO_INVALIDO', message: 'O corpo da requisição é inválido.' });
    }
    registrar(erro, req);
    return res.status(500).json({ code: 'ERRO_INTERNO', message: 'Algo deu errado. Tente novamente.' });
  };
}
