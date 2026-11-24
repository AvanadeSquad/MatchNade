import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const AvisosContext = createContext(() => {});

// Mensagem curta no rodapé da tela, que some sozinha. Anunciada a leitores de tela (role="status").
export function AvisosProvider({ children }) {
  const [aviso, setAviso] = useState(null);
  const temporizador = useRef(null);

  const mostrar = useCallback((texto, tipo = 'info') => {
    clearTimeout(temporizador.current);
    setAviso({ texto, tipo });
    temporizador.current = setTimeout(() => setAviso(null), 3500);
  }, []);

  const valor = useMemo(() => mostrar, [mostrar]);
  return (
    <AvisosContext.Provider value={valor}>
      {children}
      <div className="avisos" role="status" aria-live="polite">
        {aviso && <div className={`aviso aviso--${aviso.tipo}`}>{aviso.texto}</div>}
      </div>
    </AvisosContext.Provider>
  );
}

export const useAviso = () => useContext(AvisosContext);
