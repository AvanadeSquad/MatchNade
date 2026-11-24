import { Router } from 'express';
import { z } from 'zod';
import { invalido } from '../utils/erros.js';
import { limparTexto } from '../utils/tags.js';
import {
  AVATARES,
  HORARIOS_CAFE,
  MAX_HORARIOS_PREFERIDOS,
  OBJETIVOS,
  VISIBILIDADES,
  atualizarPerfil,
  definirPausa,
  excluirPerfil,
  garantirTag,
  listarTags,
  montarPerfil,
  salvarInteresses,
} from '../services/perfil.js';
import { cancelarExclusao, solicitarExclusao } from '../services/exclusao.js';
import { exportarDados } from '../services/exportacao.js';

const texto = (max) => z.string().trim().max(max);

export const corpoPerfil = z.object({
  name: texto(120).min(2).optional(),
  bio: texto(1000).optional(),
  position: texto(80).optional(),
  department: texto(80).optional(),
  location: texto(80).optional(),
  connection_goals: z.array(z.enum(OBJETIVOS)).max(OBJETIVOS.length).optional(),
  max_weekly_matches: z.number().int().min(1).max(5).optional(),
  pronouns: texto(30).optional(),
  visibility: z.enum(VISIBILIDADES).optional(),
  avatar_id: z.enum(AVATARES).nullable().optional(),
  preferred_coffee_slots: z.array(z.enum(HORARIOS_CAFE)).max(MAX_HORARIOS_PREFERIDOS).optional(),
});

// Tag nova pode ter sido criada: pede o vetor dela em segundo plano. Falha aqui nunca afeta a resposta.
function acionarVetorizador(ctx) {
  try {
    ctx.vetorizador?.agendar();
  } catch {
    // O score semântico é opcional.
  }
}

export const corpoBio = z.object({ raw_bio: z.string().max(1000) });

export const corpoInteresses = z.object({
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

export const corpoTag = z.object({ name: texto(60), category: z.enum(['TECHNICAL', 'HOBBY']) });
export const corpoPausa = z.object({ is_paused: z.boolean() });
export const corpoExclusao = z.object({ confirm_email: z.string().trim().min(1).max(254) });
export const consultaTags = z.object({ category: z.enum(['TECHNICAL', 'HOBBY']).optional() });

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
    acionarVetorizador(ctx);
    res.json(await montarPerfil(ctx, req.usuario.id));
  });

  router.patch('/profile/pause', autenticar, async (req, res) => {
    const { is_paused: pausado } = corpoPausa.parse(req.body);
    await definirPausa(banco, req.usuario.id, pausado);
    res.json({ is_paused: pausado });
  });

  router.get('/profile/export', autenticar, ctx.limitarPorPessoa(5, 60 * 60 * 1000), async (req, res) => {
    const dados = await exportarDados(banco, req.usuario.id);
    res.set('Content-Disposition', 'attachment; filename="meus-dados-avanade-connect.json"');
    res.json(dados);
  });

  router.post('/profile/deletion', autenticar, async (req, res) => {
    const { confirm_email: email } = corpoExclusao.parse(req.body);
    res.json(await solicitarExclusao(banco, req.usuario.id, email));
  });

  router.post('/profile/deletion/cancel', autenticar, async (req, res) => {
    await cancelarExclusao(banco, req.usuario.id);
    res.json(await montarPerfil(ctx, req.usuario.id));
  });

  router.delete('/profile', autenticar, async (req, res) => {
    await excluirPerfil(banco, req.usuario.id);
    res.status(204).end();
  });

  router.get('/tags', autenticar, async (req, res) => {
    const { category: categoria } = consultaTags.parse(req.query);
    res.json({ tags: await listarTags(banco, categoria) });
  });

  router.post('/tags', autenticar, async (req, res) => {
    const { name, category } = corpoTag.parse(req.body);
    const tag = await garantirTag(banco.query, name, category);
    acionarVetorizador(ctx);
    res.status(201).json(tag);
  });

  return router;
}
