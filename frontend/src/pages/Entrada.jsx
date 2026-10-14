import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconePessoas } from '../components/Icones.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const DURACAO_MS = 1600;

export default function Entrada() {
  const navegar = useNavigate();
  const { token, carregando } = useAuth();

  // Após a abertura, vai para a descoberta se houver sessão, ou para o login.
  useEffect(() => {
    if (carregando) return undefined;
    const espera = setTimeout(() => navegar(token ? '/descobrir' : '/login', { replace: true }), DURACAO_MS);
    return () => clearTimeout(espera);
  }, [navegar, token, carregando]);

  return (
    <main className="tela tela--centro">
      <div className="entrada__logo"><IconePessoas /></div>
      <h1>
        Avanade <span className="destaque">Connect</span>
      </h1>
      <p className="subtitulo">Plataforma interna para colaboradores da Avanade</p>
    </main>
  );
}
