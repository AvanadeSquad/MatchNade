import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useCarregar } from './useCarregar.js';

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

  it('não atualiza depois de desmontar', async () => {
    const pedido = adiada();
    const { result, unmount } = renderHook(() => useCarregar(() => pedido.promessa, []));
    unmount();
    await act(async () => pedido.resolver('tarde'));
    expect(result.current.dados).toBeNull();
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
