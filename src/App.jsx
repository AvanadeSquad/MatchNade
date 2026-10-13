import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import AppShell from './components/AppShell';
import { LoginPage, BasicsPage, InterestsPage, PreferencesPage } from './pages/Onboarding';
import { DiscoverPage, MatchesPage } from './pages/Discover';
import { MessagesPage, ProfilePage } from './pages/Community';

const pageNames = { '/entrar': 'Acesse sua conta', '/cadastro': 'Dados básicos', '/interesses': 'Seus interesses', '/preferencias': 'Preferências de match', '/descobrir': 'Descobrir colaboradores', '/matches': 'Matches bilaterais', '/mensagens': 'Mensagens & Chat', '/perfil': 'Meu perfil' };

export default function App() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = `${pageNames[pathname] || 'Conexões'} | Avanade Connect`;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);
  return <Routes>
    <Route path="/" element={<Navigate to="/entrar" replace />} />
    <Route path="/entrar" element={<LoginPage />} />
    <Route path="/cadastro" element={<BasicsPage />} />
    <Route path="/interesses" element={<InterestsPage />} />
    <Route path="/preferencias" element={<PreferencesPage />} />
    <Route element={<AppShell />}>
      <Route path="/descobrir" element={<DiscoverPage />} />
      <Route path="/matches" element={<MatchesPage />} />
      <Route path="/mensagens" element={<MessagesPage />} />
      <Route path="/perfil" element={<ProfilePage />} />
    </Route>
    <Route path="*" element={<Navigate to="/entrar" replace />} />
  </Routes>;
}
