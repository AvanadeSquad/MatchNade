import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { API, EVENTO_SESSAO_EXPIRADA } from '../services/api.js';
import { limparToken, obterToken, salvarToken } from '../services/sessao.js';
import { limparIgnorados } from '../utils/ignorados.js';

const AuthContext = createContext(null);

// Guarda a sessão (token e perfil) e o rascunho de interesses usado durante o cadastro.
export function AuthProvider({ children }) {
  const [token, setToken] = useState(obterToken());
  const [perfil, setPerfil] = useState(null);
  const [carregando, setCarregando] = useState(Boolean(obterToken()));
  const [erroPerfil, setErroPerfil] = useState(null);
  const [rascunho, setRascunho] = useState(null);
  const perfilRef = useRef(null);
  perfilRef.current = perfil;

  const sair = useCallback(() => {
    if (perfilRef.current) limparIgnorados(perfilRef.current.id);
    limparToken();
    setToken(null);
    setPerfil(null);
    setErroPerfil(null);
    setRascunho(null);
  }, []);

  const recarregarPerfil = useCallback(async () => {
    const dados = await API.perfil();
    setPerfil(dados);
    return dados;
  }, []);

  // Atualiza o perfil sem propagar falha: usada depois de uma ação que já deu certo no servidor.
  const atualizarPerfilEmSilencio = useCallback(async () => {
    try {
      return await recarregarPerfil();
    } catch {
      return null;
    }
  }, [recarregarPerfil]);

  const buscarPerfil = useCallback(() => {
    setCarregando(true);
    setErroPerfil(null);
    return API.perfil()
      .then(setPerfil)
      .catch((erro) => {
        // Só uma sessão recusada (401) encerra o login; falha de rede ou do servidor permite tentar de novo.
        if (erro.status === 401) sair();
        else setErroPerfil(erro);
      })
      .finally(() => setCarregando(false));
  }, [sair]);

  // Ao abrir o app com um token salvo, busca o perfil. Um login recém-feito já traz o perfil e não repete a busca.
  useEffect(() => {
    if (!token || perfilRef.current) {
      setCarregando(false);
      return;
    }
    buscarPerfil();
  }, [token, buscarPerfil]);

  useEffect(() => {
    window.addEventListener(EVENTO_SESSAO_EXPIRADA, sair);
    return () => window.removeEventListener(EVENTO_SESSAO_EXPIRADA, sair);
  }, [sair]);

  const entrar = useCallback((novoToken, dadosPerfil) => {
    salvarToken(novoToken);
    setPerfil(dadosPerfil);
    setToken(novoToken);
  }, []);

  const valor = useMemo(
    () => ({ token, perfil, carregando, erroPerfil, tentarDeNovo: buscarPerfil, entrar, sair, recarregarPerfil, atualizarPerfilEmSilencio, rascunho, setRascunho }),
    [token, perfil, carregando, erroPerfil, buscarPerfil, entrar, sair, recarregarPerfil, atualizarPerfilEmSilencio, rascunho],
  );
  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error('useAuth precisa estar dentro de AuthProvider');
  return contexto;
}
