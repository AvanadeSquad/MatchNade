import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AvisosProvider } from '../context/Avisos.jsx';
import { API, ErroApi } from '../services/api.js';
import DefinirSenha from './DefinirSenha.jsx';

const auth = vi.hoisted(() => ({ valor: null }));
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => auth.valor }));

const NOVA = 'uma senha comprida e boa';

function montar({ temSenha = false } = {}) {
  auth.valor = { perfil: { id: 1, email: 'ana@exemplo.test', has_password: temSenha }, definirPerfil: vi.fn() };
  const aoFechar = vi.fn();
  render(
    <AvisosProvider>
      <DefinirSenha aoFechar={aoFechar} />
    </AvisosProvider>,
  );
  return { u: userEvent.setup(), aoFechar };
}

const campoNova = () => screen.getByLabelText(/^Nova senha/);
const campoConfirmacao = () => screen.getByLabelText('Confirmar nova senha');
const salvar = () => screen.getByRole('button', { name: 'Salvar senha' });

beforeEach(() => {
  vi.restoreAllMocks();
  window.HTMLElement.prototype.scrollIntoView = () => {};
});

describe('definir e alterar senha', () => {
  it('quem não tem senha não vê o campo da senha atual', () => {
    montar();
    expect(screen.getByRole('dialog', { name: 'Definir senha' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Senha atual')).not.toBeInTheDocument();
  });

  it('quem já tem senha precisa informar a atual', () => {
    montar({ temSenha: true });
    expect(screen.getByRole('dialog', { name: 'Alterar senha' })).toBeInTheDocument();
    expect(screen.getByLabelText('Senha atual')).toBeInTheDocument();
  });

  it('envia a senha nova, marca o perfil e fecha o diálogo', async () => {
    vi.spyOn(API, 'definirSenha').mockResolvedValue({ has_password: true });
    const { u, aoFechar } = montar();
    await u.type(campoNova(), NOVA);
    await u.type(campoConfirmacao(), NOVA);
    await u.click(salvar());
    expect(API.definirSenha).toHaveBeenCalledWith({ nova_senha: NOVA });
    expect(auth.valor.definirPerfil).toHaveBeenCalledWith(expect.objectContaining({ has_password: true }));
    expect(aoFechar).toHaveBeenCalled();
  });

  it('na troca, envia também a senha atual', async () => {
    vi.spyOn(API, 'definirSenha').mockResolvedValue({ has_password: true });
    const { u } = montar({ temSenha: true });
    await u.type(screen.getByLabelText('Senha atual'), 'a senha de antes');
    await u.type(campoNova(), NOVA);
    await u.type(campoConfirmacao(), NOVA);
    await u.click(salvar());
    expect(API.definirSenha).toHaveBeenCalledWith({ senha_atual: 'a senha de antes', nova_senha: NOVA });
  });

  it('não envia quando a confirmação é diferente', async () => {
    vi.spyOn(API, 'definirSenha');
    const { u } = montar();
    await u.type(campoNova(), NOVA);
    await u.type(campoConfirmacao(), `${NOVA} diferente`);
    await u.click(salvar());
    expect(await screen.findByRole('alert')).toHaveTextContent('A confirmação não é igual');
    expect(API.definirSenha).not.toHaveBeenCalled();
  });

  it('mostra o erro da API e mantém o diálogo aberto', async () => {
    vi.spyOn(API, 'definirSenha').mockRejectedValue(new ErroApi(403, 'SENHA_ATUAL_INCORRETA', 'A senha atual não confere.'));
    const { u, aoFechar } = montar({ temSenha: true });
    await u.type(screen.getByLabelText('Senha atual'), 'errada');
    await u.type(campoNova(), NOVA);
    await u.type(campoConfirmacao(), NOVA);
    await u.click(salvar());
    expect(await screen.findByRole('alert')).toHaveTextContent('A senha atual não confere.');
    expect(aoFechar).not.toHaveBeenCalled();
  });
});
