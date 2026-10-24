import { ErroApi, naoAutenticado, proibido } from '../utils/erros.js';
import { validarSenhaNova } from './senhas.js';

export const MAXIMO_DE_FALHAS = 5;
export const BLOQUEIO_SEGUNDOS = 15 * 60;

const MENSAGEM_GENERICA = 'E-mail ou senha incorretos, ou muitas tentativas seguidas. Tente de novo em alguns minutos.';

// Login por senha e troca de senha. A senha é uma credencial a mais de quem já tem conta: ela é
// definida depois do primeiro acesso por SSO, porque criar conta só com e-mail e senha deixaria
// qualquer pessoa registrar o e-mail de outra antes dela.
export function criarCredenciais({ banco, senhas, autenticacao }) {
  // Hash de uma senha qualquer, usado para gastar o mesmo tempo quando a conta não existe ou está
  // bloqueada. Assim o tempo de resposta não revela se o e-mail tem conta com senha.
  let hashDeCusto;
  const custoFalso = async (senha) => {
    hashDeCusto ??= senhas.gerarHash('senha-que-ninguem-usa');
    await senhas.conferir(senha, await hashDeCusto);
  };

  async function registrarFalha(id) {
    await banco.query(
      `UPDATE employee
          SET password_failures = password_failures + 1,
              password_locked_until = CASE WHEN password_failures + 1 >= $2
                                           THEN NOW() + make_interval(secs => $3) ELSE password_locked_until END
        WHERE id = $1`,
      [id, MAXIMO_DE_FALHAS, BLOQUEIO_SEGUNDOS],
    );
  }

  const bloqueada = (conta) => conta.password_locked_until && new Date(conta.password_locked_until) > new Date();

  return {
    // Devolve o id da pessoa ou lança 401 com uma mensagem que não diferencia o motivo da recusa.
    async entrarComSenha(emailBruto, senha) {
      const email = String(emailBruto).trim().toLowerCase();
      const [conta] = await banco.query(
        `SELECT id, password_hash, password_failures, password_locked_until
           FROM employee WHERE LOWER(email) = $1 AND is_active`,
        [email],
      );
      if (!conta?.password_hash || !autenticacao.emailPermitido(email) || bloqueada(conta)) {
        await custoFalso(senha);
        throw naoAutenticado(MENSAGEM_GENERICA);
      }
      if (!(await senhas.conferir(senha, conta.password_hash))) {
        await registrarFalha(conta.id);
        throw naoAutenticado(MENSAGEM_GENERICA);
      }
      await banco.query('UPDATE employee SET password_failures = 0, password_locked_until = NULL WHERE id = $1', [conta.id]);
      return conta.id;
    },

    // Define a senha de quem já está logado. Quem já tem senha precisa informar a atual.
    async definirSenha(id, { senhaAtual, novaSenha }) {
      const [conta] = await banco.query(
        'SELECT email, password_hash, password_failures, password_locked_until FROM employee WHERE id = $1 AND is_active',
        [id],
      );
      if (!conta) throw naoAutenticado();
      if (conta.password_hash) {
        if (bloqueada(conta)) throw new ErroApi(429, 'MUITAS_TENTATIVAS', 'Muitas tentativas seguidas. Tente de novo em alguns minutos.');
        if (!senhaAtual || !(await senhas.conferir(senhaAtual, conta.password_hash))) {
          await registrarFalha(id);
          throw proibido('SENHA_ATUAL_INCORRETA', 'A senha atual não confere.');
        }
      }
      validarSenhaNova(novaSenha, conta.email);
      const hash = await senhas.gerarHash(novaSenha);
      await banco.query('UPDATE employee SET password_hash = $2, password_failures = 0, password_locked_until = NULL WHERE id = $1', [
        id,
        hash,
      ]);
    },
  };
}
