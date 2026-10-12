import { useEffect, useId, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { iniciais } from '../utils/formatar.js';
import { IconeVoltar } from './Icones.jsx';

// Avatar com as iniciais do nome. `tamanho` em pixels.
export function Avatar({ nome, tamanho = 48 }) {
  return (
    <div className="avatar" style={{ width: tamanho, height: tamanho, fontSize: tamanho * 0.36 }} aria-hidden="true">
      {iniciais(nome)}
    </div>
  );
}

// Cabeçalho das telas internas: botão de voltar, título e uma ação opcional à direita.
export function Cabecalho({ titulo, aoVoltar, acao }) {
  const navegar = useNavigate();
  return (
    <header className="cabecalho">
      <button type="button" className="icone-botao" aria-label="Voltar" onClick={aoVoltar ?? (() => navegar(-1))}>
        <IconeVoltar />
      </button>
      <h1 className="cabecalho__titulo">{titulo}</h1>
      <div className="cabecalho__acao">{acao}</div>
    </header>
  );
}

export function Carregando({ texto = 'Carregando...' }) {
  return (
    <div className="estado" role="status">
      <div className="giro" aria-hidden="true" />
      <p>{texto}</p>
    </div>
  );
}

export function Vazio({ titulo, texto, children }) {
  return (
    <div className="estado">
      <h2>{titulo}</h2>
      {texto && <p>{texto}</p>}
      {children}
    </div>
  );
}

export function Erro({ erro, aoTentarDeNovo }) {
  return (
    <div className="estado" role="alert">
      <h2>Não deu certo</h2>
      <p>{erro?.message ?? 'Algo deu errado. Tente novamente.'}</p>
      {aoTentarDeNovo && (
        <button type="button" className="botao botao--contorno botao--auto" onClick={aoTentarDeNovo}>
          Tentar de novo
        </button>
      )}
    </div>
  );
}

const FOCAVEIS = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Janela de diálogo acessível: foco inicial no diálogo, Tab preso dentro dele, Esc e clique fora fecham.
// Com `ocupado`, nada fecha (por exemplo, enquanto uma ação está sendo enviada).
export function Modal({ titulo, aoFechar, ocupado = false, children }) {
  const idTitulo = useId();
  const caixa = useRef(null);
  // O fechamento mais recente fica num ref para o efeito rodar só ao abrir e ao fechar o diálogo,
  // sem devolver o foco a cada nova renderização do pai.
  const fechar = useRef(aoFechar);
  const bloqueado = useRef(ocupado);
  fechar.current = aoFechar;
  bloqueado.current = ocupado;

  useEffect(() => {
    const anterior = document.activeElement;
    caixa.current?.focus();

    const aoTeclar = (evento) => {
      if (evento.key === 'Escape' && !bloqueado.current) {
        fechar.current();
        return;
      }
      if (evento.key !== 'Tab' || !caixa.current) return;
      const itens = [...caixa.current.querySelectorAll(FOCAVEIS)];
      if (!itens.length) {
        evento.preventDefault();
        return;
      }
      const primeiro = itens[0];
      const ultimo = itens[itens.length - 1];
      const dentro = caixa.current.contains(document.activeElement) && document.activeElement !== caixa.current;
      if (evento.shiftKey && (!dentro || document.activeElement === primeiro)) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && (!dentro || document.activeElement === ultimo)) {
        evento.preventDefault();
        primeiro.focus();
      }
    };

    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      anterior?.focus?.();
    };
  }, []);

  return (
    <div className="modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && !ocupado && aoFechar()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={idTitulo} tabIndex={-1} ref={caixa}>
        <h2 id={idTitulo}>{titulo}</h2>
        {children}
      </div>
    </div>
  );
}

// Chip que alterna entre selecionado e não selecionado.
export function ChipEscolha({ selecionado, aoAlternar, children }) {
  return (
    <button type="button" className={`chip chip--escolha${selecionado ? ' chip--ativo' : ''}`} aria-pressed={selecionado} onClick={aoAlternar}>
      {children}
    </button>
  );
}

export function Barra({ rotulo, valor }) {
  const pct = Math.round(valor * 100);
  return (
    <div className="barra">
      <div className="barra__linha">
        <span>{rotulo}</span>
        <strong>{pct}%</strong>
      </div>
      <div className="barra__trilho" role="img" aria-label={`${rotulo}: ${pct}%`}>
        <div className="barra__preenchimento" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// Singular ou plural conforme a quantidade: plural(1, 'interesse', 'interesses') -> "1 interesse".
export const plural = (quantidade, singular, pluralTexto) => `${quantidade} ${quantidade === 1 ? singular : pluralTexto}`;
