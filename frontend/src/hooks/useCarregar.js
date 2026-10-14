import { useCallback, useEffect, useRef, useState } from 'react';

// Executa `buscar` ao montar e quando `dependencias` mudam. Devolve { dados, erro, carregando, recarregar }.
// Ignora respostas de execuções antigas, evitando atualizar a tela com dados desatualizados.
export function useCarregar(buscar, dependencias = []) {
  const [estado, setEstado] = useState({ dados: null, erro: null, carregando: true });
  const versao = useRef(0);

  const executar = useCallback(() => {
    const minha = ++versao.current;
    setEstado((atual) => ({ ...atual, erro: null, carregando: true }));
    buscar()
      .then((dados) => minha === versao.current && setEstado({ dados, erro: null, carregando: false }))
      .catch((erro) => minha === versao.current && setEstado({ dados: null, erro, carregando: false }));
  }, dependencias);

  useEffect(() => {
    executar();
    return () => {
      versao.current += 1;
    };
  }, [executar]);

  return { ...estado, recarregar: executar };
}
