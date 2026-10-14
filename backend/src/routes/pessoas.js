import { Router } from 'express';
import { z } from 'zod';
import { bloquear, denunciar, desbloquear, listarBloqueados } from '../services/bloqueios.js';
import { perfilDaPessoa } from '../services/pessoas.js';
import { lerId } from '../utils/validacao.js';

const corpoDenuncia = z.object({ reason: z.string().max(500).optional() });

export function rotasPessoas(ctx, autenticar) {
  const router = Router();
  const { banco } = ctx;

  router.get('/employees/:id', autenticar, async (req, res) => {
    res.json(await perfilDaPessoa(ctx, req.usuario.id, lerId(req)));
  });

  router.post('/employees/:id/block', autenticar, async (req, res) => {
    await bloquear(banco, req.usuario.id, lerId(req));
    res.status(204).end();
  });

  router.delete('/employees/:id/block', autenticar, async (req, res) => {
    await desbloquear(banco, req.usuario.id, lerId(req));
    res.status(204).end();
  });

  router.post('/employees/:id/report', autenticar, async (req, res) => {
    const { reason } = corpoDenuncia.parse(req.body ?? {});
    await denunciar(banco, req.usuario.id, lerId(req), reason);
    res.status(201).end();
  });

  router.get('/blocks', autenticar, async (req, res) => {
    res.json({ blocked: await listarBloqueados(banco, req.usuario.id) });
  });

  return router;
}
