import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCarregar } from './useCarregar.js';

// Conta os pedidos de atualização de estado feitos pelos componentes. Depois de desmontar, o React 18
// ignora essas atualizações sem aviso, então só a contagem mostra se o hook ainda tentou aplicar
// uma resposta que chegou tarde.
const atualizacoes = vi.hoisted(() => ({ total: 0 }));
vi.mock('react', async (importarOriginal) => {
  const React = await importarOriginal();
  const useState = (inicial) => {
    const [valor, definir] = React.useState(inicial);
    const contar = (...args) => {
      atualizacoes.total += 1;
      return definir(...args);
    };
    return [valor, contar];
  };
  return { ...React, default: { ...React.default, useState }, useState };
});

// Promessa que o teste resolve ou rejeita quando quiser.
function adiada() {
  let resolver;
  let rejeitar;
  const promessa = new Promise((sim, nao) => {
    resolver = sim;
    rejeitar = nao;
  });
  return { promessa, resolver, rejeitar };
}

describe('useCarregar', () => {
  it('começa carregando e entrega os dados', async () => {
    const { result } = renderHook(() => useCarregar(async () => 'ok', []));
    expect(result.current.carregando).toBe(true);
    await waitFor(() => expect(result.current).toMatchObject({ dados: 'ok', erro: null, carregando: false }));
  });

  it('descarta a resposta antiga quando as dependências mudam antes de ela chegar', async () => {
    const pedidos = { 1: adiada(), 2: adiada() };
    const { result, rerender } = renderHook(({ id }) => useCarregar(() => pedidos[id].promessa, [id]), { initialProps: { id: 1 } });
    rerender({ id: 2 });
    await act(async () => pedidos[2].resolver('segundo'));
    await act(async () => pedidos[1].resolver('primeiro'));
    expect(result.current.dados).toBe('segundo');
  });

  it('um erro de uma execução antiga não substitui os dados novos', async () => {
    const pedidos = { 1: adiada(), 2: adiada() };
    const { result, rerender } = renderHook(({ id }) => useCarregar(() => pedidos[id].promessa, [id]), { initialProps: { id: 1 } });
    rerender({ id: 2 });
    await act(async () => pedidos[2].resolver('novo'));
    await act(async () => pedidos[1].rejeitar(new Error('antigo')));
    expect(result.current).toMatchObject({ dados: 'novo', erro: null });
  });

  it('não tenta aplicar a resposta que chega depois de desmontar', async () => {
    const pedido = adiada();
    const { result, unmount } = renderHook(() => useCarregar(() => pedido.promessa, []));
    unmount();
    const antes = atualizacoes.total;
    await act(async () => pedido.resolver('tarde'));
    expect(atualizacoes.total).toBe(antes);
    expect(result.current.dados).toBeNull();
  });

  it('não tenta aplicar o erro que chega depois de desmontar', async () => {
    const pedido = adiada();
    const { unmount } = renderHook(() => useCarregar(() => pedido.promessa, []));
    unmount();
    const antes = atualizacoes.total;
    await act(async () => pedido.rejeitar(new Error('tarde')));
    expect(atualizacoes.total).toBe(antes);
  });

  it('recarregar busca de novo e guarda o erro', async () => {
    let vez = 0;
    const { result } = renderHook(() =>
      useCarregar(async () => {
        vez += 1;
        if (vez === 2) throw new Error('falhou');
        return vez;
      }, []),
    );
    await waitFor(() => expect(result.current.dados).toBe(1));
    act(() => result.current.recarregar());
    await waitFor(() => expect(result.current.erro?.message).toBe('falhou'));
  });
});
