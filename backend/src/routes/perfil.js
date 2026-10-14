import { Router } from 'express';
import { z } from 'zod';
import { invalido } from '../utils/erros.js';
import { limparTexto } from '../utils/tags.js';
import {
  OBJETIVOS,
  atualizarPerfil,
  definirPausa,
  excluirPerfil,
  garantirTag,
  listarTags,
  montarPerfil,
  salvarInteresses,
} from '../services/perfil.js';

const texto = (max) => z.string().trim().max(max);

const corpoPerfil = z.object({
  name: texto(120).min(2).optional(),
  bio: texto(1000).optional(),
  position: texto(80).optional(),
  department: texto(80).optional(),
  location: texto(80).optional(),
  connection_goals: z.array(z.enum(OBJETIVOS)).max(OBJETIVOS.length).optional(),
  max_weekly_matches: z.number().int().min(1).max(5).optional(),
});

const corpoBio = z.object({ raw_bio: z.string().max(2000) });

const corpoInteresses = z.object({
  interests: z
    .array(
      z.object({
        name: texto(60),
        category: z.enum(['TECHNICAL', 'HOBBY']),
        source: z.enum(['AI', 'MANUAL']).optional(),
        confidence: z.number().min(0).max(1).optional(),
      }),
    )
    .max(40),
});

const corpoTag = z.object({ name: texto(60), category: z.enum(['TECHNICAL', 'HOBBY']) });
const corpoPausa = z.object({ is_paused: z.boolean() });

export function rotasPerfil(ctx, autenticar) {
  const router = Router();
  const { banco } = ctx;

  router.get('/profile', autenticar, async (req, res) => {
    res.json(await montarPerfil(ctx, req.usuario.id));
  });

  router.put('/profile', autenticar, async (req, res) => {
    await atualizarPerfil(banco, req.usuario.id, corpoPerfil.parse(req.body));
    res.json(await montarPerfil(ctx, req.usuario.id));
  });

  router.post('/profile/enrich-bio', autenticar, ctx.limitarPorPessoa(15, 60 * 60 * 1000), async (req, res) => {
    const { raw_bio: bio } = corpoBio.parse(req.body);
    if (!limparTexto(bio)) throw invalido('BIO_VAZIA', 'Escreva um pouco sobre você para analisarmos.');
    const { fallback, ...tags } = await ctx.ia.extrairTags(req.usuario.id, bio);
    res.json(fallback ? { ...tags, fallback: true } : tags);
  });

  router.put('/profile/interests', autenticar, async (req, res) => {
    const { interests } = corpoInteresses.parse(req.body);
    await salvarInteresses(ctx, req.usuario.id, interests);
    res.json(await montarPerfil(ctx, req.usuario.id));
  });

  router.patch('/profile/pause', autenticar, async (req, res) => {
    const { is_paused: pausado } = corpoPausa.parse(req.body);
    await definirPausa(banco, req.usuario.id, pausado);
    res.json({ is_paused: pausado });
  });

  router.delete('/profile', autenticar, async (req, res) => {
    await excluirPerfil(banco, req.usuario.id);
    res.status(204).end();
  });

  router.get('/tags', autenticar, async (req, res) => {
    const categoria = z.enum(['TECHNICAL', 'HOBBY']).optional().parse(req.query.category);
    res.json({ tags: await listarTags(banco, categoria) });
  });

  router.post('/tags', autenticar, async (req, res) => {
    const { name, category } = corpoTag.parse(req.body);
    res.status(201).json(await garantirTag(banco.query, name, category));
  });

  return router;
}
