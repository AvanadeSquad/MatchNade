import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { promisify } from 'node:util';
import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { ErroApi, naoAutenticado, proibido } from '../utils/erros.js';

// Único algoritmo aceito: impede que um token com outro algoritmo (none, HS512, RS256) seja validado.
const ALGORITMO = 'HS256';
const scrypt = promisify(scryptCallback);

// Erros seguidos na resposta de segurança antes de bloquear a recuperação da conta, e por quanto tempo.
export const TENTATIVAS_RECUPERACAO_MAX = 5;
export const BLOQUEIO_RECUPERACAO_MINUTOS = 15;

// Erros seguidos de senha antes de bloquear o login da conta, e por quanto tempo.
export const TENTATIVAS_LOGIN_MAX = 5;
export const BLOQUEIO_LOGIN_MINUTOS = 15;

// Colunas de contagem e bloqueio de cada fluxo. Os nomes vêm só desta tabela, nunca da requisição.
const CONTROLES_DE_TENTATIVA = Object.freeze({
  login: {
    contador: 'login_failed_attempts',
    bloqueio: 'login_locked_until',
    maximo: TENTATIVAS_LOGIN_MAX,
    minutos: BLOQUEIO_LOGIN_MINUTOS,
  },
  recuperacao: {
    contador: 'recovery_failed_attempts',
    bloqueio: 'recovery_locked_until',
    maximo: TENTATIVAS_RECUPERACAO_MAX,
    minutos: BLOQUEIO_RECUPERACAO_MINUTOS,
  },
});

export const estaBloqueada = (bloqueadaAte) => Boolean(bloqueadaAte) && new Date(bloqueadaAte) > new Date();

// Conta um erro de forma atômica: ao chegar no limite, zera o contador e bloqueia por alguns minutos.
export async function registrarTentativaFalha(banco, funcionarioId, fluxo) {
  const { contador, bloqueio, maximo, minutos } = CONTROLES_DE_TENTATIVA[fluxo];
  await banco.query(
    `UPDATE employee
        SET ${contador} = CASE WHEN ${contador} + 1 >= $2 THEN 0 ELSE ${contador} + 1 END,
            ${bloqueio} = CASE WHEN ${contador} + 1 >= $2 THEN NOW() + make_interval(mins => $3) ELSE ${bloqueio} END
      WHERE id = $1`,
    [funcionarioId, maximo, minutos],
  );
}

export async function gerarHashSenha(senha) {
  const salt = randomBytes(16);
  const derivada = await scrypt(senha, salt, 64);
  return `scrypt$${salt.toString('hex')}$${Buffer.from(derivada).toString('hex')}`;
}

export async function verificarHash(valor, hash) {
  if (!hash || typeof hash !== 'string') return false;
  const [algoritmo, saltHex, derivadaHex] = hash.split('$');
  if (algoritmo !== 'scrypt' || !saltHex || !derivadaHex) return false;
  try {
    const derivada = Buffer.from(await scrypt(valor, Buffer.from(saltHex, 'hex'), 64));
    const esperada = Buffer.from(derivadaHex, 'hex');
    return derivada.length === esperada.length && timingSafeEqual(derivada, esperada);
  } catch {
    return false;
  }
}

// Hash de uma senha qualquer: contas inexistentes passam pela mesma verificação custosa,
// para o tempo de resposta não revelar se o e-mail tem cadastro.
const hashFicticio = gerarHashSenha('hash-ficticio-para-igualar-o-tempo');
export const verificarContraFicticio = async (valor) => verificarHash(valor, await hashFicticio);

export const PERGUNTAS_SEGURANCA = Object.freeze([
  { id: 'primeiro_pet', pergunta: 'Qual era o nome do seu primeiro animal de estimação?' },
  { id: 'cidade_nascimento', pergunta: 'Em qual cidade você nasceu?' },
  { id: 'primeira_escola', pergunta: 'Qual era o nome da sua primeira escola?' },
  { id: 'apelido_infancia', pergunta: 'Qual era seu apelido na infância?' },
  { id: 'professor', pergunta: 'Qual era o sobrenome de um professor marcante?' },
]);

export const normalizarRespostaSeguranca = (resposta) =>
  String(resposta ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

// Pergunta de aparência real, sempre a mesma para o mesmo e-mail, devolvida quando a conta não existe
// ou não tem pergunta: quem consulta não distingue esses casos de uma conta com recuperação ativa.
export function perguntaFicticia(email, segredo) {
  const indice = createHmac('sha256', segredo).update(email).digest().readUInt32BE(0) % PERGUNTAS_SEGURANCA.length;
  return PERGUNTAS_SEGURANCA[indice].pergunta;
}

// Emite o JWT da pessoa com a versão de sessão atual. Redefinir a senha incrementa a versão
// e invalida os tokens emitidos antes.
export async function emitirToken({ banco, autenticacao }, funcionarioId) {
  const [linha] = await banco.query('SELECT token_version FROM employee WHERE id = $1', [funcionarioId]);
  return autenticacao.assinar(funcionarioId, linha?.token_version ?? 0);
}

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
    assinar: (funcionarioId, versao = 0) =>
      jwt.sign({ sub: String(funcionarioId), ver: versao }, config.jwtSecret, { algorithm: ALGORITMO, expiresIn: config.jwtExpiresIn }),

    // Devolve o id e a versão de sessão do token, ou lança 401. Token sem versão vale como 0.
    verificarComVersao(token) {
      try {
        const payload = jwt.verify(token, config.jwtSecret, { algorithms: [ALGORITMO] });
        const id = Number.parseInt(payload.sub, 10);
        if (!Number.isInteger(id)) throw new Error('sub inválido');
        return { id, versao: Number.isInteger(payload.ver) ? payload.ver : 0 };
      } catch {
        throw naoAutenticado('Sessão expirada. Entre novamente.');
      }
    },

    // Devolve o id do funcionário ou lança 401.
    verificar(token) {
      return this.verificarComVersao(token).id;
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
