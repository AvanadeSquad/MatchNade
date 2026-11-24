import { useEffect, useState } from 'react';

// Mesmo ponto de quebra do CSS (global.css): abaixo de 900 px vale o layout de celular.
export const CONSULTA_CELULAR = '(max-width: 899px)';

const consultar = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(CONSULTA_CELULAR).matches;

// Verdadeiro em telas de celular. Usado só onde a estrutura da tela muda; o resto se adapta pelo CSS.
export function useCelular() {
  const [celular, setCelular] = useState(consultar);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const consulta = window.matchMedia(CONSULTA_CELULAR);
    const aoMudar = () => setCelular(consulta.matches);
    aoMudar();
    consulta.addEventListener?.('change', aoMudar);
    return () => consulta.removeEventListener?.('change', aoMudar);
  }, []);

  return celular;
}
