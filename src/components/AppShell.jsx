import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Search, Bell, CircleHelp, Menu, X, ChevronDown, LogOut, ArrowRight, Coffee, Heart, UserRound, MessageSquare } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { userPhoto } from '../data';
import { Avatar, Button, Footer, Logo, Modal } from './ui';

const links = [
  { to: '/descobrir', text: 'Descobrir', icon: Search },
  { to: '/matches', text: 'Matches Bilaterais', icon: Heart },
  { to: '/mensagens', text: 'Mensagens & Chat', icon: MessageSquare },
  { to: '/perfil', text: 'Meu Perfil', icon: UserRound },
];

export default function AppShell() {
  const { profile, searchQuery, setSearchQuery, matches, scheduled, logOut } = useApp();
  const [menu, setMenu] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [help, setHelp] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const navigate = useNavigate();
  const search = event => { event.preventDefault(); if (searchQuery.trim()) navigate('/descobrir'); };

  return <div className="app-shell">
    <a href="#main-content" className="skip-link">Pular para o conteúdo</a>
    <header className="app-header"><div className="header-inner">
      <NavLink to="/descobrir" className="logo-link" aria-label="Avanade Connect, início"><Logo /></NavLink>
      <form className={`global-search ${mobileSearch ? 'is-open' : ''}`} onSubmit={search} role="search"><Search size={15} /><input id="global-search-input" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Buscar por skills, projetos, interesses..." aria-label="Buscar por skills, projetos ou interesses" />{searchQuery && <button type="button" onClick={() => setSearchQuery('')} aria-label="Limpar busca"><X size={14} /></button>}</form>
      <nav className={`main-nav ${menu ? 'is-open' : ''}`} aria-label="Navegação principal">{links.map(({ to, text, icon: Icon }) => <NavLink key={to} to={to} onClick={() => { setMenu(false); setSearchQuery(''); }} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Icon size={16} className="mobile-nav-icon" />{text}</NavLink>)}</nav>
      <div className="header-actions">
        <button className="icon-button header-search-icon" type="button" aria-label="Abrir busca" aria-expanded={mobileSearch} onClick={() => { setMobileSearch(!mobileSearch); if (!mobileSearch) requestAnimationFrame(() => document.getElementById('global-search-input')?.focus()); }}><Search size={18} /></button>
        <div className="popover-parent"><button className={`icon-button notification-button ${notifications ? 'is-active' : ''}`} type="button" aria-label="Notificações" aria-expanded={notifications} onClick={() => { setNotifications(!notifications); setUserMenu(false); }}><Bell size={18} /><span className="notification-dot" /></button>{notifications && <div className="header-popover notifications-popover"><h3>Suas conexões em movimento</h3><button onClick={() => { navigate('/matches'); setNotifications(false); }}><span className="popover-icon"><Heart size={17} /></span><span><strong>{matches.length} matches para conhecer</strong><small>Uma boa conversa pode começar agora.</small></span><ArrowRight size={15} /></button><button onClick={() => { navigate('/mensagens'); setNotifications(false); }}><span className="popover-icon mint"><Coffee size={17} /></span><span><strong>{Object.keys(scheduled).length} cafés agendados</strong><small>Confira os encontros de demonstração.</small></span><ArrowRight size={15} /></button><p>Ambiente de demonstração</p></div>}</div>
        <button className="icon-button help-button" type="button" aria-label="Ajuda" onClick={() => setHelp(true)}><CircleHelp size={18} /></button>
        <div className="popover-parent user-popover-parent"><button className="header-user" type="button" onClick={() => { setUserMenu(!userMenu); setNotifications(false); }} aria-label="Abrir menu da sua conta" aria-expanded={userMenu}><Avatar person={{ name: profile.name, photo: userPhoto }} size={34} /><span><strong>{profile.name}</strong><small>{profile.city.split(',')[0]}</small></span><ChevronDown size={12} /></button>{userMenu && <div className="header-popover user-popover"><button onClick={() => { navigate('/perfil'); setUserMenu(false); }}><UserRound size={16} />Meu perfil</button><button onClick={() => { setUserMenu(false); logOut(); }}><LogOut size={16} />Sair da conta</button></div>}</div>
        <button className="icon-button menu-toggle" type="button" aria-label={menu ? 'Fechar menu' : 'Abrir menu'} aria-expanded={menu} onClick={() => setMenu(!menu)}>{menu ? <X size={23} /> : <Menu size={23} />}</button>
      </div>
    </div></header>
    <main id="main-content" className="app-main"><Outlet /></main>
    <Footer />
    {help && <Modal title="Vamos criar novas conexões?" onClose={() => setHelp(false)}><div className="help-content"><p>Explore a rede de colegas e descubra pessoas que compartilham seus interesses.</p><ol><li><strong>Descobrir:</strong> use os filtros e conheça os perfis sugeridos.</li><li><strong>Matches:</strong> encontre suas conexões e agende um café de 15 minutos.</li><li><strong>Mensagens:</strong> comece uma conversa e aceite convites.</li><li><strong>Meu Perfil:</strong> ajuste interesses, alcance e disponibilidade.</li></ol><p className="demo-note">Protótipo interativo. SSO, IA, Teams e calendário são demonstrativos. Os dados ficam salvos somente neste navegador.</p><Button onClick={() => setHelp(false)}>Vamos lá <ArrowRight size={16} /></Button></div></Modal>}
  </div>;
}
