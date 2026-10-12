import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { ErroApi, naoAutenticado, proibido } from '../utils/erros.js';

// Único algoritmo aceito: impede que um token com outro algoritmo (none, HS512, RS256) seja validado.
const ALGORITMO = 'HS256';

// Tokens de sessão (JWT) e verificação do login com Google.
export function criarAutenticacao(config, verificadorGoogle) {
  const cliente = config.google.clientId ? new OAuth2Client(config.google.clientId) : null;

  const verificarCredencial =
    verificadorGoogle ??
    (async (credencial) => {
      if (!cliente) throw new ErroApi(503, 'GOOGLE_NAO_CONFIGURADO', 'O login com Google não está configurado.');
      try {
        const ticket = await cliente.verifyIdToken({ idToken: credencial, audience: config.google.clientId });
        return ticket.getPayload();
      } catch {
        throw naoAutenticado('Não foi possível validar o login com Google.');
      }
    });

  return {
    assinar: (funcionarioId) =>
      jwt.sign({ sub: String(funcionarioId) }, config.jwtSecret, { algorithm: ALGORITMO, expiresIn: config.jwtExpiresIn }),

    // Devolve o id do funcionário ou lança 401.
    verificar(token) {
      try {
        const payload = jwt.verify(token, config.jwtSecret, { algorithms: [ALGORITMO] });
        const id = Number.parseInt(payload.sub, 10);
        if (!Number.isInteger(id)) throw new Error('sub inválido');
        return id;
      } catch {
        throw naoAutenticado('Sessão expirada. Entre novamente.');
      }
    },

    // Valida o token do Google e confere se o e-mail está liberado.
    async identificarPorGoogle(credencial) {
      let dados;
      try {
        dados = await verificarCredencial(credencial);
      } catch (erro) {
        if (erro instanceof ErroApi) throw erro;
        throw naoAutenticado('Não foi possível validar o login com Google.');
      }
      // Só aceita e-mail que o Google confirma como verificado; campo ausente também é recusado.
      if (!dados?.email || dados.email_verified !== true) throw naoAutenticado('E-mail do Google não verificado.');
      const email = dados.email.toLowerCase();
      if (!this.emailPermitido(email)) {
        throw proibido('EMAIL_NAO_LIBERADO', 'Seu e-mail ainda não está liberado.');
      }
      return { sub: dados.sub, email, nome: dados.name };
    },

    emailPermitido(email) {
      const { emailsPermitidos, dominiosPermitidos } = config;
      if (!emailsPermitidos.length && !dominiosPermitidos.length) return true;
      return emailsPermitidos.includes(email) || dominiosPermitidos.includes(email.split('@')[1]);
    },
  };
}
