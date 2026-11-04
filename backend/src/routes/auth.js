import { Router } from 'express';
import { z } from 'zod';
import { montarPerfil, obterOuCriarPorGoogle } from '../services/perfil.js';
import { conflito, naoAutenticado, proibido } from '../utils/erros.js';
import {
  BLOQUEIO_RECUPERACAO_MINUTOS,
  PERGUNTAS_SEGURANCA,
  TENTATIVAS_RECUPERACAO_MAX,
  emitirToken,
  gerarHashSenha,
  normalizarRespostaSeguranca,
  perguntaFicticia,
  verificarContraFicticio,
  verificarHash,
} from '../services/autenticacao.js';

const EMAIL_JA_CADASTRADO = 'Este e-mail já possui cadastro. Entre ou use a recuperação de senha.';

const emailSchema = z.string().trim().toLowerCase().email().max(254);
const senhaSchema = z.string().min(10, 'A senha deve ter pelo menos 10 caracteres.').max(128);
export const corpoGoogle = z.object({ credential: z.string().min(10) });
export const corpoCadastroLocal = z.object({
  name: z.string().trim().min(2).max(100),
  email: emailSchema,
  password: senhaSchema,
  security_question_id: z.enum(PERGUNTAS_SEGURANCA.map((p) => p.id)),
  security_answer: z.string().trim().min(2).max(200),
});
export const corpoLoginLocal = z.object({ email: emailSchema, password: z.string().min(1).max(128) });
export const corpoPerguntaRecuperacao = z.object({ email: emailSchema });
export const corpoRedefinirSenha = z.object({
  email: emailSchema,
  security_answer: z.string().trim().min(1).max(200),
  new_password: senhaSchema,
});

