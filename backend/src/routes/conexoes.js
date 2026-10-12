import { Router } from 'express';
import { z } from 'zod';
import { enviarMensagem, listarMensagens } from '../services/chat.js';
import { demonstrarInteresse, listarConexoes, obterQuebraGelo, responderSolicitacao } from '../services/conexoes.js';
import { recomendar } from '../services/recomendacoes.js';
import { lerId } from '../utils/validacao.js';

export const corpoInteresse = z.object({ receiver_id: z.number().int().positive() });
export const corpoResposta = z.object({ action: z.enum(['accept', 'decline']) });
export const corpoMensagem = z.object({ body: z.string() });
export const consultaLista = z.object({ peek: z.enum(['true', 'false']).optional() });
export const consultaMensagens = z.object({
  after: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export function rotasConexoes(ctx, autenticar) {
  const router = Router();

  router.get('/matches/recommendations', autenticar, async (req, res) => {
    const limite = z.coerce.number().int().positive().optional().parse(req.query.limit);
    res.json(await recomendar(ctx, req.usuario.id, limite));
  });

  router.get('/matches', autenticar, async (req, res) => {
    const { peek } = consultaLista.parse(req.query);
    res.json(await listarConexoes(ctx, req.usuario.id, { marcarVisto: peek !== 'true' }));
  });

  router.post('/matches', autenticar, async (req, res) => {
    const { receiver_id: receiverId } = corpoInteresse.parse(req.body);
    res.status(201).json(await demonstrarInteresse(ctx, req.usuario.id, receiverId));
  });

  router.patch('/matches/:id', autenticar, async (req, res) => {
    const { action } = corpoResposta.parse(req.body);
    res.json(await responderSolicitacao(ctx, req.usuario.id, lerId(req), action));
  });

  router.get('/matches/:id/icebreaker', autenticar, ctx.limitarPorPessoa(60, 60 * 60 * 1000), async (req, res) => {
    res.json(await obterQuebraGelo(ctx, req.usuario.id, lerId(req)));
  });

  router.get('/matches/:id/messages', autenticar, async (req, res) => {
    const { after, limit } = consultaMensagens.parse(req.query);
    res.json(await listarMensagens(ctx, req.usuario.id, lerId(req), { depois: after, limite: limit }));
  });

  router.post('/matches/:id/messages', autenticar, async (req, res) => {
    const { body } = corpoMensagem.parse(req.body);
    res.status(201).json(await enviarMensagem(ctx, req.usuario.id, lerId(req), body));
  });

  return router;
}
