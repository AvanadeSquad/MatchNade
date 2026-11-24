import { describe, expect, it } from 'vitest';
import { iniciais, listaEmTexto, porcentagem, unidadeECidade } from './formatar.js';

describe('formatar', () => {
  it('iniciais usa a primeira letra do primeiro e do último nome', () => {
    expect(iniciais('ana maria silva')).toBe('AS');
    expect(iniciais('  Bruno  ')).toBe('B');
    expect(iniciais('')).toBe('?');
  });

  it('porcentagem arredonda e trata valor ausente', () => {
    expect(porcentagem(0.625)).toBe('63%');
    expect(porcentagem(undefined)).toBe('0%');
  });

  it('listaEmTexto junta com vírgula e "e"', () => {
    expect(listaEmTexto([])).toBe('');
    expect(listaEmTexto(['A'])).toBe('A');
    expect(listaEmTexto(['A', 'B'])).toBe('A e B');
    expect(listaEmTexto(['A', 'B', 'C'])).toBe('A, B e C');
  });

  it('unidadeECidade omite o que estiver vazio', () => {
    expect(unidadeECidade('Cloud', 'Recife')).toBe('Cloud • Recife');
    expect(unidadeECidade('', 'Recife')).toBe('Recife');
    expect(unidadeECidade(null, null)).toBe('');
  });
});
