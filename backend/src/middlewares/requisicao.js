import { randomUUID } from 'node:crypto';

// Aceita o id enviado por um proxy só se tiver formato seguro, para não injetar texto no log.
const ID_VALIDO = /^[A-Za-z0-9-]{8,64}$/;

// Dá um id a cada requisição (cabeçalho X-Request-Id na resposta) e registra uma linha ao terminar,
// com método, caminho sem a query string, status, duração e o id da pessoa logada, se houver.
export function identificarRequisicao(log) {
  return (req, res, next) => {
    const recebido = req.get('X-Request-Id');
    req.id = recebido && ID_VALIDO.test(recebido) ? recebido : randomUUID();
    res.setHeader('X-Request-Id', req.id);
    const inicio = process.hrtime.bigint();
    res.on('finish', () => {
      log.info('requisicao', {
        request_id: req.id,
        method: req.method,
        path: req.originalUrl.split('?')[0],
        status: res.statusCode,
        duracao_ms: Number((process.hrtime.bigint() - inicio) / 1000000n),
        ...(req.usuario ? { usuario_id: req.usuario.id } : {}),
      });
    });
    next();
  };
}
