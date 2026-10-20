import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { invalido } from '../utils/erros.js';

const scryptAsync = promisify(scrypt);

export const SENHA_MINIMA = 10;
export const SENHA_MAXIMA = 128;

// Custo do scrypt na configuração mínima recomendada pelo OWASP (32 MiB de memória, 3 de paralelismo).
// O custo vai junto do hash guardado, então pode mudar no futuro sem invalidar senhas antigas.
const CUSTO_PADRAO = { N: 2 ** 15, r: 8, p: 3 };
const TAMANHO_CHAVE = 64;

const memoriaNecessaria = ({ N, r, p }) => 128 * N * r * p + 1024 * 1024;

// Hash de senha com scrypt, sem dependência externa. Formato: scrypt$N$r$p$sal$hash (base64).
export function criarSenhas(custo = CUSTO_PADRAO) {
  async function derivar(senha, sal, parametros) {
    return scryptAsync(senha.normalize('NFKC'), sal, TAMANHO_CHAVE, {
      N: parametros.N,
      r: parametros.r,
      p: parametros.p,
      maxmem: memoriaNecessaria(parametros),
    });
  }

  async function gerarHash(senha) {
    const sal = randomBytes(16);
    const chave = await derivar(senha, sal, custo);
    return ['scrypt', custo.N, custo.r, custo.p, sal.toString('base64'), chave.toString('base64')].join('$');
  }

  async function conferir(senha, guardado) {
    const [tipo, N, r, p, sal, esperado] = String(guardado).split('$');
    if (tipo !== 'scrypt' || !esperado) return false;
    const parametros = { N: Number(N), r: Number(r), p: Number(p) };
    if (![parametros.N, parametros.r, parametros.p].every(Number.isInteger)) return false;
    // Recusa custos absurdos, que um valor corrompido no banco poderia usar para travar o servidor.
    if (parametros.N > 2 ** 20 || parametros.r > 32 || parametros.p > 16) return false;
    const esperadoBytes = Buffer.from(esperado, 'base64');
    const obtido = await derivar(senha, Buffer.from(sal, 'base64'), parametros);
    return obtido.length === esperadoBytes.length && timingSafeEqual(obtido, esperadoBytes);
  }

  return { gerarHash, conferir };
}

// Regras da senha nova: tamanho e não repetir o e-mail. Quanto mais longa, melhor; não há exigência
// de símbolos, porque ela empurra para senhas curtas e previsíveis.
export function validarSenhaNova(senha, email) {
  if (typeof senha !== 'string' || senha.length < SENHA_MINIMA) {
    throw invalido('SENHA_FRACA', `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`);
  }
  if (senha.length > SENHA_MAXIMA) {
    throw invalido('SENHA_FRACA', `A senha pode ter no máximo ${SENHA_MAXIMA} caracteres.`);
  }
  const minuscula = senha.toLowerCase();
  const usuario = String(email ?? '')
    .toLowerCase()
    .split('@')[0];
  if (minuscula === String(email ?? '').toLowerCase() || (usuario.length >= 4 && minuscula === usuario)) {
    throw invalido('SENHA_FRACA', 'A senha não pode ser igual ao seu e-mail.');
  }
  if (new Set(senha).size < 4) {
    throw invalido('SENHA_FRACA', 'A senha é repetitiva demais. Misture mais caracteres.');
  }
}
