import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { API } from '../services/api.js';
import SeletorTags from './SeletorTags.jsx';

const CATALOGO = ['Python', 'Node.js', 'React', 'Fotografia', 'Café especial', 'Engenharia de dados', 'Dados abertos'];
const USO = new Map([
  ['engenharia de dados', 9],
  ['dados abertos', 1],
]);

// Mantém as tags selecionadas em estado, como as telas que usam o seletor.
function Seletor({ aoAlternar = () => {}, aoCriar = vi.fn(async () => {}), iniciais = [] }) {
  const [selecionadas, setSelecionadas] = useState(
    () => new Map(iniciais.map((n) => [n.toLowerCase(), { nome: n, categoria: 'TECHNICAL' }])),
  );
  const alternar = (nome, categoria) => {
    aoAlternar(nome, categoria);
    setSelecionadas((atual) => {
      const nova = new Map(atual);
      if (nova.has(nome.toLowerCase())) nova.delete(nome.toLowerCase());
      else nova.set(nome.toLowerCase(), { nome, categoria });
      return nova;
    });
  };
  return (
    <SeletorTags categoria="TECHNICAL" catalogo={CATALOGO} selecionadas={selecionadas} aoAlternar={alternar} aoCriar={aoCriar} uso={USO} />
  );
}

const campo = () => screen.getByRole('combobox', { name: 'Adicionar outra skill' });
const opcoes = () => within(screen.getByRole('listbox', { hidden: true })).queryAllByRole('option');
const nomesDasOpcoes = () => opcoes().map((o) => o.textContent);

