import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { API, ErroApi } from '../services/api.js';
import ExcluirConta from './ExcluirConta.jsx';

afterEach(() => vi.restoreAllMocks());

function montar(props = {}) {
  const aoFechar = vi.fn();
  const aoConcluir = vi.fn();
  render(<ExcluirConta email="Ana.Silva@Exemplo.test" aoFechar={aoFechar} aoConcluir={aoConcluir} {...props} />);
  return { aoFechar, aoConcluir, usuario: userEvent.setup() };
}

const botao = () => screen.getByRole('button', { name: 'Excluir minha conta' });
const campo = () => screen.getByLabelText(/digite o e-mail da sua conta/i);

describe('ExcluirConta', () => {
  it('explica o prazo de 30 dias e começa com o botão desabilitado', () => {
    montar();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/apagada de forma definitiva em 30 dias/)).toBeInTheDocument();
    expect(botao()).toBeDisabled();
  });

  it('só habilita com o e-mail da conta, sem diferenciar maiúsculas nem espaços nas pontas', async () => {
    const { usuario } = montar();
    await usuario.type(campo(), 'outra@exemplo.test');
    expect(botao()).toBeDisabled();
    await usuario.clear(campo());
    await usuario.type(campo(), '  ana.silva@exemplo.test ');
    expect(botao()).toBeEnabled();
  });

  it('envia o e-mail digitado e entrega a data prevista', async () => {
    vi.spyOn(API, 'solicitarExclusao').mockResolvedValue({ requested_at: '2026-11-08T12:00:00Z', scheduled_for: '2026-12-08T12:00:00Z' });
    const { usuario, aoConcluir } = montar();
    await usuario.type(campo(), 'ana.silva@exemplo.test');
    await usuario.click(botao());
    expect(API.solicitarExclusao).toHaveBeenCalledWith('ana.silva@exemplo.test');
    expect(aoConcluir).toHaveBeenCalledWith('2026-12-08T12:00:00Z');
  });

  it('o Enter no campo também envia', async () => {
    vi.spyOn(API, 'solicitarExclusao').mockResolvedValue({ scheduled_for: '2026-12-08T12:00:00Z' });
    const { usuario, aoConcluir } = montar();
    await usuario.type(campo(), 'ana.silva@exemplo.test{Enter}');
    expect(aoConcluir).toHaveBeenCalledTimes(1);
  });

  it('mostra o erro da API e deixa tentar de novo, sem concluir', async () => {
    vi.spyOn(API, 'solicitarExclusao').mockRejectedValue(
      new ErroApi(400, 'CONFIRMACAO_INVALIDA', 'Digite o e-mail da sua conta para confirmar a exclusão.'),
    );
    const { usuario, aoConcluir } = montar();
    await usuario.type(campo(), 'ana.silva@exemplo.test');
    await usuario.click(botao());
    expect(await screen.findByRole('alert')).toHaveTextContent('Digite o e-mail da sua conta');
    expect(aoConcluir).not.toHaveBeenCalled();
    expect(botao()).toBeEnabled();
  });

  it('cancelar fecha sem chamar a API', async () => {
    vi.spyOn(API, 'solicitarExclusao');
    const { usuario, aoFechar } = montar();
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(aoFechar).toHaveBeenCalled();
    expect(API.solicitarExclusao).not.toHaveBeenCalled();
  });
});
