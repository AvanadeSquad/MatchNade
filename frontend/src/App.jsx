import { useEffect, useState } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { Carregando, Erro } from './components/Basicos.jsx';
import { IconeMaleta } from './components/Icones.jsx';
import Layout from './components/Layout.jsx';
import { useAuth } from './context/AuthContext.jsx';
import CadastroDados from './pages/CadastroDados.jsx';
import CadastroInteresses from './pages/CadastroInteresses.jsx';
import CadastroPreferencias from './pages/CadastroPreferencias.jsx';
import Descobrir from './pages/Descobrir.jsx';
import Login from './pages/Login.jsx';
import Match from './pages/Match.jsx';
import Matches from './pages/Matches.jsx';
import Mensagens from './pages/Mensagens.jsx';
import MeuPerfil from './pages/MeuPerfil.jsx';
import PerfilPessoa from './pages/PerfilPessoa.jsx';

// Exige sessão. Enquanto o perfil carrega mostra um indicador; falha ao carregar permite tentar de novo;
// sem token volta ao login.
function RotaProtegida() {
  const { token, perfil, carregando, erroPerfil, tentarDeNovo, sair } = useAuth();
  if (token && erroPerfil && !perfil) {
    return (
      <main className="tela-centro">
        <Erro erro={erroPerfil} aoTentarDeNovo={tentarDeNovo} />
        <button type="button" className="botao botao--texto botao--auto" onClick={sair}>
          Sair da conta
        </button>
      </main>
    );
  }
  if (carregando || (token && !perfil))
    return (
      <main className="tela-centro">
        <Carregando />
      </main>
    );
  return token ? <Outlet /> : <Navigate to="/login" replace />;
}

// Telas do uso diário só abrem com o cadastro concluído (unidade, 3 interesses e um objetivo).
function RotaCompleta() {
  const { perfil } = useAuth();
  return perfil.profile_complete ? <Outlet /> : <Navigate to="/cadastro/dados" replace />;
}

const DURACAO_ABERTURA_MS = 1200;

// Abertura do app: mostra a marca por um instante e segue para o login, o cadastro ou a descoberta.
function Inicio() {
  const { token, perfil, carregando } = useAuth();
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    const espera = setTimeout(() => setPronto(true), DURACAO_ABERTURA_MS);
    return () => clearTimeout(espera);
  }, []);

  if (!pronto || carregando) {
    return (
      <main className="abertura">
        <span className="abertura__logo">
          <IconeMaleta />
        </span>
        <h1>
          Avanade Global <span className="destaque">Connect</span>
        </h1>
        <p className="subtitulo">Plataforma interna para colaboradores da Avanade</p>
      </main>
    );
  }
  if (!token) return <Navigate to="/login" replace />;
  return <Navigate to={perfil?.profile_complete ? '/descobrir' : '/cadastro/dados'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Inicio />} />
      <Route path="/login" element={<Login />} />

      <Route element={<RotaProtegida />}>
        <Route path="/cadastro" element={<Navigate to="/cadastro/dados" replace />} />
        <Route path="/cadastro/dados" element={<CadastroDados />} />
        <Route path="/cadastro/interesses" element={<CadastroInteresses />} />
        <Route path="/cadastro/preferencias" element={<CadastroPreferencias />} />
        {/* Endereços do layout anterior, mantidos para links antigos. */}
        <Route path="/bem-vindo" element={<Navigate to="/cadastro/dados" replace />} />
        <Route path="/perfil/*" element={<Navigate to="/cadastro/interesses" replace />} />

        <Route element={<RotaCompleta />}>
          <Route element={<Layout />}>
            <Route path="/descobrir" element={<Descobrir />} />
            <Route path="/matches" element={<Matches />} />
            <Route path="/chat" element={<Mensagens />} />
            <Route path="/chat/:id" element={<Mensagens />} />
            <Route path="/eu" element={<MeuPerfil />} />
            <Route path="/pessoa/:id" element={<PerfilPessoa />} />
            <Route path="/match/:id" element={<Match />} />
            <Route path="/conexoes" element={<Navigate to="/matches" replace />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
