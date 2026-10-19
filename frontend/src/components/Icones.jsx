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
      <svg width="1em" height="1em" {...base} {...props}>
        {caminhos.map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    );
  };

export const IconeBussola = icone('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M15.5 8.5l-2 5-5 2 2-5 5-2z');
export const IconeMatches = icone('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M8 12l3 3 5-6');
export const IconeChat = icone('M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.5A8 8 0 1 1 21 12z');
export const IconeMensagem = icone('M4 5h16v11H8l-4 4V5z', 'M8 9h8M8 12.5h5');
export const IconePerfil = icone('M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M4 21a8 8 0 0 1 16 0');
export const IconePessoas = icone(
  'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  'M2.5 20a6.5 6.5 0 0 1 13 0',
  'M16 4.2a3.5 3.5 0 0 1 0 6.6',
  'M18 14.2a6.5 6.5 0 0 1 3.5 5.8',
);
export const IconeX = icone('M6 6l12 12M18 6L6 18');
export const IconeCoracao = icone('M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z');
export const IconeVoltar = icone('M19 12H5', 'M12 19l-7-7 7-7');
export const IconeSeta = icone('M5 12h14', 'M12 5l7 7-7 7');
export const IconeMais = icone('M12 5v.01M12 12v.01M12 19v.01');
export const IconeEnviar = icone('M22 2L11 13', 'M22 2l-7 20-4-9-9-4 20-7z');
export const IconeCheck = icone('M5 12.5l4.5 4.5L19 7.5');
export const IconeCheckCirculo = icone('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M8.5 12.5l2.5 2.5 4.5-5');
export const IconeEditar = icone('M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z');
export const IconeEscudo = icone('M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z');
export const IconeEscudoCheck = icone('M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', 'M9 12l2 2 4-4');
export const IconeSair = icone('M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9');
export const IconeInfo = icone('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 16v-4', 'M12 8h.01');
export const IconeAjuda = icone('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M9.5 9a2.5 2.5 0 0 1 4.9.8c0 1.7-2.4 2.2-2.4 3.7', 'M12 17h.01');
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
export const IconeBusca = icone('M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.3-4.3');
export const IconeSino = icone('M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.9 1.9 0 0 0 3.4 0');
export const IconeRaio = icone('M13 2L4 14h7l-1 8 9-12h-7l1-8z');
export const IconeAjustes = icone('M4 6h10M18 6h2', 'M4 12h4M12 12h8', 'M4 18h12M20 18h0', 'M16 4v4M10 10v4M18 16v4');
export const IconeCalendario = icone('M4 6h16v15H4z', 'M4 10h16', 'M8 3v4M16 3v4');
export const IconeRelogio = icone('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 7v5l3 2');
export const IconeGlobo = icone('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M3 12h18', 'M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18');
export const IconePredio = icone('M4 21V5l8-2v18', 'M12 8h8v13', 'M2 21h20', 'M7 8h2M7 12h2M7 16h2M15 12h2M15 16h2');
export const IconeTelefone = icone(
  'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z',
);
export const IconeEmail = icone('M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-3.5 7.1');
export const IconeCracha = icone('M3 6h18v13H3z', 'M8 12.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', 'M5 16.5a3 3 0 0 1 6 0', 'M14 10h4M14 14h3');
export const IconeUpload = icone('M7 18a5 5 0 0 1-.6-10A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9', 'M12 12v8', 'M9 15l3-3 3 3');
export const IconeBrilho = icone(
  'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z',
  'M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z',
);
export const IconeOlho = icone('M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z');
export const IconeOlhoFechado = icone(
  'M9.9 4.2A10 10 0 0 1 12 4c6.4 0 10 8 10 8a17 17 0 0 1-2.2 3.2',
  'M6.6 6.6A17 17 0 0 0 2 12s3.6 8 10 8a9.7 9.7 0 0 0 5.4-1.6',
  'M3 3l18 18',
  'M9.9 9.9a3 3 0 0 0 4.2 4.2',
);
export const IconeCadeado = icone('M5 11h14v10H5z', 'M8 11V7a4 4 0 0 1 8 0v4');
export const IconeEmoji = icone('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M8 14s1.5 2 4 2 4-2 4-2', 'M9 9h.01M15 9h.01');
export const IconeAlvo = icone(
  'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
  'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
);
export const IconeVerificado = icone(
  'M12 2l2.4 1.8 3-.2.9 2.9 2.5 1.7-1 2.8 1 2.8-2.5 1.7-.9 2.9-3-.2L12 22l-2.4-1.8-3 .2-.9-2.9-2.5-1.7 1-2.8-1-2.8 2.5-1.7.9-2.9 3 .2L12 2z',
  'M8.5 12l2.5 2.5 4.5-5',
);
export const IconeAtualizar = icone('M21 12a9 9 0 0 1-15.5 6.3L3 16', 'M3 12a9 9 0 0 1 15.5-6.3L21 8', 'M21 3v5h-5', 'M3 21v-5h5');
export const IconeDocumento = icone('M6 2h9l5 5v15H6z', 'M14 2v6h6', 'M9 13h6M9 17h6');
export const IconeMaleta = icone('M3 7h18v13H3z', 'M8 7V4h8v3', 'M3 13h18');
export const IconeVideo = icone('M3 6h12v12H3z', 'M15 10l6-3v10l-6-3');

// Marcas dos provedores de login corporativo (formas simples, sem texto).
export function IconeMicrosoft(props) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path fill="#F25022" d="M2 2h9.5v9.5H2z" />
      <path fill="#7FBA00" d="M12.5 2H22v9.5h-9.5z" />
      <path fill="#00A4EF" d="M2 12.5h9.5V22H2z" />
      <path fill="#FFB900" d="M12.5 12.5H22V22h-9.5z" />
    </svg>
  );
}

export function IconeLinkedin(props) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <rect width="24" height="24" rx="4" fill="#0A66C2" />
      <path
        fill="#fff"
        d="M6.5 9.5h2.6V18H6.5zM7.8 5.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM10.8 9.5h2.5v1.2c.4-.7 1.3-1.4 2.6-1.4 2.7 0 3.2 1.8 3.2 4.1V18h-2.6v-4c0-1 0-2.2-1.4-2.2s-1.6 1-1.6 2.1V18h-2.6z"
      />
    </svg>
  );
}

export function IconeGoogle(props) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.3H12v4.3h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2-1.9 3.2-4.7 3.2-8z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9l3.7-2.8z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z" />
    </svg>
  );
}
export const IconeEngrenagem = icone(
  'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  'M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
);
export const IconeChevron = icone('M9 6l6 6-6 6');
