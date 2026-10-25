import { describe, expect, it } from 'vitest';
import { chaveDeComparacao, distanciaDeEdicao, encontrarEquivalente, normalizar, sugerirTags, trechosDestacados } from './buscaTags.js';

describe('normalizar', () => {
  it('tira acentos, maiúsculas e espaços repetidos', () => {
    expect(normalizar('  Café   Especial ')).toBe('cafe especial');
  });
});

describe('sugerirTags', () => {
  const catalogo = ['Café especial', 'Fotografia', 'Python', 'Engenharia de dados', 'Dados abertos', 'Banco de dados'];

  it('busca sem acento e sem diferenciar maiúscula, em qualquer posição do nome', () => {
    expect(sugerirTags(catalogo, 'cafe')).toEqual(['Café especial']);
    expect(sugerirTags(catalogo, 'FOTOGRAFIA')).toEqual(['Fotografia']);
    expect(sugerirTags(catalogo, 'especial')).toEqual(['Café especial']);
  });

  it('ordena: começa com o texto, depois contém; em cada grupo, por uso e depois em ordem alfabética', () => {
    const uso = new Map([
      ['engenharia de dados', 1],
      ['banco de dados', 5],
    ]);
    expect(sugerirTags(catalogo, 'dados', { uso })).toEqual(['Dados abertos', 'Banco de dados', 'Engenharia de dados']);
    expect(sugerirTags(catalogo, 'dados')).toEqual(['Dados abertos', 'Banco de dados', 'Engenharia de dados']);
    expect(sugerirTags(['Bdados', 'Adados'], 'dados')).toEqual(['Adados', 'Bdados']);
  });

  it('mostra no máximo 6 sugestões', () => {
    const muitos = Array.from({ length: 10 }, (_, i) => `Tema ${i}`);
    expect(sugerirTags(muitos, 'tema')).toHaveLength(6);
  });

  it('não sugere o que já está selecionado e não sugere nada com o campo vazio', () => {
    const selecionadas = new Map([['python', { nome: 'Python' }]]);
    expect(sugerirTags(catalogo, 'pyt', { selecionadas })).toEqual([]);
    expect(sugerirTags(catalogo, '   ')).toEqual([]);
  });
});

describe('trechosDestacados', () => {
  it('separa o trecho que casou mantendo a grafia original', () => {
    expect(trechosDestacados('Café especial', 'cafe')).toEqual([
      { texto: 'Café', destaque: true },
      { texto: ' especial', destaque: false },
    ]);
  });
});

describe('detecção de duplicatas', () => {
  it('ignora maiúsculas, acentos, espaços, pontos e hífens', () => {
    for (const texto of ['nodejs', 'node js', 'Node.js', 'NODE-JS']) expect(chaveDeComparacao(texto)).toBe('nodejs');
    expect(encontrarEquivalente(['Node.js'], 'node js')).toEqual({ tipo: 'igual', nome: 'Node.js' });
  });

  it('acha a parecida com uma letra de diferença só quando as duas têm 6 letras ou mais', () => {
    expect(distanciaDeEdicao('pyhton', 'python')).toBe(1);
    expect(distanciaDeEdicao('pythn', 'python')).toBe(1);
    expect(distanciaDeEdicao('pithon', 'python')).toBe(1);
    expect(distanciaDeEdicao('pyton3', 'python')).toBe(2);
    expect(encontrarEquivalente(['Python'], 'Pyhton')).toEqual({ tipo: 'parecida', nome: 'Python' });
    expect(encontrarEquivalente(['Python'], 'Pythn')).toBeNull();
    expect(encontrarEquivalente(['Go'], 'Gi')).toBeNull();
    expect(encontrarEquivalente(['Python'], 'Terraform')).toBeNull();
  });

  it('não acusa nomes curtos legítimos que diferem por uma letra', () => {
    const pares = [
      ['Flex', 'Flux'],
      ['Jest', 'Test'],
      ['Scala', 'Scale'],
      ['Rust', 'Rush'],
      ['Make', 'Cake'],
      ['Dart', 'Dark'],
    ];
    for (const [existente, digitado] of pares) expect(encontrarEquivalente([existente], digitado), digitado).toBeNull();
  });

  it('com várias parecidas, escolhe a de menor distância, depois a mais usada e depois a ordem alfabética', () => {
    expect(encontrarEquivalente(['Pythons', 'Python'], 'Pyhton')).toEqual({ tipo: 'parecida', nome: 'Python' });
    const uso = new Map([['corridas', 5]]);
    expect(encontrarEquivalente(['Corrida', 'Corridas'], 'Corridaa', { uso })).toEqual({ tipo: 'parecida', nome: 'Corridas' });
    expect(encontrarEquivalente(['Corridas', 'Corrida'], 'Corridaa')).toEqual({ tipo: 'parecida', nome: 'Corrida' });
  });
});
