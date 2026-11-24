import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AvisosProvider } from '../context/Avisos.jsx';
import { API } from '../services/api.js';
import Login from './Login.jsx';

vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => ({ token: null, perfil: null, entrar: vi.fn() }) }));
// Aplicativo da Microsoft não registrado: sem ID do cliente.
vi.mock('../services/microsoft.js', () => ({ MICROSOFT_CLIENT_ID: '', obterIdTokenMicrosoft: vi.fn() }));

function montar() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <AvisosProvider>
        <Login />
      </AvisosProvider>
    </MemoryRouter>,
  );
}

describe('Login sem o aplicativo da Microsoft registrado', () => {
  beforeEach(() => {
    window.matchMedia = (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} });
    vi.spyOn(API, 'perguntasSeguranca').mockResolvedValue({ questions: [] });
  });

  it('não mostra o botão da Microsoft nem o divisor de SSO', () => {
    montar();
    expect(screen.queryByRole('button', { name: /Microsoft/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/SSO corporativo/)).not.toBeInTheDocument();
  });

  it('o login com e-mail e senha continua disponível', () => {
    montar();
    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Entrar/ }).length).toBeGreaterThan(0);
  });
});
