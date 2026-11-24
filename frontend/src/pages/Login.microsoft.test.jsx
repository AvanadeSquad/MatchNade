import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AvisosProvider } from '../context/Avisos.jsx';
import { API } from '../services/api.js';
import Login from './Login.jsx';

const auth = vi.hoisted(() => ({ entrar: null }));
const microsoft = vi.hoisted(() => ({ obterIdToken: null }));

vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => ({ token: null, perfil: null, entrar: auth.entrar }) }));
vi.mock('../services/microsoft.js', () => ({
  MICROSOFT_CLIENT_ID: 'app-de-teste',
  obterIdTokenMicrosoft: (...argumentos) => microsoft.obterIdToken(...argumentos),
}));

const RESPOSTA = { token: 'jwt-da-api', employee: { id: 1, name: 'Ana', profile_complete: true }, is_new: false };

function montar() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <AvisosProvider>
        <Login />
      </AvisosProvider>
    </MemoryRouter>,
  );
}

describe('Login com Microsoft', () => {
  beforeEach(() => {
    window.matchMedia = (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} });
    auth.entrar = vi.fn();
    microsoft.obterIdToken = vi.fn().mockResolvedValue('id-token-da-microsoft');
    vi.spyOn(API, 'perguntasSeguranca').mockResolvedValue({ questions: [] });
    vi.spyOn(API, 'loginMicrosoft').mockResolvedValue(RESPOSTA);
  });

  const botao = () => screen.getByRole('button', { name: /Entrar com Microsoft corporativo/ });

  it('envia o ID token à API e abre a sessão', async () => {
    const usuario = userEvent.setup();
    montar();
    await usuario.click(botao());
    await waitFor(() => expect(auth.entrar).toHaveBeenCalledWith('jwt-da-api', RESPOSTA.employee));
    expect(API.loginMicrosoft).toHaveBeenCalledWith('id-token-da-microsoft');
  });

  it('fechar a janela da Microsoft não chama a API nem mostra erro', async () => {
    microsoft.obterIdToken.mockResolvedValue(null);
    const usuario = userEvent.setup();
    montar();
    await usuario.click(botao());
    await waitFor(() => expect(microsoft.obterIdToken).toHaveBeenCalled());
    expect(API.loginMicrosoft).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(botao()).toBeEnabled();
  });

  it('e-mail não liberado mostra a mensagem própria e mantém o botão disponível', async () => {
    API.loginMicrosoft.mockRejectedValue(Object.assign(new Error('x'), { code: 'EMAIL_NAO_LIBERADO' }));
    const usuario = userEvent.setup();
    montar();
    await usuario.click(botao());
    expect(await screen.findByText(/e-mail ainda não está liberado/)).toBeInTheDocument();
    expect(auth.entrar).not.toHaveBeenCalled();
    expect(botao()).toBeEnabled();
  });

  it('falha da biblioteca mostra a mensagem e não chama a API', async () => {
    microsoft.obterIdToken.mockRejectedValue(new Error('Não foi possível entrar com a Microsoft. Tente novamente.'));
    const usuario = userEvent.setup();
    montar();
    await usuario.click(botao());
    expect(await screen.findByText('Não foi possível entrar com a Microsoft. Tente novamente.')).toBeInTheDocument();
    expect(API.loginMicrosoft).not.toHaveBeenCalled();
  });
});
