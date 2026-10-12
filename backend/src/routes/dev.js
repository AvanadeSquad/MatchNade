import { Router } from 'express';
import { z } from 'zod';
import { ErroApi } from '../utils/erros.js';
import { montarPerfil, obterOuCriarPorGoogle } from '../services/perfil.js';

const corpoEmail = z.object({ email: z.string().trim().toLowerCase().email() });

// Rotas de apoio ao desenvolvimento e aos testes de ponta a ponta. Só são registradas
// quando AUTH_DEV_LOGIN ou E2E_TEST_MODE está ativo, e a configuração recusa ambos em produção.
export function rotasDev(ctx) {
  const router = Router();

  async function entrar(email) {
    const [existente] = await ctx.banco.query('SELECT id FROM employee WHERE email = $1 AND is_active', [email]);
    const id = existente?.id ?? (await obterOuCriarPorGoogle(ctx.banco, { sub: `dev-${email}`, email, nome: null })).id;
    return { token: ctx.autenticacao.assinar(id), employee: await montarPerfil(ctx, id) };
  }

  if (ctx.config.authDevLogin) {
    router.get('/auth/dev-users', async (_req, res) => {
      const usuarios = await ctx.banco.query('SELECT name, email FROM employee WHERE is_active ORDER BY id LIMIT 50');
      res.json({ users: usuarios });
    });
    router.post('/auth/dev-login', async (req, res) => {
      const { email } = corpoEmail.parse(req.body);
      if (!ctx.autenticacao.emailPermitido(email)) throw new ErroApi(403, 'EMAIL_NAO_LIBERADO', 'Seu e-mail ainda não está liberado.');
      res.json(await entrar(email));
    });
  }

  if (ctx.config.e2eTestMode) {
    router.post('/test/login', async (req, res) => {
      const { email } = corpoEmail.parse(req.body);
      res.json(await entrar(email));
    });
  }

  return router;
}
