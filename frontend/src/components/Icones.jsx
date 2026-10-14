const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: 'false',
};

const icone = (...caminhos) =>
  function Icone(props) {
    return (
      <svg {...base} {...props}>
        {caminhos.map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    );
  };

export const IconeBussola = icone('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M15.5 8.5l-2 5-5 2 2-5 5-2z');
export const IconeMatches = icone('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M8 12l3 3 5-6');
export const IconeChat = icone('M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.5A8 8 0 1 1 21 12z');
export const IconePerfil = icone('M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M4 21a8 8 0 0 1 16 0');
export const IconePessoas = icone('M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z', 'M2.5 20a6.5 6.5 0 0 1 13 0', 'M16 4.2a3.5 3.5 0 0 1 0 6.6', 'M18 14.2a6.5 6.5 0 0 1 3.5 5.8');
export const IconeX = icone('M6 6l12 12M18 6L6 18');
export const IconeCoracao = icone('M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z');
export const IconeVoltar = icone('M19 12H5', 'M12 19l-7-7 7-7');
export const IconeMais = icone('M12 5v.01M12 12v.01M12 19v.01');
export const IconeEnviar = icone('M22 2L11 13', 'M22 2l-7 20-4-9-9-4 20-7z');
export const IconeCheck = icone('M5 12.5l4.5 4.5L19 7.5');
export const IconeEditar = icone('M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z');
export const IconeEscudo = icone('M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z');
export const IconeSair = icone('M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9');
export const IconeInfo = icone('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 16v-4', 'M12 8h.01');
export const IconeChip = icone('M7 7h10v10H7z', 'M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3');
export const IconePino = icone('M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z', 'M12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z');
export const IconeCha = icone('M5 8h11v5a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5V8z', 'M16 9h2a2 2 0 0 1 0 4h-2', 'M8 3v2M12 3v2');
export const IconeLampada = icone('M9 18h6M10 21h4', 'M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z');
export const IconeEstrela = icone('M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z');
export const IconeMentoria = icone('M3 17l6-6 4 4 8-8', 'M15 7h6v6');
export const IconeUsuarioMais = icone('M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M2 21a8 8 0 0 1 16 0', 'M19 8v6M16 11h6');
export const IconeBloquear = icone('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M5.6 5.6l12.8 12.8');
export const IconeBandeira = icone('M5 21V4', 'M5 4h12l-2 4 2 4H5');
export const IconeSomar = icone('M12 5v14M5 12h14');
export const IconeSubtrair = icone('M5 12h14');
