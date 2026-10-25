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

// Dados pessoais sensíveis (LGPD, art. 5º, II): origem racial ou étnica, convicção religiosa, opinião
// política, filiação a sindicato ou a organização religiosa, filosófica ou política, saúde, vida sexual,
// dado genético ou biométrico. A IA não pode extrair nem repetir estes temas a partir da bio.
// Critério: o filtro procura termos que revelam algo sobre a pessoa (posição, crença, condição), não
// termos de setor ou de técnica. "Política de privacidade", "Saúde digital", "Biometria" e "Eleições"
// como domínio de sistemas passam. Na dúvida, o termo fica de fora para não barrar interesse legítimo.
// Termos em minúsculas e sem acento, casados como palavra ou expressão inteira.
// Só a saída da IA passa por este filtro: o que a própria pessoa digita na revisão fica sob o controle dela.
// prettier-ignore
const DADOS_SENSIVEIS = [
  // Opinião política e filiação partidária. "politica" e "partido" soltos ficam de fora: aparecem em
  // "Política de segurança", "Partido alto" e "Coração partido".
  'opiniao politica', 'opinioes politicas', 'orientacao politica', 'posicao politica', 'ideologia politica',
  'militancia politica', 'militante politico', 'militante politica', 'ativismo politico', 'ativista politico',
  'partido politico', 'partidos politicos', 'filiado a partido', 'filiada a partido', 'filiacao partidaria',
  'comunismo', 'comunista', 'socialismo', 'socialista', 'fascismo', 'fascista', 'anarquismo', 'anarquista',
  // Convicção religiosa, crenças e quem as pratica.
  'religiao', 'religioes', 'religioso', 'religiosa', 'religiosidade', 'crenca religiosa', 'igreja', 'igrejas',
  'cristao', 'crista', 'cristaos', 'cristianismo', 'evangelico', 'evangelica', 'evangelicos', 'protestante',
  'catolico', 'catolica', 'catolicos', 'catolicismo', 'espirita', 'espiritismo', 'umbanda', 'candomble',
  'ateu', 'ateia', 'ateus', 'ateismo', 'agnostico', 'agnostica', 'budismo', 'budista', 'islamismo', 'islam',
  'muculmano', 'muculmana', 'judaismo', 'judeu', 'judia', 'judaico', 'hinduismo', 'hindu', 'biblia',
  'gospel', 'missa', 'culto religioso', 'maconaria', 'pastor(?! alem)', 'padre', 'terreiro',
  // Saúde e deficiência: condições e tratamentos. Palavras como "saude", "doenca", "terapia", "cirurgia",
  // "medicamento", "deficiencia" e "pcd" soltas ficam de fora, porque aparecem como setor ou técnica
  // ("Doenças tropicais", "Cirurgia robótica", "Inclusão de PCD"); entram expressões que falam da pessoa.
  'saude mental', 'condicao de saude', 'problema de saude', 'problemas de saude', 'estado de saude',
  'depressao', 'depressivo', 'depressiva', 'ansiedade', 'transtorno', 'transtornos', 'transtorno bipolar',
  'bipolar', 'toc', 'esquizofrenia', 'epilepsia', 'alcoolismo', 'alzheimer',
  'cancer', 'hiv', 'aids', 'diabetes', 'diabetico', 'diabetica', 'autismo', 'autista', 'tdah',
  'psiquiatra', 'psiquiatrico', 'quimioterapia', 'tratamento medico', 'em tratamento', 'faco terapia',
  'faco tratamento', 'tenho doenca', 'tenho uma doenca', 'tomo remedio', 'tomo remedios', 'tomo medicamento',
  'tomo medicamentos', 'gravidez', 'gravida', 'gestante',
  'pessoa com deficiencia', 'pessoas com deficiencia', 'tenho deficiencia', 'tenho uma deficiencia', 'sou pcd',
  'cadeirante', 'surdez', 'cegueira', 'sindrome de down',
  // Orientação sexual, vida sexual e identidade de gênero.
  'orientacao sexual', 'vida sexual', 'identidade de genero', 'lgbt', 'lgbtq', 'lgbtqi', 'lgbtqia',
  'gay', 'gays', 'lesbica', 'lesbicas', 'bissexual', 'bissexuais', 'homossexual', 'homossexuais',
  'heterossexual', 'transexual', 'transgenero', 'travesti', 'queer', 'nao binario', 'nao binaria',
  'pessoa trans', 'pessoas trans', 'mulher trans', 'homem trans',
  // Origem racial ou étnica.
  // "raca" solta fica de fora ("Raças de cães"); entram expressões que falam da pessoa.
  'origem racial', 'origem etnica', 'minha raca', 'pessoa de raca', 'racial', 'etnia', 'etnias', 'etnico', 'etnica',
  'cor da pele', 'pessoa negra', 'pessoas negras', 'pessoa parda', 'origem indigena', 'movimento negro',
  // "negro", "indígena" e "quilombola" soltos ficam de fora: aparecem em "Cerveja negra", "Arte indígena"
  // e "Comunidades quilombolas" como interesse cultural ou trabalho voluntário.
  // Filiação a sindicato.
  'sindicato', 'sindicatos', 'sindical', 'sindicalizado', 'sindicalizada', 'filiacao sindical',
  // Dado genético ou biométrico da pessoa. "Biometria" como competência técnica passa.
  'dado genetico', 'dados geneticos', 'teste genetico', 'dado biometrico', 'dados biometricos',
];
const PADRAO_SENSIVEL = new RegExp(`(?:^|[^a-z0-9])(?:${DADOS_SENSIVEIS.join('|')})(?:[^a-z0-9]|$)`);

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

// Verdadeiro se o texto toca em dado pessoal sensível (opinião política, religião, saúde, deficiência, orientação
// sexual, identidade de gênero, origem racial ou étnica, sindicato, dado genético ou biométrico).
export function mencionaDadoSensivel(texto) {
  const semAcento = String(texto ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    // Hífen, barra e sublinhado viram espaço: "Saúde-mental" e "Não-binário" casam com as expressões.
    .replace(/[-/_]/g, ' ');
  return PADRAO_SENSIVEL.test(semAcento);
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
