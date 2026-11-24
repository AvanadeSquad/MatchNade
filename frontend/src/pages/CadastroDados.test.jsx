import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { API } from '../services/api.js';
import CadastroDados from './CadastroDados.jsx';

const auth = vi.hoisted(() => ({ valor: null }));
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => auth.valor }));

const PERFIL = { id: 1, name: 'Ana Silva', email: 'ana@exemplo.test', department: '', location: '', profile_complete: false };

function montar() {
  auth.valor = { perfil: PERFIL, definirPerfil: vi.fn(), sair: vi.fn() };
  render(
    <MemoryRouter initialEntries={['/cadastro/dados']}>
      <Routes>
        <Route path="/cadastro/dados" element={<CadastroDados />} />
        <Route path="/cadastro/interesses" element={<p>Tela de interesses</p>} />
      </Routes>
    </MemoryRouter>,
  );
  return auth.valor;
}

describe('CadastroDados', () => {
  it('não pede telefone, CEP nem e-mail pessoal', () => {
    montar();
    expect(screen.queryByLabelText(/telefone/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/cep/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/e-mail pessoal/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/telefone|cep|e-mail pessoal/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/nome completo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cidade \/ estado/i)).toBeInTheDocument();
  });

  it('envia para a API só nome, unidade e cidade, e guarda no navegador só o hub', async () => {
    const u = userEvent.setup();
    const contexto = montar();
    vi.spyOn(API, 'atualizarPerfil').mockResolvedValue({ ...PERFIL, department: 'Cloud', location: 'Recife, PE' });
    await u.type(screen.getByLabelText(/unidade de negócio/i), 'Cloud');
    await u.selectOptions(screen.getByLabelText(/unidade \/ hub/i), 'Avanade Recife (Porto Digital)');
    await u.clear(screen.getByLabelText(/cidade \/ estado/i));
    await u.type(screen.getByLabelText(/cidade \/ estado/i), 'Recife, PE');
    await u.click(screen.getByRole('checkbox'));
    await u.click(screen.getByRole('button', { name: /continuar para interesses/i }));
    expect(API.atualizarPerfil).toHaveBeenCalledWith({ name: 'Ana Silva', department: 'Cloud', location: 'Recife, PE' });
    expect(contexto.definirPerfil).toHaveBeenCalled();
    expect(await screen.findByText('Tela de interesses')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('preferencias:1'))).toMatchObject({ hub: 'Avanade Recife (Porto Digital)' });
  });
});
