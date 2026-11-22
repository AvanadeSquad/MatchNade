import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import InteressesRelacionados from './InteressesRelacionados.jsx';

const PARES = [
  { mine: 'FastAPI', theirs: 'Python', similarity: 0.97 },
  { mine: 'Django', theirs: 'Python', similarity: 0.95 },
];

describe('InteressesRelacionados', () => {
  it('não mostra nada sem pares, que é o caso com o score semântico desligado', () => {
    const { container } = render(<InteressesRelacionados pares={[]} nome="Bia" />);
    expect(container).toBeEmptyDOMElement();
    const semLista = render(<InteressesRelacionados nome="Bia" />);
    expect(semLista.container).toBeEmptyDOMElement();
  });

  it('lista cada par com o seu interesse e o da outra pessoa', () => {
    render(<InteressesRelacionados pares={PARES} nome="Bia" />);
    expect(screen.getByRole('heading', { name: /interesses parecidos/i })).toBeInTheDocument();
    expect(screen.getByText('FastAPI')).toBeInTheDocument();
    expect(screen.getAllByText('Python')).toHaveLength(2);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('explica de quem é cada interesse e não mostra o número da similaridade como percentual solto', () => {
    render(<InteressesRelacionados pares={PARES} nome="Bia" />);
    expect(screen.getAllByText(/Bia/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/97/)).not.toBeInTheDocument();
  });
});
