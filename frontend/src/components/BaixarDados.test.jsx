import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API, ErroApi } from '../services/api.js';
import BaixarDados from './BaixarDados.jsx';

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:teste');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const botao = () => screen.getByRole('button', { name: /baixar meus dados|preparando/i });

describe('BaixarDados', () => {
  it('pede os dados à API e entrega um arquivo JSON', async () => {
    vi.spyOn(API, 'exportarDados').mockResolvedValue({ profile: { name: 'Ana' } });
    render(<BaixarDados />);
    await userEvent.click(botao());

    expect(API.exportarDados).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    const blob = URL.createObjectURL.mock.calls[0][0];
    expect(blob.type).toBe('application/json');
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('button', { name: 'Baixar meus dados' })).toBeEnabled();
  });

  it('avisa quando o limite de downloads por hora foi atingido', async () => {
    vi.spyOn(API, 'exportarDados').mockRejectedValue(new ErroApi(429, 'LIMITE_EXCEDIDO', 'Muitas requisições.'));
    render(<BaixarDados />);
    await userEvent.click(botao());

    expect(await screen.findByRole('alert')).toHaveTextContent(/tente de novo em uma hora/i);
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
  });

  it('mostra o erro da API e não baixa nada', async () => {
    vi.spyOn(API, 'exportarDados').mockRejectedValue(new ErroApi(0, 'SEM_CONEXAO', 'Sem conexão.'));
    render(<BaixarDados />);
    await userEvent.click(botao());

    expect(await screen.findByRole('alert')).toHaveTextContent('Sem conexão.');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});
