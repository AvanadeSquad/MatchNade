import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BellRing, Building2, CalendarCheck, CalendarDays, Camera, Check, CheckCircle2, ChevronDown, Clock, Coffee, Gamepad2, Globe, Heart, HeartHandshake, LayoutGrid, Lightbulb, MapPin, MessageSquare, Search, ShieldCheck, SlidersHorizontal, Sparkles, Users, Utensils, X, Zap } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { people, userPhoto } from '../data';
import { Avatar, Badge, Button, Tags } from '../components/ui';
import '../styles/discover.css';

const areas = ['Cloud', 'Data & AI', 'UX Design', 'Inovação', 'DevOps', 'Security'];
const clean = (value = '') => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const personText = (person) => clean([person.name, person.role, person.department, person.city, person.hub, person.bio, ...(person.skills || []), ...(person.hobbies || [])].join(' '));
const matchesSearch = (person, query) => {
  const text = personText(person);
  const words = clean(query).match(/[a-z0-9]+/g) || [];
  if (words.length < 2) return !words.length || text.includes(words[0]);
  const tokens = new Set(text.match(/[a-z0-9]+/g) || []);
  return words.every(word => tokens.has(word));
};
const areaMatches = (person, area) => {
  const terms = { 'Cloud': ['cloud', 'azure', 'nuvem'], 'Data & AI': ['data', 'dados', 'inteligencia', 'generativa', 'ai'], 'UX Design': ['design', 'ux', 'figma'], 'Inovação': ['inovacao', 'inovation', 'innovation'], 'DevOps': ['devops', 'software', 'microservicos'], 'Security': ['security', 'seguranca', 'cyber'] };
  return (terms[area] || [area]).some((term) => term === 'ai' ? /\bai\b/.test(personText(person)) : personText(person).includes(clean(term)));
};

function ConnectionModal({ title, children, onClose, className = '' }) {
  const modalRef = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const dialog = modalRef.current;
    dialog?.querySelector('button, input, select, textarea')?.focus();
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const nodes = dialog?.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]');
        if (!nodes?.length) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKey);
      previous?.focus?.();
    };
  }, [onClose]);
  return <div className="cm-overlay" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className={`cm-dialog ${className}`} role="dialog" aria-modal="true" aria-label={title} ref={modalRef}>
      <div className="cm-header"><h2>{title}</h2><button className="cm-close" onClick={onClose} aria-label="Fechar janela"><X size={20} /></button></div>
      {children}
    </section>
  </div>;
}

function CoffeeModal({ person, existing, onClose, onConfirm, onChat }) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState('10:30');
  const [editing, setEditing] = useState(!existing);
  const confirm = (event) => {
    event.preventDefault();
    const [year, month, day] = date.split('-');
    onConfirm(person, `${day}/${month}/${year} às ${time} · 15 min · Microsoft Teams`);
    onClose();
  };
  return <ConnectionModal title={editing ? 'Vamos marcar um café?' : 'Seu Coffee Chat está agendado'} onClose={onClose}>
    <div className="cm-person"><Avatar person={person} size={52} online /><div><strong>{person.name}</strong><span>{person.role} · {person.city}</span></div><Coffee size={25} /></div>
    <p className="cm-description">Uma pausa de 15 minutos para compartilhar ideias e criar uma nova conexão.</p>
    {editing ? <form onSubmit={confirm} className="cm-coffee-form">
      <div className="cm-form-grid"><label>Data<input type="date" value={date} min={today} required onChange={(event) => setDate(event.target.value)} /></label><label>Horário<select aria-label="Horário" value={time} onChange={(event) => setTime(event.target.value)}>{['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'].map((slot) => <option key={slot}>{slot}</option>)}</select></label></div>
      <div className="cm-note"><ShieldCheck size={17} /><span>Seu encontro fica salvo neste navegador. Você pode conferir os detalhes e combinar a conversa em Mensagens & Chat.</span></div>
      <div className="cm-actions"><Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button><Button type="submit"><CalendarCheck size={16} /> Confirmar café</Button></div>
    </form> : <div className="cm-coffee-details">
      <div className="cm-booking"><CalendarDays size={23} /><div><strong>Coffee Chat Virtual</strong><span>{existing}</span></div><Badge tone="green">Confirmado</Badge></div>
      <p>Reserve esse momento para uma conversa leve sobre interesses, projetos e novas ideias.</p>
      <div className="cm-actions"><Button variant="secondary" onClick={() => setEditing(true)}>Reagendar café</Button><Button onClick={onChat}><MessageSquare size={16} /> Abrir conversa</Button></div>
    </div>}
  </ConnectionModal>;
}

