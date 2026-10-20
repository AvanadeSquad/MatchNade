import { Router } from 'express';
import { z } from 'zod';
import { montarPerfil, obterOuCriarPorGoogle } from '../services/perfil.js';
import { SENHA_MAXIMA } from '../services/senhas.js';

export const corpoGoogle = z.object({ credential: z.string().min(10) });

export const corpoLoginSenha = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  senha: z.string().min(1).max(SENHA_MAXIMA),
});

export const corpoDefinirSenha = z.object({
  senha_atual: z.string().max(SENHA_MAXIMA).optional(),
  nova_senha: z.string().max(SENHA_MAXIMA),
});

// Login com Google ou com e-mail e senha: valida a credencial e devolve o JWT. No Google, a pessoa
// é criada no primeiro acesso. A senha é definida depois, por quem já está logado.
export function rotasAuth(ctx, autenticar) {
  const router = Router();

  async function sessao(id, extra = {}) {
    await ctx.banco.query('UPDATE employee SET last_seen_at = COALESCE(last_seen_at, NOW()) WHERE id = $1', [id]);
    return { token: ctx.autenticacao.assinar(id), employee: await montarPerfil(ctx, id), ...extra };
  }

  router.post('/auth/google', async (req, res) => {
    const { credential } = corpoGoogle.parse(req.body);
    const identidade = await ctx.autenticacao.identificarPorGoogle(credential);
    const { id, novo } = await obterOuCriarPorGoogle(ctx.banco, identidade);
    res.json(await sessao(id, { is_new: novo }));
  });

  router.post('/auth/senha', async (req, res) => {
    const { email, senha } = corpoLoginSenha.parse(req.body);
    const id = await ctx.credenciais.entrarComSenha(email, senha);
    res.json(await sessao(id, { is_new: false }));
  });

  router.put('/auth/senha', autenticar, async (req, res) => {
    const { senha_atual: senhaAtual, nova_senha: novaSenha } = corpoDefinirSenha.parse(req.body);
    await ctx.credenciais.definirSenha(req.usuario.id, { senhaAtual, novaSenha });
    res.json({ has_password: true });
  });

  return router;
}
