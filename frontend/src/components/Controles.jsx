import { useId, useState } from 'react';
import { HUBS } from '../utils/preferencias.js';
import { IconeSomar, IconeX } from './Icones.jsx';

// Grupo de opções exclusivas com aparência de botões lado a lado (radiogroup acessível).
export function Segmentado({ rotulo, opcoes, valor, aoMudar }) {
  const nome = useId();
  return (
    <div className="segmentado" role="radiogroup" aria-label={rotulo}>
      {opcoes.map(({ id, rotulo: texto, Icone }) => (
        <label key={id} className={`segmentado__opcao${valor === id ? ' segmentado__opcao--ativa' : ''}`}>
          <input type="radio" name={nome} value={id} checked={valor === id} onChange={() => aoMudar(id)} className="so-leitor" />
          {Icone && <Icone />}
          {texto}
        </label>
      ))}
    </div>
  );
}

// Equilíbrio entre afinidade profissional e pessoal, de 0 a 100 (valor = peso profissional).
export function Equilibrio({ valor, aoMudar, compacto = false }) {
  const id = useId();
  return (
    <div className={`equilibrio${compacto ? ' equilibrio--compacto' : ''}`}>
      <div className="equilibrio__valores" aria-hidden="true">
        <span className="pilula pilula--azul">{valor}% Profissional</span>
        <span className="pilula pilula--laranja">{100 - valor}% Pessoal</span>
      </div>
      <label htmlFor={id} className="so-leitor">
        Peso da afinidade profissional
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={10}
        value={valor}
        onChange={(e) => aoMudar(Number(e.target.value))}
        className="equilibrio__trilho"
        style={{ '--pct': `${valor}%` }}
        aria-valuetext={`${valor}% profissional e ${100 - valor}% pessoal`}
      />
      <div className="equilibrio__legenda">
        <span>Mais foco técnico / carreira</span>
        <span>Mais amizade / descontração</span>
      </div>
    </div>
  );
}

// Polos Avanade habilitados: chips removíveis e um seletor para adicionar outro.
export function Polos({ polos, aoMudar }) {
  const [adicionando, setAdicionando] = useState(false);
  const disponiveis = HUBS.filter((h) => !polos.includes(h));
  return (
    <div className="polos">
      <ul className="chips" aria-label="Polos habilitados">
        {polos.map((polo) => (
          <li key={polo} className="chip chip--polo">
            {polo}
            <button type="button" aria-label={`Remover ${polo}`} onClick={() => aoMudar(polos.filter((p) => p !== polo))}>
              <IconeX />
            </button>
          </li>
        ))}
        {!polos.length && <li className="pequeno">Nenhum polo escolhido: as sugestões consideram todos.</li>}
      </ul>
      {adicionando ? (
        <select
          className="campo__controle campo__controle--pequeno"
          aria-label="Escolha um polo para adicionar"
          autoFocus
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) aoMudar([...polos, e.target.value]);
            setAdicionando(false);
          }}
          onBlur={() => setAdicionando(false)}
        >
          <option value="" disabled>
            Escolha um polo
          </option>
          {disponiveis.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
      ) : (
        disponiveis.length > 0 && (
          <button type="button" className="link-acao" onClick={() => setAdicionando(true)}>
            <IconeSomar /> Adicionar polo
          </button>
        )
      )}
    </div>
  );
}

// Interruptor liga e desliga com texto de apoio.
export function Interruptor({ titulo, descricao, ligado, aoMudar, desabilitado = false }) {
  return (
    <label className="interruptor">
      <span>
        <strong>{titulo}</strong>
        {descricao && <span className="pequeno">{descricao}</span>}
      </span>
      <input type="checkbox" role="switch" checked={ligado} disabled={desabilitado} onChange={(e) => aoMudar(e.target.checked)} />
      <span className="interruptor__trilho" aria-hidden="true" />
    </label>
  );
}

// Medidor circular de 0 a 100.
export function Anel({ valor, tamanho = 56 }) {
  return (
    <div className="anel" style={{ '--pct': `${valor}%`, width: tamanho, height: tamanho }} role="img" aria-label={`${valor}%`}>
      <span>{valor}%</span>
    </div>
  );
}
