import cors from 'cors';
import express from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { criarServicoIa } from './ai/servico.js';
import { autenticar } from './middlewares/autenticar.js';
import { rotaNaoEncontrada, tratarErros } from './middlewares/erros.js';
import { identificarRequisicao } from './middlewares/requisicao.js';
import { rotasAuth } from './routes/auth.js';
import { rotasConexoes } from './routes/conexoes.js';
import { rotasDev } from './routes/dev.js';
import { rotasPerfil } from './routes/perfil.js';
import { rotasPessoas } from './routes/pessoas.js';
import { criarAutenticacao } from './services/autenticacao.js';
import { criarLog, resumirErro } from './utils/log.js';

// Monta a aplicação Express. `banco` e `config` são obrigatórios; `ia`, `verificadorGoogle` e `log`
// podem ser injetados (testes) e `limitarRequisicoes: false` desliga o limite.
export function criarApp({
  banco,
  config,
  ia,
  verificadorGoogle,
  limitarRequisicoes = true,
  registrarErro,
  log = criarLog({ nivel: config.logLevel }),
}) {
  const autenticacao = criarAutenticacao(config, verificadorGoogle);
  const ctx = { banco, config, autenticacao, ia: ia ?? criarServicoIa({ config, banco }) };
  // Limites por pessoa nas rotas que gastam a cota gratuita de IA.
  ctx.limitarPorPessoa = (max, janelaMs) =>
    limitarRequisicoes
      ? rateLimit({
          windowMs: janelaMs,
          limit: max,
          keyGenerator: (req) => (req.usuario ? `u${req.usuario.id}` : ipKeyGenerator(req.ip)),
          standardHeaders: true,
          legacyHeaders: false,
        })
      : (_req, _res, next) => next();
  const exigirLogin = autenticar(ctx);

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.use(identificarRequisicao(log));
  app.use(helmet());
  app.use(cors({ origin: config.frontendUrl.split(',').map((origem) => origem.trim()) }));
  app.use(express.json({ limit: '20kb' }));

  // As verificações de saúde ficam antes do limite para não consumir a cota de quem as consulta.
  const saude = (_req, res) => res.json({ status: 'ok' });
  app.get('/health', saude);

  // Prontidão: além de o processo responder, o banco precisa atender em até 2 segundos.
  const prontidao = async (req, res) => {
    let espera;
    const tempoEsgotado = new Promise((_, rejeitar) => {
      espera = setTimeout(() => rejeitar(new Error('banco não respondeu a tempo')), 2000);
    });
    try {
      await Promise.race([banco.query('SELECT 1'), tempoEsgotado]);
      res.json({ status: 'ok', banco: 'ok' });
    } catch (erro) {
      log.warn('banco indisponivel', { request_id: req.id, ...resumirErro(erro) });
      res.status(503).json({ status: 'indisponivel', banco: 'erro' });
    } finally {
      clearTimeout(espera);
    }
  };
  app.get('/api/v1/health/ready', prontidao);

  const limite = (max) => rateLimit({ windowMs: 15 * 60 * 1000, limit: max, standardHeaders: true, legacyHeaders: false });
  const semLimite = (_req, _res, next) => next();
  if (limitarRequisicoes) app.use(limite(600));

  const api = express.Router();
  api.get('/health', saude);
  api.use('/auth', limitarRequisicoes ? limite(30) : semLimite);
  api.use(rotasAuth(ctx));
  api.use(rotasDev(ctx));
  api.use(rotasPerfil(ctx, exigirLogin));
  api.use(rotasConexoes(ctx, exigirLogin));
  api.use(rotasPessoas(ctx, exigirLogin));
  app.use('/api/v1', api);

  app.use(rotaNaoEncontrada);
  app.use(tratarErros(registrarErro ?? ((erro, req) => log.error('erro inesperado', { request_id: req.id, ...resumirErro(erro) }))));
  return app;
}
