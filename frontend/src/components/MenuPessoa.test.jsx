import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AvisosProvider } from '../context/Avisos.jsx';
import { API } from '../services/api.js';
import MenuPessoa from './MenuPessoa.jsx';

function montar(props = {}) {
  return render(
    <AvisosProvider>
      <MenuPessoa pessoaId={7} nome="Pessoa Exemplo" {...props} />
    </AvisosProvider>,
  );
}

describe('MenuPessoa', () => {
  beforeEach(() => {
    vi.spyOn(API, 'bloquear').mockResolvedValue(null);
    vi.spyOn(API, 'denunciar').mockResolvedValue(null);
  });

  it('ao abrir, foca o primeiro item; setas percorrem os itens em ciclo; Esc fecha e devolve o foco', async () => {
    const usuario = userEvent.setup();
    montar();
    const gatilho = screen.getByRole('button', { name: 'Mais opções' });
    await usuario.click(gatilho);
    expect(gatilho).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menuitem', { name: 'Bloquear' })).toHaveFocus();
    await usuario.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Denunciar' })).toHaveFocus();
    await usuario.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Bloquear' })).toHaveFocus();
    await usuario.keyboard('{ArrowUp}');
    expect(screen.getByRole('menuitem', { name: 'Denunciar' })).toHaveFocus();
    await usuario.keyboard('{Home}');
    expect(screen.getByRole('menuitem', { name: 'Bloquear' })).toHaveFocus();
    await usuario.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(gatilho).toHaveFocus();
  });

  it('bloquear pede confirmação, chama a API, avisa com texto neutro e roda aoBloquear', async () => {
    const usuario = userEvent.setup();
    const aoBloquear = vi.fn();
    montar({ aoBloquear });
    await usuario.click(screen.getByRole('button', { name: 'Mais opções' }));
    await usuario.click(screen.getByRole('menuitem', { name: 'Bloquear' }));
    const dialogo = screen.getByRole('dialog', { name: 'Bloquear Pessoa Exemplo?' });
    await usuario.click(dialogo.querySelector('.botao--perigo'));
    expect(API.bloquear).toHaveBeenCalledWith(7);
    expect(aoBloquear).toHaveBeenCalled();
    expect(await screen.findByText('Pessoa bloqueada: Pessoa Exemplo.')).toBeInTheDocument();
  });

  it('denunciar exige motivo e envia o texto sem espaços nas pontas', async () => {
    const usuario = userEvent.setup();
    montar();
    await usuario.click(screen.getByRole('button', { name: 'Mais opções' }));
    await usuario.click(screen.getByRole('menuitem', { name: 'Denunciar' }));
    await usuario.click(screen.getByRole('button', { name: 'Enviar denúncia' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Informe o motivo.');
    expect(API.denunciar).not.toHaveBeenCalled();
    await usuario.type(screen.getByLabelText('O que aconteceu?'), '  mensagem ofensiva  ');
    await usuario.click(screen.getByRole('button', { name: 'Enviar denúncia' }));
    expect(API.denunciar).toHaveBeenCalledWith(7, 'mensagem ofensiva');
  });
});
