import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AVATARES } from './AvataresProntos.jsx';
import { Avatar, Pronomes } from './Basicos.jsx';

describe('Avatar', () => {
  it('sem avatar pronto, mostra as iniciais', () => {
    render(<Avatar nome="Ana Silva" />);
    expect(screen.getByText('AS')).toBeInTheDocument();
  });

  it('com um avatar pronto, mostra a ilustração no lugar das iniciais', () => {
    const { container } = render(<Avatar nome="Ana Silva" avatarId="lua" />);
    expect(screen.queryByText('AS')).not.toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('avatar--pronto');
  });

  it('código desconhecido volta para as iniciais', () => {
    render(<Avatar nome="Ana Silva" avatarId="dragao" />);
    expect(screen.getByText('AS')).toBeInTheDocument();
  });

  it('tem 12 avatares, com códigos únicos', () => {
    expect(AVATARES).toHaveLength(12);
    expect(new Set(AVATARES.map((a) => a.id)).size).toBe(12);
  });
});

describe('Pronomes', () => {
  it('mostra o texto quando existe e nada quando está vazio', () => {
    const { container, rerender } = render(<Pronomes valor="ela/dela" />);
    expect(screen.getByText('ela/dela')).toBeInTheDocument();
    rerender(<Pronomes valor={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
