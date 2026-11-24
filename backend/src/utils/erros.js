// Erro de negócio com status HTTP e código curto, no formato { code, message }.
export class ErroApi extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const naoAutenticado = (message = 'Faça login para continuar.') => new ErroApi(401, 'NAO_AUTENTICADO', message);
export const proibido = (code, message) => new ErroApi(403, code, message);
export const naoEncontrado = (message = 'Não encontrado.') => new ErroApi(404, 'NAO_ENCONTRADO', message);
export const conflito = (code, message) => new ErroApi(409, code, message);
export const invalido = (code, message) => new ErroApi(400, code, message);
