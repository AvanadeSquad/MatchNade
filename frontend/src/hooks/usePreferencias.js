import { useCallback, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { lerPreferencias, salvarPreferencias } from '../utils/preferencias.js';

// Preferências locais da pessoa logada. `atualizar` grava na hora e devolve o novo valor.
export function usePreferencias() {
  const { perfil } = useAuth();
  const usuarioId = perfil?.id;
  const [preferencias, setPreferencias] = useState(() => lerPreferencias(usuarioId));

  const atualizar = useCallback(
    (parcial) => {
      const novas = salvarPreferencias(usuarioId, parcial);
      setPreferencias(novas);
      return novas;
    },
    [usuarioId],
  );

  return [preferencias, atualizar];
}
