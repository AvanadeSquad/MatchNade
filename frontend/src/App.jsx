import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { Carregando, Erro } from './components/Basicos.jsx';
import { useAuth } from './context/AuthContext.jsx';
import Analisando from './pages/Analisando.jsx';
import Bio from './pages/Bio.jsx';
import Cadastro from './pages/Cadastro.jsx';
import Chats from './pages/Chats.jsx';
import Conexoes from './pages/Conexoes.jsx';
import Deck from './pages/Deck.jsx';
import Entrada from './pages/Entrada.jsx';
import Eu from './pages/Eu.jsx';
import Interesses from './pages/Interesses.jsx';
import Login from './pages/Login.jsx';
import Match from './pages/Match.jsx';
import Objetivos from './pages/Objetivos.jsx';
import PerfilPessoa from './pages/PerfilPessoa.jsx';
import Revisao from './pages/Revisao.jsx';

// Exige sessão. Enquanto o perfil carrega mostra um indicador; falha ao carregar permite tentar de novo;
// sem token volta ao login.
function RotaProtegida() {
  const { token, perfil, carregando, erroPerfil, tentarDeNovo, sair } = useAuth();
  if (token && erroPerfil && !perfil) {
    return (
      <main className="tela">
        <Erro erro={erroPerfil} aoTentarDeNovo={tentarDeNovo} />
        <button type="button" className="botao botao--texto" onClick={sair}>
          Sair da conta
        </button>
      </main>
    );
  }
  if (carregando || (token && !perfil))
    return (
      <main className="tela">
        <Carregando />
      </main>
    );
  return token ? <Outlet /> : <Navigate to="/login" replace />;
}

// Telas do uso diário só abrem com o cadastro concluído (unidade, 3 interesses e um objetivo).
function RotaCompleta() {
  const { perfil } = useAuth();
  return perfil.profile_complete ? <Outlet /> : <Navigate to="/bem-vindo" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Entrada />} />
      <Route path="/login" element={<Login />} />

      <Route element={<RotaProtegida />}>
        <Route path="/bem-vindo" element={<Cadastro />} />
        <Route path="/perfil/bio" element={<Bio />} />
        <Route path="/perfil/analisando" element={<Analisando />} />
        <Route path="/perfil/revisao" element={<Revisao />} />
        <Route path="/perfil/interesses" element={<Interesses />} />
        <Route path="/perfil/objetivos" element={<Objetivos />} />

        <Route element={<RotaCompleta />}>
          <Route path="/descobrir" element={<Deck />} />
          <Route path="/pessoa/:id" element={<PerfilPessoa />} />
          <Route path="/match/:id" element={<Match />} />
          <Route path="/conexoes" element={<Conexoes />} />
          <Route path="/chat" element={<Chats />} />
          <Route path="/chat/:id" element={<Chats />} />
          <Route path="/eu" element={<Eu />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
