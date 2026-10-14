import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { API, ErroApi, EVENTO_SESSAO_EXPIRADA } from '../services/api.js';
import { obterToken, salvarToken } from '../services/sessao.js';
import { AuthProvider, useAuth } from './AuthContext.jsx';

function Estado() {
  const { token, perfil, carregando, erroPerfil } = useAuth();
  return <output>{JSON.stringify({ token, perfil: perfil?.name ?? null, carregando, erro: erroPerfil?.code ?? null })}</output>;
}

const ler = () => JSON.parse(screen.getByRole('status').textContent);

function montar() {
  return render(
    <AuthProvider>
      <Estado />
    </AuthProvider>,
  );
}

describe('AuthContext', () => {
  it('com token salvo, busca o perfil ao abrir', async () => {
    salvarToken('token-valido');
    vi.spyOn(API, 'perfil').mockResolvedValue({ id: 1, name: 'Pessoa Exemplo' });
    montar();
    await waitFor(() => expect(ler()).toMatchObject({ token: 'token-valido', perfil: 'Pessoa Exemplo', carregando: false }));
  });

  it('resposta 401 ao buscar o perfil encerra a sessão', async () => {
    salvarToken('token-vencido');
    vi.spyOn(API, 'perfil').mockRejectedValue(new ErroApi(401, 'NAO_AUTENTICADO', 'Sessão expirada.'));
    montar();
    await waitFor(() => expect(ler()).toMatchObject({ token: null, perfil: null, carregando: false }));
    expect(obterToken()).toBeNull();
  });

  it('falha de rede mantém a sessão e expõe o erro para tentar de novo', async () => {
    salvarToken('token-valido');
    vi.spyOn(API, 'perfil').mockRejectedValue(new ErroApi(0, 'SEM_CONEXAO', 'Sem conexão.'));
    montar();
    await waitFor(() => expect(ler()).toMatchObject({ token: 'token-valido', erro: 'SEM_CONEXAO', carregando: false }));
    expect(obterToken()).toBe('token-valido');
  });

  it('o evento de sessão expirada, disparado pelo cliente da API, encerra a sessão', async () => {
    salvarToken('token-valido');
    vi.spyOn(API, 'perfil').mockResolvedValue({ id: 1, name: 'Pessoa Exemplo' });
    montar();
    await waitFor(() => expect(ler().perfil).toBe('Pessoa Exemplo'));
    act(() => window.dispatchEvent(new Event(EVENTO_SESSAO_EXPIRADA)));
    expect(ler()).toMatchObject({ token: null, perfil: null });
  });
});
