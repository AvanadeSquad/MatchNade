import { Router } from 'express';
import { z } from 'zod';
import { montarPerfil, obterOuCriarPorGoogle } from '../services/perfil.js';

export const corpoGoogle = z.object({ credential: z.string().min(10) });

// Login com Google: valida o ID token, cria a pessoa no primeiro acesso e devolve o JWT.
export function rotasAuth(ctx) {
  const router = Router();

  router.post('/auth/google', async (req, res) => {
    const { credential } = corpoGoogle.parse(req.body);
    const identidade = await ctx.autenticacao.identificarPorGoogle(credential);
    const { id, novo } = await obterOuCriarPorGoogle(ctx.banco, identidade);
    await ctx.banco.query('UPDATE employee SET last_seen_at = COALESCE(last_seen_at, NOW()) WHERE id = $1', [id]);
    res.json({ token: ctx.autenticacao.assinar(id), employee: await montarPerfil(ctx, id), is_new: novo });
  });

  return router;
}
