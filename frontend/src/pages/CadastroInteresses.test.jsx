import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AvisosProvider } from '../context/Avisos.jsx';
import { API } from '../services/api.js';
import CadastroInteresses from './CadastroInteresses.jsx';

const auth = vi.hoisted(() => ({ valor: null }));
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => auth.valor }));

const CATALOGO = {
  tags: [
    { name: 'React', category: 'TECHNICAL', uso: 4 },
    { name: 'Azure', category: 'TECHNICAL', uso: 2 },
    { name: 'Xadrez', category: 'HOBBY', uso: 3 },
    { name: 'Corrida', category: 'HOBBY', uso: 1 },
  ],
};

const perfilVazio = { id: 1, bio: null, connection_goals: [], tags: { technical: [], hobby: [] } };

function montar({ perfil = perfilVazio, rota = '/cadastro/interesses' } = {}) {
  auth.valor = { perfil, definirPerfil: vi.fn() };
  render(
    <AvisosProvider>
      <MemoryRouter initialEntries={[rota]}>
        <Routes>
          <Route path="/cadastro/interesses" element={<CadastroInteresses />} />
          <Route path="/cadastro/dados" element={<p>Tela de dados</p>} />
          <Route path="/cadastro/preferencias" element={<p>Tela de preferências</p>} />
          <Route path="/eu" element={<p>Tela do perfil</p>} />
        </Routes>
      </MemoryRouter>
    </AvisosProvider>,
  );
  return auth.valor;
}

const salvar = () => screen.getByRole('button', { name: /salvar e ver preferências/i });

describe('CadastroInteresses', () => {
  beforeEach(() => {
    vi.spyOn(API, 'tags').mockResolvedValue(CATALOGO);
  });

  it('só libera salvar com ao menos 3 interesses', async () => {
    const usuario = userEvent.setup();
    montar();
    await usuario.click(await screen.findByRole('button', { name: 'React' }));
    await usuario.click(screen.getByRole('button', { name: 'Xadrez' }));
    expect(salvar()).toBeDisabled();
    expect(screen.getByText(/escolha mais 1 interesse/i)).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Corrida' }));
    expect(salvar()).toBeEnabled();
  });

  it('salva os interesses e os objetivos do propósito escolhido e segue para as preferências', async () => {
    const usuario = userEvent.setup();
    const perfilSalvo = { ...perfilVazio, connection_goals: ['MENTORIA'] };
    vi.spyOn(API, 'salvarInteresses').mockResolvedValue(perfilVazio);
    vi.spyOn(API, 'atualizarPerfil').mockResolvedValue(perfilSalvo);
    const { definirPerfil } = montar();

    await usuario.click(await screen.findByRole('button', { name: 'React' }));
    await usuario.click(screen.getByRole('button', { name: 'Azure' }));
    await usuario.click(screen.getByRole('button', { name: 'Xadrez' }));
    await usuario.click(screen.getByRole('radio', { name: /encontrar oportunidades/i }));
    await usuario.click(salvar());

    expect(API.salvarInteresses).toHaveBeenCalledWith([
      { name: 'React', category: 'TECHNICAL', source: 'MANUAL' },
      { name: 'Azure', category: 'TECHNICAL', source: 'MANUAL' },
      { name: 'Xadrez', category: 'HOBBY', source: 'MANUAL' },
    ]);
    expect(API.atualizarPerfil).toHaveBeenCalledWith({ connection_goals: ['MENTORIA', 'TROCA_DE_CONHECIMENTO', 'NETWORKING'] });
    expect(definirPerfil).toHaveBeenCalledWith(perfilSalvo);
    expect(await screen.findByText('Tela de preferências')).toBeInTheDocument();
  });

  it('não troca objetivos já salvos quando o propósito não mudou', async () => {
    const usuario = userEvent.setup();
    const perfil = {
      ...perfilVazio,
      connection_goals: ['HOBBY'],
      tags: {
        technical: [
          { id: 1, name: 'React', source: 'MANUAL' },
          { id: 2, name: 'Azure', source: 'MANUAL' },
        ],
        hobby: [{ id: 3, name: 'Xadrez', source: 'AI' }],
      },
    };
    vi.spyOn(API, 'salvarInteresses').mockResolvedValue(perfil);
    vi.spyOn(API, 'atualizarPerfil');
    montar({ perfil });

    await usuario.click(await screen.findByRole('button', { name: /salvar e ver preferências/i }));
    expect(API.salvarInteresses).toHaveBeenCalledWith(expect.arrayContaining([{ name: 'Xadrez', category: 'HOBBY', source: 'AI' }]));
    expect(API.atualizarPerfil).not.toHaveBeenCalled();
  });

  it('a análise com IA adiciona as tags sugeridas à seleção', async () => {
    const usuario = userEvent.setup();
    vi.spyOn(API, 'analisarBio').mockResolvedValue({ technical_tags: ['Kubernetes'], hobby_tags: ['Xadrez'] });
    vi.spyOn(API, 'atualizarPerfil').mockResolvedValue(perfilVazio);
    montar();

    await usuario.type(await screen.findByLabelText('Resumo para análise'), 'Trabalho com Kubernetes e jogo xadrez.');
    await usuario.click(screen.getByRole('button', { name: /analisar com ia/i }));

    expect(await screen.findByText(/interesses mapeados \(2\)/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kubernetes' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Xadrez' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('mostra o erro da API ao salvar e continua na tela', async () => {
    const usuario = userEvent.setup();
    vi.spyOn(API, 'salvarInteresses').mockRejectedValue(new Error('Escolha ao menos 3 interesses.'));
    montar();

    for (const nome of ['React', 'Azure', 'Xadrez']) await usuario.click(await screen.findByRole('button', { name: nome }));
    await usuario.click(salvar());

    expect(await screen.findByRole('alert')).toHaveTextContent('Escolha ao menos 3 interesses.');
    expect(screen.queryByText('Tela de preferências')).not.toBeInTheDocument();
  });
});
