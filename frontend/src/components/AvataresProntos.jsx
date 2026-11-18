// Avatares prontos para escolher no perfil: ilustração simples (SVG) sobre uma cor. Sem envio de imagem.
// Os códigos precisam bater com a lista validada pela API (AVATARES em backend/src/services/perfil.js).
// A cor de fundo é escura o bastante para o desenho branco ter contraste de elemento gráfico (3:1).
export const AVATARES = [
  { id: 'aurora', nome: 'Aurora', cor: '#5b65c8', desenho: <path d="M4 18a8 8 0 0 1 16 0M7 18a5 5 0 0 1 10 0M10 18a2 2 0 0 1 4 0" /> },
  { id: 'montanha', nome: 'Montanha', cor: '#2f7f6b', desenho: <path d="M3 19l6-10 4 6 2-3 6 7z" /> },
  { id: 'folha', nome: 'Folha', cor: '#3f8a3f', desenho: <path d="M5 19c0-8 5-13 14-14 0 9-5 14-14 14zM5 19l7-7" /> },
  { id: 'onda', nome: 'Onda', cor: '#2a7fa6', desenho: <path d="M3 9c3-3 6 3 9 0s6 3 9 0M3 15c3-3 6 3 9 0s6 3 9 0" /> },
  {
    id: 'estrela',
    nome: 'Estrela',
    cor: '#7a55c7',
    desenho: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />,
  },
  { id: 'raio', nome: 'Raio', cor: '#b5481a', desenho: <path d="M13 3L5 13h6l-1 8 8-10h-6z" /> },
  { id: 'lua', nome: 'Lua', cor: '#4a5470', desenho: <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" /> },
  {
    id: 'sol',
    nome: 'Sol',
    cor: '#b4691c',
    desenho: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
      </>
    ),
  },
  { id: 'nuvem', nome: 'Nuvem', cor: '#4b7bd1', desenho: <path d="M7 18a4 4 0 0 1-.5-8A5.5 5.5 0 0 1 17 8.5 4 4 0 0 1 17 18z" /> },
  {
    id: 'chama',
    nome: 'Chama',
    cor: '#c4511e',
    desenho: <path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 .3 1.5 1 2 2 2 0-3-1-5 1-8z" />,
  },
  { id: 'gota', nome: 'Gota', cor: '#1f8a9a', desenho: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" /> },
  { id: 'cristal', nome: 'Cristal', cor: '#b0428a', desenho: <path d="M12 3l7 6-7 12L5 9zM5 9h14M9 9l3 12M15 9l-3 12" /> },
];

export const avatarPorId = (id) => AVATARES.find((a) => a.id === id) ?? null;

// Desenho do avatar dentro de um círculo ou quadrado já colorido por quem chama.
export function IlustracaoAvatar({ avatar, tamanho }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={tamanho}
      height={tamanho}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {avatar.desenho}
    </svg>
  );
}
