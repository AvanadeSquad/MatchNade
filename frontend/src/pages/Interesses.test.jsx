import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AvisosProvider } from '../context/Avisos.jsx';
import { API } from '../services/api.js';
import Interesses from './Interesses.jsx';

const auth = vi.hoisted(() => ({ valor: null }));
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => auth.valor }));

const CATALOGO = {
  tags: [
    { name: 'React', category: 'TECHNICAL' },
    { name: 'Azure', category: 'TECHNICAL' },
    { name: 'Xadrez', category: 'HOBBY' },
    { name: 'Corrida', category: 'HOBBY' },
  ],
};

const perfilVazio = { id: 1, connection_goals: [], tags: { technical: [], hobby: [] } };

function montar({ perfil = perfilVazio, rascunho = null } = {}) {
  auth.valor = { perfil, rascunho, setRascunho: vi.fn(), definirPerfil: vi.fn() };
  render(
    <AvisosProvider>
      <MemoryRouter initialEntries={['/perfil/interesses']}>
        <Routes>
          <Route path="/perfil/interesses" element={<Interesses />} />
          <Route path="/perfil/objetivos" element={<p>Tela de objetivos</p>} />
          <Route path="/eu" element={<p>Tela do perfil</p>} />
        </Routes>
      </MemoryRouter>
    </AvisosProvider>,
  );
  return auth.valor;
}

describe('Interesses', () => {
  beforeEach(() => {
    vi.spyOn(API, 'tags').mockResolvedValue(CATALOGO);
  });

  it('só libera salvar com pelo menos 3 interesses e mostra quantos faltam', async () => {
    const usuario = userEvent.setup();
    montar();
    const salvar = await screen.findByRole('button', { name: 'Salvar interesses' });
    expect(salvar).toBeDisabled();
    expect(screen.getByText('Escolha mais 3')).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'React' }));
    await usuario.click(screen.getByRole('button', { name: 'Xadrez' }));
    expect(salvar).toBeDisabled();
    await usuario.click(screen.getByRole('button', { name: 'Corrida' }));
    expect(salvar).toBeEnabled();
    expect(screen.queryByText(/Escolha mais/)).not.toBeInTheDocument();
  });

  it('salva com categoria e origem, usa o perfil devolvido e segue para objetivos no cadastro', async () => {
    const usuario = userEvent.setup();
    const devolvido = { ...perfilVazio, connection_goals: [] };
    vi.spyOn(API, 'salvarInteresses').mockResolvedValue(devolvido);
    const rascunho = { tecnicas: [{ nome: 'Kubernetes', fonte: 'AI' }], hobbies: [{ nome: 'Xadrez', fonte: 'AI' }] };
    const contexto = montar({ rascunho });
    await usuario.click(await screen.findByRole('button', { name: 'React' }));
    await usuario.click(screen.getByRole('button', { name: 'Salvar interesses' }));
    expect(API.salvarInteresses).toHaveBeenCalledWith([
      { name: 'Kubernetes', category: 'TECHNICAL', source: 'AI' },
      { name: 'Xadrez', category: 'HOBBY', source: 'AI' },
      { name: 'React', category: 'TECHNICAL', source: 'MANUAL' },
    ]);
    expect(contexto.definirPerfil).toHaveBeenCalledWith(devolvido);
    expect(contexto.setRascunho).toHaveBeenCalledWith(null);
    expect(await screen.findByText('Tela de objetivos')).toBeInTheDocument();
  });

  it('tag vinda da análise que não está no catálogo aparece como opção já marcada', async () => {
    montar({ rascunho: { tecnicas: [{ nome: 'Kubernetes', fonte: 'AI' }], hobbies: [] } });
    expect(await screen.findByRole('button', { name: 'Kubernetes' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('erro ao salvar fica na tela e não navega', async () => {
    const usuario = userEvent.setup();
    vi.spyOn(API, 'salvarInteresses').mockRejectedValue(new Error('Não foi possível salvar.'));
    montar({
      perfil: {
        ...perfilVazio,
        tags: {
          technical: [
            { name: 'React', source: 'MANUAL' },
            { name: 'Azure', source: 'MANUAL' },
          ],
          hobby: [{ name: 'Xadrez', source: 'MANUAL' }],
        },
      },
    });
    await usuario.click(await screen.findByRole('button', { name: 'Salvar interesses' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível salvar.');
    expect(screen.queryByText('Tela de objetivos')).not.toBeInTheDocument();
  });
});