function PersonProfileModal({ person, onClose, onChat, onSchedule }) {
  return <ConnectionModal title="Perfil do colaborador" onClose={onClose} className="cm-profile-dialog">
    <div className="cm-profile-top"><Avatar person={person} size={88} online /><div><h3>{person.name} <CheckCircle2 size={17} /></h3><p>{person.role}</p><span><MapPin size={14} /> {person.city} · Avanade Brasil</span><Badge tone="green">{person.match}% de afinidade</Badge></div></div>
    <p className="cm-profile-bio">{person.bio}</p>
    <div className="cm-profile-section"><h4><Lightbulb size={17} /> Interesses profissionais</h4><Tags items={person.skills || []} /></div>
    <div className="cm-profile-section"><h4><Heart size={17} /> Interesses pessoais & hobbies</h4><Tags items={person.hobbies || []} tone="orange" /></div>
    <div className="cm-actions"><Button variant="secondary" onClick={onSchedule}><Coffee size={16} /> Agendar Coffee Chat</Button><Button onClick={onChat}><MessageSquare size={16} /> Abrir chat</Button></div>
  </ConnectionModal>;
}

export function DiscoverPage() {
  const { searchQuery = '', setSearchQuery, matches = [], connect, scheduleCoffee, scheduled = {}, setActiveContact } = useApp();
  const navigate = useNavigate();
  const [selectedAreas, setSelectedAreas] = useState(['Cloud', 'Data & AI', 'Inovação']);
  const [geography, setGeography] = useState('Brasil');
  const [hub, setHub] = useState('all');
  const [objective, setObjective] = useState('Coffee Chat');
  const [index, setIndex] = useState(0);
  const [coffeePerson, setCoffeePerson] = useState(null);
  const [mobileFilters, setMobileFilters] = useState(false);
  const [localSearch, setLocalSearch] = useState('');
  const filtered = useMemo(() => people.filter((person) => {
    const query = clean(`${searchQuery} ${localSearch}`).trim();
    if (query && !matchesSearch(person, query)) return false;
    if (selectedAreas.length && !selectedAreas.some((area) => areaMatches(person, area))) return false;
    if (geography === 'Local (SP)' && !clean(person.city).includes('sao paulo')) return false;
    if (hub !== 'all' && !clean(`${person.city} ${person.hub}`).includes(clean(hub))) return false;
    if (objective === 'Mentoria' && !personText(person).includes('mentor')) return false;
    if (objective === 'Troca Técnica' && !(person.skills || []).length) return false;
    return true;
  }), [searchQuery, localSearch, selectedAreas, geography, hub, objective]);
  useEffect(() => setIndex(0), [searchQuery, localSearch, selectedAreas, geography, hub, objective]);
  const person = filtered[index % Math.max(filtered.length, 1)];
  const isConnected = person && matches.some((match) => match.id === person.id);
  const resetFilters = () => { setSelectedAreas([]); setGeography('Brasil'); setHub('all'); setObjective('Coffee Chat'); setLocalSearch(''); setSearchQuery(''); };
  const toggleArea = (area) => setSelectedAreas((current) => current.includes(area) ? current.filter((item) => item !== area) : [...current, area]);
  const next = () => setIndex((current) => (current + 1) % Math.max(filtered.length, 1));
  const features = person ? [
    { icon: Lightbulb, title: person.skills?.[0] || 'Inovação', subtitle: 'Ideias que conectam' },
    { icon: LayoutGrid, title: person.skills?.[1] || 'Design Systems', subtitle: 'Prática ativa' },
    { icon: Users, title: 'Mentoria', subtitle: 'Disposto a apoiar' },
    { icon: Coffee, title: 'Coffee Chats', subtitle: 'Novas perspectivas' },
  ] : [];
  const hobbyIcons = [Camera, HeartHandshake, Gamepad2, Utensils];
  return <div className="discover-page">
    <div className="dc-page-heading"><div><span className="dc-eyebrow"><span /> MATCHMAKING INTELIGENTE · AVANADE PEOPLE</span><h1>Descobrir Colaboradores</h1><p>Conecte-se com colegas da Avanade com base em afinidades profissionais e pessoais em comum.</p></div><div className="dc-suggestion-pill"><span /> {filtered.length} sugestões hoje</div></div>
    <label className="dc-mobile-search discover-search"><Search size={16} /><input placeholder="Buscar por nome, área ou interesse..." aria-label="Buscar colaboradores no celular" value={localSearch} onChange={(event) => setLocalSearch(event.target.value)} /></label>
    <button className="dc-mobile-filters" onClick={() => setMobileFilters((current) => !current)} aria-expanded={mobileFilters}><SlidersHorizontal size={16} /> Filtros essenciais {selectedAreas.length > 0 && <span>{selectedAreas.length}</span>}<ChevronDown size={16} /></button>
    <div className="dc-layout">
      <aside className={`dc-sidebar ${mobileFilters ? 'is-expanded' : ''}`}>
        <section className="dc-filter-card"><div className="dc-filter-heading"><h2><SlidersHorizontal size={17} /> Filtros Essenciais</h2><button onClick={resetFilters}><span>↻</span> Limpar</button></div>
          <label className="dc-side-search"><Search size={15} /><input placeholder="Buscar por área ou interesse..." aria-label="Buscar colaboradores" value={localSearch} onChange={(event) => setLocalSearch(event.target.value)} /></label>
          <div className="dc-filter-group"><h3>ÁREAS PROFISSIONAIS</h3><div className="dc-filter-tags">{areas.map((area) => <button key={area} onClick={() => toggleArea(area)} className={selectedAreas.includes(area) ? 'selected' : ''} aria-pressed={selectedAreas.includes(area)}>{area}</button>)}</div></div>
          <div className="dc-filter-group"><h3>ALCANCE GEOGRÁFICO</h3><div className="dc-segmented">{['Local (SP)', 'Brasil', 'LATAM'].map((value) => <button key={value} onClick={() => setGeography(value)} className={geography === value ? 'selected' : ''} aria-pressed={geography === value}>{value}</button>)}</div></div>
          <div className="dc-filter-group"><label htmlFor="discovery-hub">UNIDADE AVANADE</label><div className="dc-select-wrap"><select id="discovery-hub" value={hub} onChange={(event) => setHub(event.target.value)}><option value="all">Todas as unidades Avanade</option><option value="São Paulo">Avanade São Paulo</option><option value="Recife">Avanade Recife</option><option value="Rio de Janeiro">Avanade Rio de Janeiro</option><option value="Belo Horizonte">Avanade Belo Horizonte</option></select><ChevronDown size={14} /></div></div>
          <div className="dc-filter-group"><h3>OBJETIVO PRINCIPAL</h3><div className="dc-filter-tags dc-objective-tags">{[['Coffee Chat', Coffee], ['Mentoria', Users], ['Troca Técnica', SlidersHorizontal]].map(([value, Icon]) => <button key={value} className={objective === value ? 'selected' : ''} onClick={() => setObjective(objective === value ? '' : value)} aria-pressed={objective === value}><Icon size={13} />{value}</button>)}</div></div>
        </section>
        <div className="dc-security-card"><HeartHandshake size={18} /><div><strong>Conexões Mútuas & Seguras</strong><p>Mensagens e reuniões são liberadas após o interesse mútuo de ambos os colaboradores. Respeite o tempo e o foco de todos.</p></div></div>
      </aside>
      <div className="dc-results" aria-live="polite">
        {person ? <><article className="dc-person-card" key={person.id}>
          <div className="dc-verified-bar"><span><ShieldCheck size={14} /> Perfil Verificado Avanade · {person.department || 'Digital & Innovation Studio'}</span><strong><Zap size={13} fill="currentColor" /> {person.match}% DE SINERGIA</strong></div>
          <div className="dc-person-body"><div className="dc-person-intro"><div className="dc-person-photo"><Avatar person={person} size={120} /><span className="dc-availability"><span /> Disponível</span></div><div className="dc-person-summary"><div className="dc-person-name"><h2>{person.name}</h2><span className="dc-role-tag">{person.role?.toUpperCase() || 'AVANADE PROFESSIONAL'}</span></div><p className="dc-person-role">{person.department || person.role}</p><div className="dc-person-meta"><span><MapPin size={13} />{person.city} · Remoto / Híbrido</span><span><Building2 size={13} />3 anos de Avanade</span><span><Globe size={13} />{Array.isArray(person.languages) ? person.languages.join(', ') : person.languages || 'PT, EN, ES'}</span></div><blockquote>“{person.bio}”</blockquote></div></div>
            <div className="dc-affinities"><div className="dc-section-heading"><h3><HeartHandshake size={16} /> Afinidades em comum com você</h3><span>Calculado por afinidade de perfil</span></div><div className="dc-feature-grid">{features.map(({ icon: Icon, title, subtitle }) => <div className="dc-feature" key={title}><span className="dc-feature-icon"><Icon size={18} /></span><div><strong>{title}</strong><span>{subtitle}</span></div></div>)}</div></div>
            <div className="dc-hobbies"><h3><Users size={16} /> Interesses Pessoais & Hobbies</h3><div className="dc-hobby-tags">{(person.hobbies || []).map((hobby, hobbyIndex) => { const Icon = hobbyIcons[hobbyIndex % hobbyIcons.length]; return <span key={hobby}><Icon size={13} />{hobby}</span>; })}</div></div>
            <div className="dc-person-actions"><Button variant="secondary" onClick={next} className="dc-skip"><X size={15} /> Pular sugestão</Button><div><Button variant="ghost" onClick={() => setCoffeePerson(person)} className="dc-coffee"><Coffee size={16} />{scheduled[person.id] ? 'Ver Coffee Chat' : 'Agendar Coffee Chat'}</Button><Button onClick={() => isConnected ? navigate('/matches') : connect(person)} className="dc-connect">{isConnected ? <Check size={17} /> : <Heart size={17} fill="currentColor" />}{isConnected ? 'Ver conexão' : `Conectar com ${person.name.split(' ')[0]}`}</Button></div></div>
          </div>
        </article><div className="dc-pagination"><button onClick={() => setIndex((current) => (current - 1 + filtered.length) % filtered.length)} disabled={filtered.length < 2}><ArrowLeft size={14} /> Anterior</button><span><strong>{index % filtered.length + 1}</strong> de {filtered.length} sugestões ativas</span><button onClick={next} disabled={filtered.length < 2}>Próximo <ArrowRight size={14} /></button></div></> : <div className="dc-empty"><Search size={36} /><h2>Nenhum colaborador encontrado</h2><p>Experimente outros interesses ou amplie o alcance das suas conexões.</p><Button variant="secondary" onClick={resetFilters}>Limpar filtros</Button>{searchQuery && <span>A busca do cabeçalho também está sendo aplicada: “{searchQuery}”.</span>}</div>}
      </div>
    </div>
    {coffeePerson && <CoffeeModal person={coffeePerson} existing={scheduled[coffeePerson.id]} onClose={() => setCoffeePerson(null)} onConfirm={scheduleCoffee} onChat={() => { setActiveContact(coffeePerson.id); navigate('/mensagens', { state: { openConversation: true } }); }} />}
  </div>;
}

