import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AvisosProvider } from '../context/Avisos.jsx';
import { ErroApi, API } from '../services/api.js';
import Login from './Login.jsx';

const auth = vi.hoisted(() => ({ valor: null }));
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => auth.valor }));

const FUNCIONARIA = { id: 1, name: 'Ana Silva', email: 'ana@exemplo.test', profile_complete: true };

function montar({ usuariosDev = [] } = {}) {
  window.matchMedia = (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} });
  vi.spyOn(API, 'usuariosDeDesenvolvimento').mockResolvedValue({ users: usuariosDev });
  auth.valor = { token: null, perfil: null, entrar: vi.fn() };
  render(
    <AvisosProvider>
      <MemoryRouter initialEntries={['/login']}>
        <Login />
      </MemoryRouter>
    </AvisosProvider>,
  );
  return userEvent.setup();
}

const campoEmail = () => screen.getByLabelText(/^E-mail/);
const campoSenha = () => screen.getByLabelText('Senha');
const entrar = () => screen.getByRole('button', { name: /Acessar o Global Connect/ });

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('login', () => {
  it('pede e-mail e senha e não oferece o LinkedIn', async () => {
    montar();
    expect(campoEmail()).toBeInTheDocument();
    expect(campoSenha()).toHaveAttribute('type', 'password');
    expect(screen.queryByRole('button', { name: /linkedin/i })).not.toBeInTheDocument();
  });

  it('o botão de olho mostra e oculta a senha', async () => {
    const u = montar();
    await u.type(campoSenha(), 'segredo');
    await u.click(screen.getByRole('button', { name: 'Mostrar senha' }));
    expect(campoSenha()).toHaveAttribute('type', 'text');
    await u.click(screen.getByRole('button', { name: 'Ocultar senha' }));
    expect(campoSenha()).toHaveAttribute('type', 'password');
  });

  it('com senha, entra pela API de senha e abre a sessão', async () => {
    const resposta = { token: 'jwt', employee: FUNCIONARIA };
    vi.spyOn(API, 'loginComSenha').mockResolvedValue(resposta);
    const u = montar();
    await u.type(campoEmail(), '  ana@exemplo.test ');
    await u.type(campoSenha(), 'uma senha comprida e boa');
    await u.click(entrar());
    expect(API.loginComSenha).toHaveBeenCalledWith('ana@exemplo.test', 'uma senha comprida e boa');
    expect(auth.valor.entrar).toHaveBeenCalledWith('jwt', FUNCIONARIA);
  });

  it('mostra a mensagem da API quando a senha não confere', async () => {
    vi.spyOn(API, 'loginComSenha').mockRejectedValue(
      new ErroApi(401, 'NAO_AUTENTICADO', 'E-mail ou senha incorretos, ou muitas tentativas seguidas. Tente de novo em alguns minutos.'),
    );
    const u = montar();
    await u.type(campoEmail(), 'ana@exemplo.test');
    await u.type(campoSenha(), 'errada errada errada');
    await u.click(entrar());
    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos');
    expect(auth.valor.entrar).not.toHaveBeenCalled();
  });

  it('com a senha em branco e sem acesso por e-mail, orienta a informar a senha ou usar o SSO', async () => {
    vi.spyOn(API, 'loginComSenha');
    vi.spyOn(API, 'loginDesenvolvimento');
    const u = montar({ usuariosDev: [] });
    await u.type(campoEmail(), 'ana@exemplo.test');
    await u.click(entrar());
    expect(await screen.findByRole('alert')).toHaveTextContent('Informe a senha ou entre pelo SSO');
    expect(API.loginComSenha).not.toHaveBeenCalled();
    expect(API.loginDesenvolvimento).not.toHaveBeenCalled();
  });

  it('em desenvolvimento, a senha em branco entra só com o e-mail', async () => {
    vi.spyOn(API, 'loginDesenvolvimento').mockResolvedValue({ token: 'jwt', employee: FUNCIONARIA });
    vi.spyOn(API, 'loginComSenha');
    const u = montar({ usuariosDev: [{ name: 'Ana Silva', email: 'ana@exemplo.test' }] });
    await u.type(campoEmail(), 'ana@exemplo.test');
    await u.click(entrar());
    expect(API.loginDesenvolvimento).toHaveBeenCalledWith('ana@exemplo.test');
    expect(API.loginComSenha).not.toHaveBeenCalled();
  });

  it('"Esqueceu sua senha?" explica como recuperar o acesso', async () => {
    const u = montar();
    await u.click(screen.getByRole('button', { name: 'Esqueceu sua senha?' }));
    expect(await screen.findByText(/defina uma nova senha em Meu Perfil/)).toBeInTheDocument();
  });
});
