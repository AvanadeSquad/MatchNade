// Busca no catálogo de tags já carregado, sem chamar a API.

// Minúsculas, sem acentos e com espaços repetidos reduzidos a um: "Café  Especial" vira "cafe especial".
export function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Forma usada para detectar a mesma tag escrita de outro jeito: além de normalizar, ignora espaços,
// pontos e hífens, para "nodejs", "node js" e "Node.js" serem iguais.
export function chaveDeComparacao(texto) {
  return normalizar(texto).replace(/[\s.-]/g, '');
}

// Sugestões para o texto digitado: casam em qualquer posição do nome. Primeiro as que começam com o
// texto, depois as que só o contêm; em cada grupo, mais usadas primeiro e depois em ordem alfabética.
// `uso` é um Map do nome em minúsculas para a quantidade de pessoas; sem ele, o uso vale 0.
export function sugerirTags(catalogo, texto, { uso = new Map(), selecionadas = new Map(), limite = 6 } = {}) {
  const busca = normalizar(texto);
  if (!busca) return [];
  const candidatas = [];
  for (const nome of catalogo) {
    if (selecionadas.has(nome.toLowerCase())) continue;
    const posicao = normalizar(nome).indexOf(busca);
    if (posicao < 0) continue;
    candidatas.push({ nome, comeca: posicao === 0, uso: uso.get(nome.toLowerCase()) ?? 0 });
  }
  candidatas.sort((a, b) => Number(b.comeca) - Number(a.comeca) || b.uso - a.uso || a.nome.localeCompare(b.nome, 'pt-BR'));
  return candidatas.slice(0, limite).map((c) => c.nome);
}

// Divide o nome em trechos para destacar a parte que casou com o texto. A comparação ignora acentos e
// maiúsculas, mas os trechos mantêm a grafia original. Funciona porque normalizar não muda a
// quantidade de letras de um nome sem espaços repetidos, que é o caso dos nomes do catálogo.
export function trechosDestacados(nome, texto) {
  const busca = normalizar(texto);
  const posicao = normalizar(nome).indexOf(busca);
  if (!busca || posicao < 0 || normalizar(nome).length !== nome.length) return [{ texto: nome, destaque: false }];
  return [
    { texto: nome.slice(0, posicao), destaque: false },
    { texto: nome.slice(posicao, posicao + busca.length), destaque: true },
    { texto: nome.slice(posicao + busca.length), destaque: false },
  ].filter((t) => t.texto);
}

// Distância de edição entre dois textos: inserir, remover ou trocar uma letra conta 1, e inverter duas
// letras vizinhas também conta 1, para "Pyhton" ficar a uma edição de "Python".
export function distanciaDeEdicao(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j += 1) d[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + custo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

// Procura no catálogo a tag equivalente ao texto. Devolve { tipo: 'igual' | 'parecida', nome } ou null.
// Igual: mesma chave de comparação. Parecida: diferença de uma letra, só em termos de 4 letras ou mais,
// para não confundir siglas curtas como "Go" e "Git".
export function encontrarEquivalente(catalogo, texto) {
  const chave = chaveDeComparacao(texto);
  if (!chave) return null;
  const igual = catalogo.find((nome) => chaveDeComparacao(nome) === chave);
  if (igual) return { tipo: 'igual', nome: igual };
  if (chave.length < 4) return null;
  const parecida = catalogo.find((nome) => {
    const outra = chaveDeComparacao(nome);
    return outra.length >= 4 && Math.abs(outra.length - chave.length) <= 1 && distanciaDeEdicao(outra, chave) <= 1;
  });
  return parecida ? { tipo: 'parecida', nome: parecida } : null;
}