export function MatchesPage() {
  const { profile, matches = [], scheduled = {}, searchQuery = '', setSearchQuery, setActiveContact, scheduleCoffee, notify } = useApp();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [heroVisible, setHeroVisible] = useState(true);
  const [profilePerson, setProfilePerson] = useState(null);
  const [coffeePerson, setCoffeePerson] = useState(null);
  const [reminders, setReminders] = useState([]);
  const featured = matches.find((person) => person.id === 'marina') || matches[0];
  const coffeeCount = matches.filter((person) => scheduled[person.id]).length;
  const filtered = matches.filter((person) => {
    const query = clean(`${searchQuery} ${search}`).trim();
    if (query && !matchesSearch(person, query)) return false;
    if (filter === 'coffee' && !scheduled[person.id]) return false;
    if (filter === 'high' && Number(person.match) < 90) return false;
    return true;
  });
  const openChat = (person) => { setActiveContact(person.id); navigate('/mensagens', { state: { openConversation: true } }); };
  const remind = (person) => {
    setReminders((current) => [...current, person.id]);
    notify(`Lembrete de Coffee Chat enviado para ${person.name.split(' ')[0]} nesta demonstração.`);
  };
  const ana = { name: profile?.name || 'Ana Silva', photo: profile?.photo || userPhoto };
  return <div className="matches-page">
    <div className="mt-heading"><div><div className="mt-eyebrow">SINERGIA & CONEXÕES ATIVAS <Badge tone="orange">● {Math.min(matches.length, 3)} novos matches</Badge></div><h1>Matches Bilaterais</h1><p>Colaboradores com interesse mútuo confirmados para troca de experiências, mentoria e café virtual.</p></div><div className="mt-counters"><div><HeartHandshake size={21} /><span><strong>{matches.length}</strong>Matches Ativos</span></div><div><Coffee size={21} /><span><strong>{coffeeCount}</strong>Cafés Marcados</span></div></div></div>
    {heroVisible && featured && <section className="mt-hero"><div className="mt-mutual-avatars"><Avatar person={ana} size={88} /><span className="mt-heart"><Heart size={22} fill="currentColor" /></span><Avatar person={featured} size={88} /></div><div className="mt-hero-copy"><span className="mt-hero-eyebrow"><Sparkles size={14} /> NOVA CONEXÃO RECÍPROCA</span><h2>É um Match Bilateral!</h2><p>Você e <strong>{featured.name}</strong> demonstraram interesse mútuo! Ambos têm afinidade confirmada em {featured.skills?.[0] || 'inovação'} e {featured.hobbies?.[0] || 'novas ideias'}.</p><div className="mt-hero-tags"><Tags items={(featured.skills || []).slice(0, 2)} /><Tags items={(featured.hobbies || []).slice(0, 1)} tone="orange" /></div></div><div className="mt-hero-actions"><Button onClick={() => openChat(featured)}><MessageSquare size={16} /> Iniciar no Teams / Chat</Button><Button variant="ghost" onClick={() => setCoffeePerson(featured)}><CalendarDays size={16} /> Agendar Coffee Chat</Button><button className="mt-dismiss" onClick={() => setHeroVisible(false)}>Dispensar notificação</button></div></section>}
    <section className="mt-list"><div className="mt-list-toolbar"><h2>Todos os seus Matches Ativos <span>{matches.length}</span></h2><div><label className="mt-search"><Search size={16} /><input placeholder="Buscar matches por nome, área ou interesse..." aria-label="Buscar matches" value={search} onChange={(event) => setSearch(event.target.value)} /></label><button className={`mt-filter-button ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters((current) => !current)} aria-expanded={showFilters}><SlidersHorizontal size={15} /> Filtros</button></div></div>
      {showFilters && <div className="mt-filter-options">{[['all', 'Todos os matches'], ['coffee', 'Com café agendado'], ['high', '90% ou mais de afinidade']].map(([value, label]) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)} aria-pressed={filter === value}>{label}</button>)}</div>}
      <div className="mt-rows" aria-live="polite">{filtered.map((person, index) => {
        const booked = scheduled[person.id];
        const pending = !booked && (person.id === 'bruno' || person.status === 'pending');
        const reminderSent = reminders.includes(person.id);
        return <article className="mt-row" key={person.id}><Avatar person={person} size={58} online={!pending} /><div className="mt-row-person"><div className="mt-row-name"><h3>{person.name}</h3><Badge tone={Number(person.match) >= 88 ? 'orange' : 'purple'}><Zap size={11} /> {person.match}% compatível</Badge>{booked ? <Badge tone="green"><CalendarCheck size={11} /> Café agendado</Badge> : index === 0 && <span className="mt-recent">MATCH RECENTE</span>}</div><p>{person.role} · {person.city}</p><div className={`mt-row-detail ${booked ? 'booked' : pending ? 'pending' : ''}`}>{booked ? <><Clock size={12} /><span>Café agendado: {booked}</span></> : pending ? <><Clock size={12} /><span>{reminderSent ? 'Lembrete enviado. Aguardando confirmação.' : 'Aguardando resposta da sugestão de horário'}</span></> : <><HeartHandshake size={12} /><span>Afinidade em {(person.skills || []).slice(0, 1).join('')} e {(person.hobbies || []).slice(0, 1).join('')}</span></>}</div></div><div className="mt-row-actions"><Button variant="secondary" onClick={() => setProfilePerson(person)}>Ver Perfil</Button>{booked ? <Button variant="green" onClick={() => setCoffeePerson(person)}><CalendarDays size={14} />Ver Detalhes do Encontro</Button> : pending ? <Button variant="ghost" onClick={() => remind(person)} disabled={reminderSent}><BellRing size={14} />{reminderSent ? 'Lembrete enviado' : 'Enviar Lembrete'}</Button> : <Button onClick={() => openChat(person)}><MessageSquare size={14} />Abrir Chat</Button>}</div></article>;
      })}</div>
      {!filtered.length && <div className="mt-empty"><HeartHandshake size={36} /><h3>{matches.length ? 'Nenhum match encontrado' : 'Sua próxima conexão está por aqui'}</h3><p>{matches.length ? 'Ajuste a busca ou os filtros para encontrar uma conexão.' : 'Descubra colegas com interesses em comum e comece uma nova conversa.'}</p><Button onClick={() => { if (matches.length) { setSearch(''); setSearchQuery(''); setFilter('all'); } else navigate('/descobrir'); }}>{matches.length ? 'Limpar filtros' : 'Descobrir colaboradores'}</Button>{matches.length > 0 && searchQuery && <small>A busca do cabeçalho também está ativa: “{searchQuery}”.</small>}</div>}
    </section>
    {profilePerson && <PersonProfileModal person={profilePerson} onClose={() => setProfilePerson(null)} onChat={() => openChat(profilePerson)} onSchedule={() => { setCoffeePerson(profilePerson); setProfilePerson(null); }} />}
    {coffeePerson && <CoffeeModal person={coffeePerson} existing={scheduled[coffeePerson.id]} onClose={() => setCoffeePerson(null)} onConfirm={scheduleCoffee} onChat={() => openChat(coffeePerson)} />}
  </div>;
}
