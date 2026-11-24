import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AvisosProvider } from '../context/Avisos.jsx';
import { API, ErroApi } from '../services/api.js';
import PersonalizarPerfil from './PersonalizarPerfil.jsx';

const auth = vi.hoisted(() => ({ valor: null }));
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => auth.valor }));

const PERFIL = {
  id: 7,
  name: 'Ana Silva',
  department: 'Cloud',
  avatar_id: null,
  pronouns: null,
  visibility: 'ALL',
  preferred_coffee_slots: [],
};

let definirPerfil;
let aoFechar;

function montar(perfil = PERFIL) {
  definirPerfil = vi.fn();
  aoFechar = vi.fn();
  auth.valor = { perfil, definirPerfil };
  render(
    <AvisosProvider>
      <PersonalizarPerfil aoFechar={aoFechar} />
    </AvisosProvider>,
  );
  return userEvent.setup();
}

beforeEach(() => {
  vi.spyOn(API, 'atualizarPerfil').mockResolvedValue({ ...PERFIL, pronouns: 'ela/dela' });
});
afterEach(() => vi.restoreAllMocks());

describe('PersonalizarPerfil', () => {
  it('abre com o que já está salvo no perfil', () => {
    montar({ ...PERFIL, avatar_id: 'lua', pronouns: 'ela/dela', visibility: 'UNIT', preferred_coffee_slots: ['09:00', '14:00'] });
    expect(screen.getByRole('button', { name: 'Avatar Lua' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText(/Pronomes/)).toHaveValue('ela/dela');
    expect(screen.getByRole('radio', { name: 'Só a minha unidade' })).toBeChecked();
    expect(screen.getByRole('button', { name: '09:00' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '10:00' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('oferece os 12 avatares prontos mais as iniciais, e marca um por vez', async () => {
    const usuario = userEvent.setup();
    montar();
    const grupo = screen.getByText('Avatar', { selector: 'legend' }).closest('fieldset');
    expect(within(grupo).getAllByRole('button')).toHaveLength(13);
    expect(screen.getByRole('button', { name: 'Usar minhas iniciais' })).toHaveAttribute('aria-pressed', 'true');
    await usuario.click(screen.getByRole('button', { name: 'Avatar Sol' }));
    expect(screen.getByRole('button', { name: 'Avatar Sol' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Usar minhas iniciais' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('explica a restrição por unidade com o nome da unidade', async () => {
    const usuario = userEvent.setup();
    montar();
    await usuario.click(screen.getByRole('radio', { name: 'Só a minha unidade' }));
    expect(screen.getByText(/Você aparece só para quem é da mesma unidade \(Cloud\)/)).toBeInTheDocument();
    expect(screen.getByText(/continua vendo todas as unidades/)).toBeInTheDocument();
  });

  it('limita os horários preferidos a 5', async () => {
    const usuario = userEvent.setup();
    montar();
    for (const h of ['09:00', '09:30', '10:00', '10:30', '11:00', '14:00']) await usuario.click(screen.getByRole('button', { name: h }));
    expect(screen.getByRole('button', { name: '11:00' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '14:00' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText(/5 marcados, limite atingido/)).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: '09:00' }));
    expect(screen.getByText(/4 marcados/)).toBeInTheDocument();
  });

  it('salva tudo de uma vez e fecha', async () => {
    const usuario = userEvent.setup();
    montar();
    await usuario.click(screen.getByRole('button', { name: 'Avatar Folha' }));
    await usuario.type(screen.getByLabelText(/Pronomes/), '  ela/dela ');
    await usuario.click(screen.getByRole('radio', { name: 'Só a minha unidade' }));
    await usuario.click(screen.getByRole('button', { name: '10:30' }));
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(API.atualizarPerfil).toHaveBeenCalledWith({
      avatar_id: 'folha',
      pronouns: 'ela/dela',
      visibility: 'UNIT',
      preferred_coffee_slots: ['10:30'],
    });
    expect(definirPerfil).toHaveBeenCalledTimes(1);
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });

  it('mostra o erro da API e continua aberto', async () => {
    const usuario = userEvent.setup();
    API.atualizarPerfil.mockRejectedValue(new ErroApi(400, 'PRONOMES_INVALIDOS', 'Use só letras e barra.'));
    montar();
    await usuario.type(screen.getByLabelText(/Pronomes/), 'ela1');
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Use só letras e barra.');
    expect(aoFechar).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled();
  });

  it('voltar para as iniciais envia avatar nulo', async () => {
    const usuario = userEvent.setup();
    montar({ ...PERFIL, avatar_id: 'lua' });
    await usuario.click(screen.getByRole('button', { name: 'Usar minhas iniciais' }));
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(API.atualizarPerfil).toHaveBeenCalledWith(expect.objectContaining({ avatar_id: null }));
  });
});
