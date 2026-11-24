import { describe, expect, it } from 'vitest';
import { calcularAfinidade, calcularIdf, jaccardPonderado, jaccardSuave } from '../src/services/afinidade.js';
import { chaveDoPar, cosseno, paresRelacionados, similaridadesEntreTags } from '../src/services/semantica.js';

// Ids: 1 Django, 2 FastAPI, 3 Python, 4 Xadrez. Vetores escolhidos à mão: os três primeiros apontam para o mesmo lado.
const TAGS = [
  { id: 1, embedding: [0.9, 0.3, 0] },
  { id: 2, embedding: [0.9, 0.2, 0.1] },
  { id: 3, embedding: [1, 0, 0] },
  { id: 4, embedding: [0, 0, 1] },
];
const NOMES = new Map([
  [1, { nome: 'Django', categoria: 'TECHNICAL' }],
  [2, { nome: 'FastAPI', categoria: 'TECHNICAL' }],
  [3, { nome: 'Python', categoria: 'TECHNICAL' }],
  [4, { nome: 'Xadrez', categoria: 'HOBBY' }],
]);
const idfUnico = new Map([1, 2, 3, 4].map((id) => [id, 1]));
const similares = similaridadesEntreTags(TAGS, 0.75);

describe('cosseno', () => {
  it('vale 1 para vetores na mesma direção e 0 para ortogonais', () => {
    expect(cosseno([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 10);
    expect(cosseno([1, 0], [0, 1])).toBe(0);
  });

  it('vetor zerado ou de tamanho diferente vale 0, nunca NaN', () => {
    expect(cosseno([0, 0], [1, 1])).toBe(0);
    expect(cosseno([1, 2], [1, 2, 3])).toBe(0);
    expect(cosseno(null, [1])).toBe(0);
  });
});

describe('similaridadesEntreTags', () => {
  it('guarda só os pares acima do limiar, com a chave menor:maior', () => {
    expect([...similares.keys()].sort()).toEqual(['1:2', '1:3', '2:3']);
    expect(similares.get(chaveDoPar(3, 1))).toBeGreaterThan(0.9);
  });

  it('Django e Python relacionam; Django e xadrez não', () => {
    expect(similares.has(chaveDoPar(1, 3))).toBe(true);
    expect(similares.has(chaveDoPar(1, 4))).toBe(false);
  });

  it('ignora tag sem vetor', () => {
    const parcial = similaridadesEntreTags([TAGS[0], { id: 9, embedding: null }, TAGS[2]], 0.75);
    expect([...parcial.keys()]).toEqual(['1:3']);
  });

  it('limiar mais alto deixa menos pares', () => {
    expect(similaridadesEntreTags(TAGS, 0.99).size).toBeLessThan(similares.size);
  });
});

describe('jaccardSuave', () => {
  it('coincide com o Jaccard exato quando não há tags parecidas', () => {
    const vazio = new Map();
    expect(jaccardSuave([1, 2], [2, 4], idfUnico, vazio)).toBeCloseTo(jaccardPonderado([1, 2], [2, 4], idfUnico), 10);
  });

  it('Django e FastAPI contra Python pontuam, enquanto o exato dá 0', () => {
    expect(jaccardPonderado([1, 2], [3], idfUnico)).toBe(0);
    const suave = jaccardSuave([1, 2], [3], idfUnico, similares);
    expect(suave).toBeGreaterThan(0.4);
    expect(suave).toBeLessThan(0.6);
  });

  it('é simétrico, nunca passa de 1 e perfis iguais valem 1', () => {
    expect(jaccardSuave([1, 2], [3], idfUnico, similares)).toBeCloseTo(jaccardSuave([3], [1, 2], idfUnico, similares), 10);
    expect(jaccardSuave([1, 2, 3], [1, 2, 3], idfUnico, similares)).toBe(1);
  });

  it('tags sem relação continuam valendo 0', () => {
    expect(jaccardSuave([1], [4], idfUnico, similares)).toBe(0);
  });

  it('um par exato vale mais que um par só parecido', () => {
    expect(jaccardSuave([3], [3], idfUnico, similares)).toBeGreaterThan(jaccardSuave([1], [3], idfUnico, similares));
  });
});

describe('calcularAfinidade com a correspondência parcial', () => {
  const idf = calcularIdf(10, new Map([1, 2, 3, 4].map((id) => [id, 2])));
  const ana = { tecnicas: [1, 2], hobbies: [4], unidade: 'A' };
  const bia = { tecnicas: [3], hobbies: [4], unidade: 'A' };

  it('sem a opção, o resultado é o de sempre', () => {
    const base = calcularAfinidade(ana, bia, idf);
    expect(calcularAfinidade(ana, bia, idf, 0.05, null)).toEqual(base);
    expect(calcularAfinidade(ana, bia, idf, 0.05, { similares: new Map(), peso: 0.5 })).toEqual(base);
  });

  it('com peso 0 também não muda nada', () => {
    expect(calcularAfinidade(ana, bia, idf, 0.05, { similares, peso: 0 })).toEqual(calcularAfinidade(ana, bia, idf));
  });

  it('com a opção, o eixo técnico sobe de 0 e o pessoal não muda', () => {
    const exato = calcularAfinidade(ana, bia, idf);
    const suave = calcularAfinidade(ana, bia, idf, 0.05, { similares, peso: 0.5 });
    expect(exato.tecnico).toBe(0);
    expect(suave.tecnico).toBeGreaterThan(0.1);
    expect(suave.pessoal).toBe(exato.pessoal);
    expect(suave.score).toBeGreaterThan(exato.score);
  });

  it('o peso 1 usa só o score suave e o 0,5 fica no meio', () => {
    const cheio = calcularAfinidade(ana, bia, idf, 0.05, { similares, peso: 1 }).tecnico;
    const meio = calcularAfinidade(ana, bia, idf, 0.05, { similares, peso: 0.5 }).tecnico;
    expect(cheio).toBeCloseTo(jaccardSuave(ana.tecnicas, bia.tecnicas, idf, similares), 10);
    expect(meio).toBeCloseTo(cheio / 2, 10);
  });
});

describe('paresRelacionados', () => {
  it('lista o par, o nome das tags e a similaridade, do mais parecido para o menos', () => {
    const pares = paresRelacionados([1, 2], [3], similares, NOMES);
    expect(pares.map((p) => [p.minha, p.dela])).toEqual([
      ['FastAPI', 'Python'],
      ['Django', 'Python'],
    ]);
    expect(pares[0].similaridade).toBeGreaterThan(pares[1].similaridade);
  });

  it('não repete tag em comum e não cria par sem relação', () => {
    expect(paresRelacionados([3], [3], similares, NOMES)).toEqual([]);
    expect(paresRelacionados([1], [4], similares, NOMES)).toEqual([]);
  });

  it('respeita o máximo pedido', () => {
    expect(paresRelacionados([1, 2], [3], similares, NOMES, 1)).toHaveLength(1);
  });
});