describe('SeletorTags: sugestões ao digitar', () => {
  it('sugere sem acento e sem diferenciar maiúscula, a partir de 1 caractere', async () => {
    const u = userEvent.setup();
    render(<Seletor />);
    expect(campo()).toHaveAttribute('aria-expanded', 'false');
    await u.type(campo(), 'CAFE');
    expect(nomesDasOpcoes()).toEqual(['Café especial']);
    await u.clear(campo());
    await u.type(campo(), 'f');
    expect(nomesDasOpcoes()).toContain('Fotografia');
    expect(campo()).toHaveAttribute('aria-expanded', 'true');
  });

  it('ordena: começa com o texto antes de só conter, e por uso dentro de cada grupo', async () => {
    const u = userEvent.setup();
    render(<Seletor />);
    await u.type(campo(), 'dados');
    expect(nomesDasOpcoes()).toEqual(['Dados abertos', 'Engenharia de dados']);
  });

  it('destaca o trecho que casou dentro do texto da opção', async () => {
    const u = userEvent.setup();
    render(<Seletor />);
    await u.type(campo(), 'graf');
    const [opcao] = opcoes();
    expect(opcao).toHaveTextContent('Fotografia');
    expect(opcao.querySelector('mark')).toHaveTextContent('graf');
  });

  it('não sugere o que já está selecionado', async () => {
    const u = userEvent.setup();
    render(<Seletor iniciais={['Python']} />);
    await u.type(campo(), 'pyt');
    expect(opcoes()).toHaveLength(0);
    expect(campo()).toHaveAttribute('aria-expanded', 'false');
  });

  it('teclado: setas movem a opção ativa, Escape fecha e Enter escolhe', async () => {
    const u = userEvent.setup();
    const aoAlternar = vi.fn();
    render(<Seletor aoAlternar={aoAlternar} />);
    await u.type(campo(), 'dados');
    await u.keyboard('{ArrowDown}');
    expect(campo()).toHaveAttribute('aria-activedescendant', opcoes()[0].id);
    expect(opcoes()[0]).toHaveAttribute('aria-selected', 'true');
    await u.keyboard('{ArrowDown}');
    expect(opcoes()[1]).toHaveAttribute('aria-selected', 'true');
    await u.keyboard('{ArrowDown}');
    expect(opcoes()[0]).toHaveAttribute('aria-selected', 'true');
    await u.keyboard('{Escape}');
    expect(campo()).toHaveAttribute('aria-expanded', 'false');
    await u.keyboard('{ArrowUp}');
    expect(opcoes()[1]).toHaveAttribute('aria-selected', 'true');
    await u.keyboard('{Enter}');
    expect(aoAlternar).toHaveBeenCalledWith('Engenharia de dados', 'TECHNICAL');
    expect(campo()).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Engenharia de dados' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicar numa sugestão alterna a tag com a grafia do catálogo e limpa o campo', async () => {
    const u = userEvent.setup();
    const aoAlternar = vi.fn();
    render(<Seletor aoAlternar={aoAlternar} />);
    await u.type(campo(), 'node');
    await u.click(screen.getByRole('option', { name: 'Node.js' }));
    expect(aoAlternar).toHaveBeenCalledWith('Node.js', 'TECHNICAL');
    expect(campo()).toHaveValue('');
  });

  it('clicar fora fecha a lista', async () => {
    const u = userEvent.setup();
    render(
      <>
        <Seletor />
        <p>Fora</p>
      </>,
    );
    await u.type(campo(), 'react');
    expect(campo()).toHaveAttribute('aria-expanded', 'true');
    await u.click(screen.getByText('Fora'));
    expect(campo()).toHaveAttribute('aria-expanded', 'false');
  });

  it('sair do campo com Tab fecha a lista', async () => {
    const u = userEvent.setup();
    render(<Seletor />);
    await u.type(campo(), 'react');
    expect(campo()).toHaveAttribute('aria-expanded', 'true');
    await u.tab();
    expect(campo()).not.toHaveFocus();
    expect(campo()).toHaveAttribute('aria-expanded', 'false');
    expect(opcoes()).toHaveLength(0);
  });

  it('digitar não cria tag nem chama a API', async () => {
    const u = userEvent.setup();
    const aoCriar = vi.fn();
    const chamadas = Object.keys(API).map((nome) => vi.spyOn(API, nome));
    render(<Seletor aoCriar={aoCriar} />);
    await u.type(campo(), 'engenharia de');
    expect(aoCriar).not.toHaveBeenCalled();
    for (const chamada of chamadas) expect(chamada).not.toHaveBeenCalled();
  });
});

describe('SeletorTags: evitar duplicatas ao adicionar', () => {
  it('texto igual à tag existente depois de normalizar seleciona a existente sem criar', async () => {
    const u = userEvent.setup();
    const aoCriar = vi.fn();
    const aoAlternar = vi.fn();
    render(<Seletor aoCriar={aoCriar} aoAlternar={aoAlternar} />);
    await u.type(campo(), 'node js');
    await u.keyboard('{Escape}');
    await u.click(screen.getByRole('button', { name: /adicionar/i }));
    expect(aoCriar).not.toHaveBeenCalled();
    expect(aoAlternar).toHaveBeenCalledWith('Node.js', 'TECHNICAL');
    expect(campo()).toHaveValue('');
  });

  it('avisa quando reaproveita a tag existente e o aviso some ao digitar de novo', async () => {
    const u = userEvent.setup();
    render(<Seletor />);
    await u.type(campo(), 'node js');
    await u.keyboard('{Escape}{Enter}');
    expect(screen.getByRole('status')).toHaveTextContent('Node.js foi selecionada');
    await u.type(campo(), 'n');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('avisa quando a tag existente já estava na lista', async () => {
    const u = userEvent.setup();
    const aoAlternar = vi.fn();
    render(<Seletor iniciais={['Python']} aoAlternar={aoAlternar} />);
    await u.type(campo(), 'python{Enter}');
    expect(screen.getByRole('status')).toHaveTextContent('Python já está na lista');
    expect(aoAlternar).not.toHaveBeenCalled();
  });

  it('sem a lista aberta, Enter envia o formulário como antes', async () => {
    const u = userEvent.setup();
    const aoCriar = vi.fn(async () => {});
    render(<Seletor aoCriar={aoCriar} />);
    await u.type(campo(), 'Terraform{Enter}');
    expect(aoCriar).toHaveBeenCalledWith('Terraform', 'TECHNICAL');
  });

  it('texto parecido mostra o aviso e só cria com "Criar mesmo assim"', async () => {
    const u = userEvent.setup();
    const aoCriar = vi.fn(async () => {});
    const aoAlternar = vi.fn();
    render(<Seletor aoCriar={aoCriar} aoAlternar={aoAlternar} />);
    await u.type(campo(), 'Pyhton{Enter}');
    expect(screen.getByText('Já existe: Python. Usar essa?')).toBeInTheDocument();
    expect(aoCriar).not.toHaveBeenCalled();
    await u.click(screen.getByRole('button', { name: 'Criar mesmo assim' }));
    expect(aoCriar).toHaveBeenCalledWith('Pyhton', 'TECHNICAL');
    expect(aoAlternar).not.toHaveBeenCalled();
  });

  it('no aviso, "Usar Python" seleciona a existente sem criar', async () => {
    const u = userEvent.setup();
    const aoCriar = vi.fn();
    const aoAlternar = vi.fn();
    render(<Seletor aoCriar={aoCriar} aoAlternar={aoAlternar} />);
    await u.type(campo(), 'Pyhton{Enter}');
    await u.click(screen.getByRole('button', { name: 'Usar Python' }));
    expect(aoAlternar).toHaveBeenCalledWith('Python', 'TECHNICAL');
    expect(aoCriar).not.toHaveBeenCalled();
    expect(screen.queryByText(/Já existe/)).not.toBeInTheDocument();
  });

  it('o erro de validação da API continua aparecendo', async () => {
    const u = userEvent.setup();
    const aoCriar = vi.fn(async () => {
      throw new Error('Essa tag não é válida.');
    });
    render(<Seletor aoCriar={aoCriar} />);
    await u.type(campo(), 'Gerente{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('Essa tag não é válida.');
  });
});
