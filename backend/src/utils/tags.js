// Termos genéricos que não identificam um interesse.
// prettier-ignore
const GENERICAS = new Set([
  'empresa', 'tecnologia', 'trabalho', 'projeto', 'projetos', 'equipe', 'time', 'area', 'área',
  'profissional', 'carreira', 'pessoas', 'tudo', 'coisas', 'vida',
]);

// Siglas curtas de cargo ou nível. Só bloqueiam quando são a tag inteira, para não barrar PL/SQL, por exemplo.
const SIGLAS_HIERARQUIA = new Set(['cto', 'ceo', 'cfo', 'vp', 'jr', 'pl', 'sr']);

// Cargo, senioridade e tempo de casa nunca viram tag: o produto não filtra,
// pontua nem exibe hierarquia.
// prettier-ignore
const HIERARQUIA = new Set([
  'gerente', 'diretor', 'diretora', 'coordenador', 'coordenadora', 'supervisor', 'supervisora',
  'lider', 'líder', 'head', 'presidente', 'estagiario', 'estagiário', 'trainee', 'junior', 'júnior',
  'pleno', 'senior', 'sênior', 'especialista', 'analista', 'consultor', 'consultora', 'arquiteto',
  'arquiteta', 'chefe', 'socio', 'sócio', 'lead', 'manager', 'director', 'intern', 'staff', 'principal',
  'associate', 'partner', 'executive', 'chief', 'president',
]);

const OFENSIVAS = new Set(['porra', 'merda', 'caralho', 'puta', 'foda', 'idiota', 'burro']);

const PADRAO_VALIDO = /^[\p{L}\p{N}][\p{L}\p{N} .+#&/'’-]*$/u;

export const limparTexto = (texto) =>
  String(texto ?? '')
    .replace(/\s+/g, ' ')
    .trim();

// Devolve a tag normalizada ou null quando inválida.
export function normalizarTag(nome) {
  const limpo = limparTexto(nome);
  if (limpo.length < 2 || limpo.length > 40) return null;
  if (!PADRAO_VALIDO.test(limpo)) return null;
  const palavras = limpo.toLowerCase().split(/[\s/&-]+/);
  if (SIGLAS_HIERARQUIA.has(limpo.toLowerCase())) return null;
  if (palavras.some((p) => HIERARQUIA.has(p) || OFENSIVAS.has(p))) return null;
  if (GENERICAS.has(limpo.toLowerCase())) return null;
  return limpo;
}

// Verdadeiro se o texto cita cargo, senioridade ou hierarquia.
export function mencionaHierarquia(texto) {
  const palavras = String(texto)
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u);
  return palavras.some((p) => HIERARQUIA.has(p) || SIGLAS_HIERARQUIA.has(p) || ['hierarquia', 'chefe', 'subordinado'].includes(p));
}

// Remove duplicatas ignorando maiúsculas e mantém a primeira grafia.
export function unicas(tags) {
  const vistas = new Set();
  return tags.filter((tag) => {
    const chave = tag.toLowerCase();
    if (vistas.has(chave)) return false;
    vistas.add(chave);
    return true;
  });
}
