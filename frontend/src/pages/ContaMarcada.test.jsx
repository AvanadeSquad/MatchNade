import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AvisosProvider } from '../context/Avisos.jsx';
import { API, ErroApi } from '../services/api.js';
import ContaMarcada from './ContaMarcada.jsx';

const auth = vi.hoisted(() => ({ valor: null }));
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => auth.valor }));

const PERFIL = { id: 7, name: 'Ana Silva', deletion: { requested_at: '2026-11-08T12:00:00Z', scheduled_for: '2026-12-08T12:00:00Z' } };

function montar() {
  render(
    <MemoryRouter initialEntries={['/qualquer']}>
      <AvisosProvider>
        <Routes>
          <Route path="/qualquer" element={<ContaMarcada />} />
          <Route path="/descobrir" element={<p>Tela de descoberta</p>} />
          <Route path="/login" element={<p>Tela de login</p>} />
        </Routes>
      </AvisosProvider>
    </MemoryRouter>,
  );
  return userEvent.setup();
}

beforeEach(() => {
  auth.valor = { perfil: PERFIL, definirPerfil: vi.fn(), sair: vi.fn() };
});
afterEach(() => vi.restoreAllMocks());

describe('ContaMarcada', () => {
  it('mostra a data da exclusão e as três saídas', () => {
    montar();
    expect(screen.getByRole('heading', { name: /marcada para exclusão/ })).toBeInTheDocument();
    expect(screen.getByText(/de dezembro de 2026/)).toBeInTheDocument();
    for (const nome of ['Cancelar a exclusão', 'Excluir agora', 'Sair da conta']) {
      expect(screen.getByRole('button', { name: nome })).toBeInTheDocument();
    }
  });

  it('cancelar a exclusão atualiza o perfil e volta ao app', async () => {
    const perfilNormal = { ...PERFIL, deletion: null };
    vi.spyOn(API, 'cancelarExclusao').mockResolvedValue(perfilNormal);
    const usuario = montar();
    await usuario.click(screen.getByRole('button', { name: 'Cancelar a exclusão' }));
    expect(auth.valor.definirPerfil).toHaveBeenCalledWith(perfilNormal);
    expect(await screen.findByText('Tela de descoberta')).toBeInTheDocument();
  });

  it('erro ao cancelar mostra a mensagem e mantém a tela', async () => {
    vi.spyOn(API, 'cancelarExclusao').mockRejectedValue(
      new ErroApi(409, 'SEM_EXCLUSAO_PENDENTE', 'Esta conta não está marcada para exclusão.'),
    );
    const usuario = montar();
    await usuario.click(screen.getByRole('button', { name: 'Cancelar a exclusão' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('não está marcada');
    expect(screen.getByRole('button', { name: 'Cancelar a exclusão' })).toBeEnabled();
  });

  it('excluir agora pede uma segunda confirmação antes de apagar', async () => {
    vi.spyOn(API, 'excluirPerfil').mockResolvedValue(null);
    const usuario = montar();
    await usuario.click(screen.getByRole('button', { name: 'Excluir agora' }));
    expect(API.excluirPerfil).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toHaveTextContent('não pode ser desfeita');
    await usuario.click(screen.getByRole('button', { name: 'Excluir tudo agora' }));
    expect(API.excluirPerfil).toHaveBeenCalledTimes(1);
    expect(auth.valor.sair).toHaveBeenCalled();
    expect(await screen.findByText('Tela de login')).toBeInTheDocument();
  });

  it('voltar na confirmação não apaga nada', async () => {
    vi.spyOn(API, 'excluirPerfil');
    const usuario = montar();
    await usuario.click(screen.getByRole('button', { name: 'Excluir agora' }));
    await usuario.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(API.excluirPerfil).not.toHaveBeenCalled();
  });

  it('sair da conta encerra a sessão sem chamar a API', async () => {
    vi.spyOn(API, 'excluirPerfil');
    const usuario = montar();
    await usuario.click(screen.getByRole('button', { name: 'Sair da conta' }));
    expect(auth.valor.sair).toHaveBeenCalled();
    expect(API.excluirPerfil).not.toHaveBeenCalled();
  });
});
