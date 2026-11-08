import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API } from '../services/api.js';
import { AtalhosOutlook, LinkTeams } from './AtalhosCorporativos.jsx';

afterEach(() => vi.restoreAllMocks());

describe('LinkTeams', () => {
  it('mostra o link devolvido pela API, em nova aba e sem referência', async () => {
    vi.spyOn(API, 'contato').mockResolvedValue({ teams_url: 'https://teams.microsoft.com/l/chat/0/0?users=x%40y.test' });
    render(<LinkTeams conexaoId={5} />);
    const link = await screen.findByRole('link', { name: /Abrir no Teams/ });
    expect(link).toHaveAttribute('href', 'https://teams.microsoft.com/l/chat/0/0?users=x%40y.test');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(API.contato).toHaveBeenCalledWith(5);
  });

  it('não mostra nada quando a API recusa', async () => {
    vi.spyOn(API, 'contato').mockRejectedValue(new Error('403'));
    const { container } = render(<LinkTeams conexaoId={5} />);
    await waitFor(() => expect(API.contato).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});

describe('AtalhosOutlook', () => {
  beforeEach(() => {
    vi.spyOn(API, 'convite').mockResolvedValue({
      outlook_url: 'https://outlook.office.com/calendar/0/deeplink/compose?x=1',
      ics: 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n',
      ics_filename: 'coffee-chat-2026-11-10.ics',
    });
  });

  it('pede o convite com início em UTC e duração de 15 minutos', async () => {
    render(<AtalhosOutlook conexaoId={5} quando="Segunda-feira, 10/11 às 10:30" />);
    await screen.findByRole('link', { name: /Adicionar ao Outlook/ });
    const [conexao, inicio, minutos] = API.convite.mock.calls[0];
    expect(conexao).toBe(5);
    expect(minutos).toBe(15);
    expect(new Date(inicio).getMinutes()).toBe(30);
    expect(inicio).toMatch(/Z$/);
  });

  it('baixa o arquivo .ics com o nome devolvido pela API', async () => {
    const usuario = userEvent.setup();
    const criar = vi.fn(() => 'blob:teste');
    URL.createObjectURL = criar;
    URL.revokeObjectURL = vi.fn();
    const cliques = [];
    const original = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function click() {
      cliques.push(this.download);
    };
    render(<AtalhosOutlook conexaoId={5} quando="Segunda-feira, 10/11 às 10:30" />);
    await usuario.click(await screen.findByRole('button', { name: /Baixar \.ics/ }));
    HTMLAnchorElement.prototype.click = original;
    expect(cliques).toEqual(['coffee-chat-2026-11-10.ics']);
    expect(criar).toHaveBeenCalledTimes(1);
  });

  it('não chama a API quando o texto do horário não pode ser lido', () => {
    const { container } = render(<AtalhosOutlook conexaoId={5} quando="amanhã cedo" />);
    expect(API.convite).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });
});
