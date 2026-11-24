import { describe, expect, it, vi } from 'vitest';
import { gravarIgnorados, ignorar, lerIgnorados, limparIgnorados } from './ignorados.js';

describe('ignorados', () => {
  it('guarda por pessoa usuária, sem misturar contas na mesma aba', () => {
    ignorar(1, 10);
    ignorar(1, 11);
    ignorar(2, 20);
    expect([...lerIgnorados(1)]).toEqual([10, 11]);
    expect([...lerIgnorados(2)]).toEqual([20]);
  });

  it('limpar apaga só a lista daquela pessoa', () => {
    ignorar(1, 10);
    ignorar(2, 20);
    limparIgnorados(1);
    expect(lerIgnorados(1).size).toBe(0);
    expect(lerIgnorados(2).size).toBe(1);
  });

  it('conteúdo corrompido vira lista vazia', () => {
    sessionStorage.setItem('ignorados:1', '{não é json');
    expect(lerIgnorados(1).size).toBe(0);
  });

  it('sem armazenamento disponível, não lança erro', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(() => gravarIgnorados(1, new Set([5]))).not.toThrow();
  });
});
