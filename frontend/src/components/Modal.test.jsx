import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from './Basicos.jsx';

function ComBotao({ aoFechar = () => {}, ocupado = false }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setAberto(true)}>
        Abrir
      </button>
      {aberto && (
        <Modal
          titulo="Confirmar"
          ocupado={ocupado}
          aoFechar={() => {
            aoFechar();
            setAberto(false);
          }}
        >
          <button type="button">Primeiro</button>
          <button type="button">Último</button>
        </Modal>
      )}
    </>
  );
}

describe('Modal', () => {
  it('ao abrir, coloca o foco no diálogo, que é nomeado pelo título', async () => {
    const usuario = userEvent.setup();
    render(<ComBotao />);
    await usuario.click(screen.getByRole('button', { name: 'Abrir' }));
    expect(screen.getByRole('dialog', { name: 'Confirmar' })).toHaveFocus();
  });

  it('prende o Tab dentro do diálogo nos dois sentidos', async () => {
    const usuario = userEvent.setup();
    render(<ComBotao />);
    await usuario.click(screen.getByRole('button', { name: 'Abrir' }));
    await usuario.tab();
    expect(screen.getByRole('button', { name: 'Primeiro' })).toHaveFocus();
    await usuario.tab();
    expect(screen.getByRole('button', { name: 'Último' })).toHaveFocus();
    await usuario.tab();
    expect(screen.getByRole('button', { name: 'Primeiro' })).toHaveFocus();
    await usuario.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Último' })).toHaveFocus();
  });

  it('Esc fecha e devolve o foco ao botão que abriu', async () => {
    const usuario = userEvent.setup();
    const aoFechar = vi.fn();
    render(<ComBotao aoFechar={aoFechar} />);
    await usuario.click(screen.getByRole('button', { name: 'Abrir' }));
    await usuario.keyboard('{Escape}');
    expect(aoFechar).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir' })).toHaveFocus();
  });

  it('ocupado, não fecha com Esc nem com clique no fundo', async () => {
    const usuario = userEvent.setup();
    const aoFechar = vi.fn();
    const { container } = render(<ComBotao aoFechar={aoFechar} ocupado />);
    await usuario.click(screen.getByRole('button', { name: 'Abrir' }));
    await usuario.keyboard('{Escape}');
    await usuario.click(container.ownerDocument.querySelector('.modal-fundo'));
    expect(aoFechar).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
