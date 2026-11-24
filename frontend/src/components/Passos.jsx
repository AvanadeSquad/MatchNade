import { IconeCheck } from './Icones.jsx';

const PASSOS = [
  { titulo: 'Dados básicos', legenda: 'Perfil do colaborador' },
  { titulo: 'Interesses & IA', legenda: 'Mapeamento de afinidades' },
  { titulo: 'Preferências', legenda: 'Parâmetros de match' },
];

// Indicador das três etapas do cadastro. `atual` vai de 1 a 3.
export default function Passos({ atual }) {
  return (
    <nav className="passos" aria-label="Etapas do cadastro">
      <ol>
        {PASSOS.map(({ titulo, legenda }, i) => {
          const numero = i + 1;
          const estado = numero < atual ? 'feito' : numero === atual ? 'atual' : 'espera';
          return (
            <li key={titulo} className={`passos__item passos__item--${estado}`} aria-current={estado === 'atual' ? 'step' : undefined}>
              <span className="passos__marca">{estado === 'feito' ? <IconeCheck /> : numero}</span>
              <span className="passos__texto">
                <span className="passos__rotulo">{estado === 'atual' ? `Passo ${numero} • ativo` : `Passo ${numero}`}</span>
                <strong>{titulo}</strong>
                <span className="passos__legenda">{legenda}</span>
              </span>
              {numero < PASSOS.length && <span className="passos__linha" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