export function rotasAuth(ctx) {
  const router = Router();

  router.get('/auth/security-questions', (_req, res) => res.json({ questions: PERGUNTAS_SEGURANCA }));

  router.post('/auth/register', async (req, res) => {
    const dados = corpoCadastroLocal.parse(req.body);
    if (!ctx.autenticacao.emailPermitido(dados.email)) throw proibido('EMAIL_NAO_LIBERADO', 'Seu e-mail ainda não está liberado.');
    const [existente] = await ctx.banco.query('SELECT id FROM employee WHERE LOWER(email) = LOWER($1)', [dados.email]);
    if (existente) throw conflito('EMAIL_JA_CADASTRADO', EMAIL_JA_CADASTRADO);
    const pergunta = PERGUNTAS_SEGURANCA.find((p) => p.id === dados.security_question_id);
    const senhaHash = await gerarHashSenha(dados.password);
    const respostaHash = await gerarHashSenha(normalizarRespostaSeguranca(dados.security_answer));
    const authId = `local:${dados.email}`;
    let criado;
    try {
      [criado] = await ctx.banco.query(
        `INSERT INTO employee (auth_provider_id, name, email, password_hash, security_question_id, security_answer_hash)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [authId, dados.name, dados.email, senhaHash, pergunta.id, respostaHash],
      );
    } catch (erro) {
      // Dois cadastros simultâneos do mesmo e-mail: o segundo cai na restrição de unicidade.
      if (erro.code === '23505') throw conflito('EMAIL_JA_CADASTRADO', EMAIL_JA_CADASTRADO);
      throw erro;
    }
    const id = criado.id;
    res.status(201).json({ token: await emitirToken(ctx, id), employee: await montarPerfil(ctx, id), is_new: true });
  });

  router.post('/auth/login', async (req, res) => {
    const { email, password } = corpoLoginLocal.parse(req.body);
    const [funcionario] = await ctx.banco.query('SELECT id, password_hash, is_active FROM employee WHERE LOWER(email) = LOWER($1)', [
      email,
    ]);
    // Conta inexistente ou sem senha local passa pela mesma verificação custosa: o tempo não revela o cadastro.
    const valido = funcionario?.password_hash
      ? await verificarHash(password, funcionario.password_hash)
      : (await verificarContraFicticio(password), false);
    if (!valido || !funcionario?.is_active) throw naoAutenticado('E-mail ou senha incorretos.');
    await ctx.banco.query('UPDATE employee SET last_seen_at = NOW() WHERE id = $1', [funcionario.id]);
    res.json({ token: await emitirToken(ctx, funcionario.id), employee: await montarPerfil(ctx, funcionario.id), is_new: false });
  });

  // Sempre devolve uma pergunta e `available: true`. Para e-mail inexistente ou conta sem recuperação
  // local a pergunta é fictícia (fixa por e-mail) e a redefinição falha com a mensagem genérica,
  // então a resposta não revela quem tem cadastro.
  router.post('/auth/recovery-question', async (req, res) => {
    const { email } = corpoPerguntaRecuperacao.parse(req.body);
    const [funcionario] = await ctx.banco.query('SELECT security_question_id FROM employee WHERE LOWER(email) = LOWER($1) AND is_active', [
      email,
    ]);
    const pergunta = PERGUNTAS_SEGURANCA.find((p) => p.id === funcionario?.security_question_id);
    res.json({ question: pergunta?.pergunta ?? perguntaFicticia(email, ctx.config.jwtSecret), available: true });
  });

  router.post('/auth/reset-password', async (req, res) => {
    const { email, security_answer, new_password } = corpoRedefinirSenha.parse(req.body);
    const [funcionario] = await ctx.banco.query(
      `SELECT id, security_answer_hash, security_question_id, is_active, recovery_locked_until
         FROM employee WHERE LOWER(email) = LOWER($1)`,
      [email],
    );
    const falha = () => naoAutenticado('Não foi possível validar a recuperação. Confira os dados e tente novamente.');
    const respostaNormalizada = normalizarRespostaSeguranca(security_answer);
    const recuperavel = Boolean(funcionario?.is_active && funcionario.security_question_id && funcionario.security_answer_hash);
    // Durante o bloqueio nem a resposta certa vale, e a mensagem continua a genérica.
    const bloqueada = recuperavel && funcionario.recovery_locked_until && new Date(funcionario.recovery_locked_until) > new Date();
    const correta = recuperavel
      ? !bloqueada && (await verificarHash(respostaNormalizada, funcionario.security_answer_hash))
      : (await verificarContraFicticio(respostaNormalizada), false);
    if (!correta) {
      if (recuperavel && !bloqueada) {
        // Contagem atômica: ao chegar no limite zera o contador e bloqueia por alguns minutos.
        await ctx.banco.query(
          `UPDATE employee
              SET recovery_failed_attempts = CASE WHEN recovery_failed_attempts + 1 >= $2 THEN 0 ELSE recovery_failed_attempts + 1 END,
                  recovery_locked_until = CASE WHEN recovery_failed_attempts + 1 >= $2 THEN NOW() + make_interval(mins => $3) ELSE recovery_locked_until END
            WHERE id = $1`,
          [funcionario.id, TENTATIVAS_RECUPERACAO_MAX, BLOQUEIO_RECUPERACAO_MINUTOS],
        );
      }
      throw falha();
    }
    const passwordHash = await gerarHashSenha(new_password);
    // Aumentar a versão de sessão invalida os tokens emitidos antes da redefinição.
    await ctx.banco.query(
      `UPDATE employee
          SET password_hash = $1, recovery_failed_attempts = 0, recovery_locked_until = NULL, token_version = token_version + 1
        WHERE id = $2`,
      [passwordHash, funcionario.id],
    );
    res.json({ message: 'Senha redefinida. Você já pode entrar com a nova senha.' });
  });

  router.post('/auth/google', async (req, res) => {
    const { credential } = corpoGoogle.parse(req.body);
    const identidade = await ctx.autenticacao.identificarPorGoogle(credential);
    const { id, novo } = await obterOuCriarPorGoogle(ctx.banco, identidade);
    await ctx.banco.query('UPDATE employee SET last_seen_at = COALESCE(last_seen_at, NOW()) WHERE id = $1', [id]);
    res.json({ token: await emitirToken(ctx, id), employee: await montarPerfil(ctx, id), is_new: novo });
  });

  return router;
}
