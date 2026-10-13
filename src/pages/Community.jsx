import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, Building2, CalendarDays, Check, CheckCheck, Clock3, Coffee, Gamepad2, Globe2, HeartHandshake, Info, LogOut, MapPin, MessageSquare, MoreVertical, Paperclip, Pencil, Plus, Search, Send, Shield, ShieldCheck, SlidersHorizontal, Smile, Sparkles, UserRound, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { people, userPhoto } from '../data';
import { Avatar, Badge, Button, Modal, Tags } from '../components/ui';
import '../styles/community.css';

const sampleTimes = ['10:30', '14:00', '15:30', '16:00'];
const weekDay = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

function CoffeeModal({ person, onClose, onSchedule }) {
  const [day, setDay] = useState(weekDay());
  const [time, setTime] = useState('10:30');
  return <Modal title="Vamos marcar um café?" onClose={onClose}>
    <form className="community-coffee-modal" onSubmit={event => {
      event.preventDefault();
      onSchedule(`${new Date(`${day}T12:00:00`).toLocaleDateString('pt-BR')} às ${time}`);
      onClose();
    }}>
      <div className="community-coffee-person"><Avatar person={person} size={50} online /><div><strong>{person.name}</strong><span>{person.role}</span></div><Coffee size={23} /></div>
      <p>Reserve 15 minutos para trocar ideias, conhecer novos projetos e criar uma conexão.</p>
      <label>Qual dia funciona para você?<input type="date" min={new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())} value={day} onChange={event => setDay(event.target.value)} required /></label>
      <label>Escolha um horário<select value={time} onChange={event => setTime(event.target.value)}>{sampleTimes.map(slot => <option key={slot}>{slot}</option>)}</select></label>
      <div className="community-info-box"><Info size={17} /><span>O convite ficará salvo nesta demonstração. A integração com a agenda corporativa pode ser conectada depois.</span></div>
      <Button type="submit" disabled={!day}><CalendarDays size={16} /> Confirmar café virtual</Button>
    </form>
  </Modal>;
}

export function MessagesPage() {
  const { matches, scheduled, scheduleCoffee, activeContact, setActiveContact, messages, sendMessage, acceptInvite, notify } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const contacts = matches?.length ? matches : people;
  const contact = contacts.find(person => person.id === activeContact) || contacts[0] || people[0];
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [draft, setDraft] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [unread, setUnread] = useState(['marina', 'ana']);
  const [conversationNotifications, setConversationNotifications] = useState({});
  const [coffeeOpen, setCoffeeOpen] = useState(false);
  const [contactProfileOpen, setContactProfileOpen] = useState(false);
  const [mobileConversation, setMobileConversation] = useState(Boolean(location.state?.openConversation));
  const listEnd = useRef(null);
  const fileInput = useRef(null);
  const conversation = messages?.[contact.id] || [];
  const unreadCount = contacts.filter(person => unread.includes(person.id)).length;
  const filteredContacts = contacts.filter(person => `${person.name} ${person.role}`.toLowerCase().includes(search.toLowerCase()) && (filter !== 'scheduled' || scheduled?.[person.id]) && (filter !== 'unread' || unread.includes(person.id)));

  useEffect(() => { listEnd.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [conversation.length, contact.id]);
  const handleSend = event => {
    event.preventDefault();
    const text = `${draft.trim()}${attachment ? `${draft.trim() ? '\n' : ''}📎 ${attachment.name}` : ''}`;
    if (!text) return;
    sendMessage(contact.id, text);
    setDraft(''); setAttachment(null); setEmojiOpen(false);
  };
  const changeContact = person => { setActiveContact(person.id); setMobileConversation(true); setMenuOpen(false); setDraft(''); setAttachment(null); setUnread(current => current.filter(id => id !== person.id)); };
  const toggleConversationNotifications = () => {
    const enabled = !conversationNotifications[contact.id];
    setConversationNotifications(current => ({ ...current, [contact.id]: enabled }));
    notify(`Notificações desta conversa ${enabled ? 'ativadas' : 'desativadas'} na demonstração.`);
    setMenuOpen(false);
  };
  const schedule = slot => { scheduleCoffee(contact, slot); };

  return <div className="community-page community-messages-page">
    <div className="community-page-heading">
      <div><div className="community-eyebrow"><MessageSquare size={13} /> AVANADE HUB DE CONEXÕES</div><h1>Mensagens & Chat Corporativo</h1><p>Converse com seus matches e alinhe rodadas de Coffee Chat rápidas e informais para fortalecer a rede global.</p></div>
      <div className="community-availability"><span /> Disponibilidade: <strong>3 horários livres esta semana</strong></div>
    </div>
    <div className={`community-chat-layout ${mobileConversation ? 'community-show-conversation' : ''}`}>
      <aside className="community-contact-sidebar">
        <div className="community-contact-tools"><div className="community-search"><Search size={15} /><input aria-label="Buscar conversas" placeholder="Buscar conversas ou colegas..." value={search} onChange={event => setSearch(event.target.value)} /></div><div className="community-contact-filters"><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Todas</button><button className={filter === 'unread' ? 'active' : ''} onClick={() => setFilter('unread')}>Não lidas <span>{unreadCount}</span></button><button className={filter === 'scheduled' ? 'active' : ''} onClick={() => setFilter('scheduled')}>Com café agendado</button></div></div>
        <div className="community-contact-list">{filteredContacts.length ? filteredContacts.map((person, index) => <button className={`community-contact ${person.id === contact.id ? 'selected' : ''}`} key={person.id} onClick={() => changeContact(person)}>
          <Avatar person={person} size={46} online={index !== 2} /><div className="community-contact-copy"><div className="community-contact-name"><strong>{person.name}</strong><span>{index === 0 ? '14:08' : index === 1 ? 'Ontem' : 'Ter'}</span></div><span className="community-contact-role">{person.role}</span><p className={scheduled?.[person.id] ? 'scheduled' : ''}>{scheduled?.[person.id] ? `☕ Café agendado: ${scheduled[person.id]}` : messages?.[person.id]?.at(-1)?.text || (index === 0 ? 'Vamos marcar um Coffee Chat rápido de 15 min?' : index === 2 ? 'Aguardando confirmação de horário' : 'Adoraria saber mais sobre o projeto de...')}</p></div>{unread.includes(person.id) && <span className="community-unread-dot" />}
        </button>) : <div className="community-empty"><Search size={26} /><p>Nenhuma conversa encontrada.</p></div>}</div>
        <div className="community-sidebar-bottom"><Building2 size={14} /><span>Microsoft Teams <small>· demonstração</small></span><button aria-label="Atualizar conversas" onClick={() => notify('Suas conversas estão atualizadas.')}><Sparkles size={14} /></button></div>
      </aside>
      <section className="community-conversation" aria-label={`Conversa com ${contact.name}`}>
        <div className="community-conversation-heading"><button className="community-mobile-back" aria-label="Voltar para conversas" onClick={() => setMobileConversation(false)}><ArrowLeft size={20} /></button><Avatar person={contact} size={42} online /><div className="community-conversation-person"><div><strong>{contact.name}</strong><Badge tone="green">Match recente</Badge></div><span>{contact.role} · {contact.city}</span></div><div className="community-online-status"><span /> Disponível para conversar</div><button className="community-propose-coffee" onClick={() => setCoffeeOpen(true)}><Coffee size={16} /> Propor Coffee Chat <span>(15 min)</span></button><div className="community-more-wrap"><button className="community-icon-button" aria-label="Mais opções da conversa" onClick={() => setMenuOpen(!menuOpen)}><MoreVertical size={19} /></button>{menuOpen && <div className="community-dropdown"><button onClick={() => { setContactProfileOpen(true); setMenuOpen(false); }}><UserRound size={15} /> Ver perfil</button><button onClick={() => { setCoffeeOpen(true); setMenuOpen(false); }}><Coffee size={15} /> Agendar café</button><button onClick={toggleConversationNotifications}><Bell size={15} /> {conversationNotifications[contact.id] ? 'Desativar' : 'Ativar'} notificações</button></div>}</div></div>
        <div className="community-affinity"><span className="community-affinity-icon"><Sparkles size={19} /></span><div><strong>Vocês têm alta sinergia em comum: <em>Inovação, Azure Cloud e Jogos de Tabuleiro</em></strong><p>Que tal puxar assunto sobre as novidades do Azure OpenAI ou os jogos favoritos?</p></div><span>{contact.match || 92}% afinidade</span></div>
        <div className="community-message-stream"><div className="community-message-day">Hoje, {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}</div>{conversation.length ? conversation.map(message => <div className={`community-message-row ${message.own ? 'own' : ''}`} key={message.id}>{!message.own && <Avatar person={contact} size={23} />}<div className="community-message-content"><div className="community-message-bubble">{message.text}</div><span className="community-message-time">{message.time || '14:08'} · {message.own ? 'Você' : contact.name.split(' ')[0]} {message.own && <CheckCheck size={12} />}</span></div></div>) : <div className="community-start-conversation"><MessageSquare size={31} /><strong>Sua próxima conexão começa com um oi.</strong><span>Envie uma mensagem para {contact.name.split(' ')[0]}.</span></div>}
          <div className={`community-invitation ${scheduled?.[contact.id] ? 'accepted' : ''}`}><div className="community-invitation-top"><span className="community-coffee-icon"><Coffee size={24} /></span><div><small>CONVITE AVANADE MEET</small><h3>Coffee Chat Virtual (15 min)</h3><p><CalendarDays size={13} /> {scheduled?.[contact.id] ? `Confirmado: ${scheduled[contact.id]}` : 'Sugestão: terça-feira às 10:30'}</p></div><span className="community-meet-label"><MessageSquare size={11} /> Virtual</span></div><p className="community-invitation-note">15 minutos · Sem pauta formal · Descontração & Networking</p>{scheduled?.[contact.id] ? <div className="community-invitation-confirmed"><CheckCircle /><span>Café confirmado! Aproveite a conversa.</span></div> : <div className="community-invitation-actions"><button onClick={() => setCoffeeOpen(true)}><Clock3 size={13} /> Sugerir outro</button><button onClick={() => acceptInvite(contact.id)}><Check size={13} /> Aceitar convite</button></div>}</div>
          <div ref={listEnd} />
        </div>
        <form className="community-compose" onSubmit={handleSend}>{attachment && <div className="community-attachment"><Paperclip size={14} /><span>{attachment.name}</span><button type="button" aria-label="Remover anexo" onClick={() => setAttachment(null)}><X size={15} /></button><small>Arquivo local</small></div>}<input ref={fileInput} type="file" className="community-hidden" onChange={event => { const file = event.target.files?.[0]; if (file) { setAttachment(file); notify('Arquivo selecionado para esta conversa de demonstração.'); } event.target.value = ''; }} /><button className="community-icon-button" type="button" aria-label="Anexar arquivo" onClick={() => fileInput.current?.click()}><Paperclip size={19} /></button><div className="community-emoji-wrap"><button className="community-icon-button" type="button" aria-label="Adicionar emoji" onClick={() => setEmojiOpen(!emojiOpen)}><Smile size={19} /></button>{emojiOpen && <div className="community-emoji-menu">{['😊', '🙌', '☕', '💡', '👋', '❤️', '🚀', '👍'].map(emoji => <button key={emoji} type="button" onClick={() => { setDraft(draft + emoji); setEmojiOpen(false); }}>{emoji}</button>)}</div>}</div><button className="community-icon-button community-compose-coffee" type="button" aria-label="Propor café" onClick={() => setCoffeeOpen(true)}><Coffee size={19} /></button><input aria-label="Escreva uma mensagem" value={draft} onChange={event => setDraft(event.target.value)} placeholder="Escreva uma mensagem ou proponha um café..." /><button className="community-send" disabled={!draft.trim() && !attachment} type="submit">Enviar <Send size={15} /></button></form>
      </section>
    </div>
    {coffeeOpen && <CoffeeModal person={contact} onClose={() => setCoffeeOpen(false)} onSchedule={schedule} />}
    {contactProfileOpen && <Modal title="Perfil do colaborador" onClose={() => setContactProfileOpen(false)}><div className="community-contact-preview"><div className="community-coffee-person"><Avatar person={contact} size={64} online /><div><strong>{contact.name}</strong><span>{contact.role}</span><span><MapPin size={12} /> {contact.city} · Avanade Brasil</span></div></div><p>{contact.bio}</p><h3>Interesses profissionais</h3><Tags items={contact.skills || []} /><h3>Interesses pessoais</h3><Tags items={contact.hobbies || []} tone="orange" /><div className="community-contact-preview-actions"><Button variant="secondary" onClick={() => navigate('/descobrir')}>Explorar conexões</Button><Button onClick={() => { setContactProfileOpen(false); setCoffeeOpen(true); }}><Coffee size={16} /> Propor café</Button></div></div></Modal>}
  </div>;
}

function CheckCircle() { return <span className="community-check-circle"><Check size={13} /></span>; }

function Toggle({ checked, onChange, label }) {
  return <button className={`community-toggle ${checked ? 'on' : ''}`} role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}><span /></button>;
}

function EditableTags({ items, onChange, placeholder, tone = 'purple' }) {
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState('');
  const add = event => { event.preventDefault(); const cleaned = value.trim(); if (cleaned && !items.includes(cleaned)) onChange([...items, cleaned]); setValue(''); setAdding(false); };
  return <div><div className={`community-editable-tags ${tone}`}>{items.map(item => <span key={item}>{item}<button aria-label={`Remover ${item}`} onClick={() => onChange(items.filter(tag => tag !== item))}><X size={11} /></button></span>)}<button className="community-tag-add" onClick={() => setAdding(!adding)}><Plus size={12} /> Adicionar{placeholder === 'Skill' ? ' skill' : ''}</button></div>{adding && <form className="community-tag-form" onSubmit={add}><input autoFocus value={value} onChange={event => setValue(event.target.value)} placeholder={`Nova ${placeholder.toLowerCase()}`} aria-label={`Adicionar ${placeholder}`} maxLength={40} /><button type="submit" aria-label="Confirmar"><Check size={16} /></button><button type="button" aria-label="Cancelar" onClick={() => setAdding(false)}><X size={16} /></button></form>}</div>;
}

export function ProfilePage() {
  const { profile, updateProfile, notify, matches, logOut } = useApp();
  const [editOpen, setEditOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [hubOpen, setHubOpen] = useState(false);
  const [edit, setEdit] = useState(profile);
  const [summaryDraft, setSummaryDraft] = useState(profile.summary || 'Colaboradora da Avanade com foco em experiência do usuário, design de interfaces e colaboração em squads multidisciplinares de produto. Entusiasta de Inteligência Artificial aplicada ao design.');
  const [newHub, setNewHub] = useState('Avanade Belo Horizonte');
  const person = { name: profile.name || 'Ana Silva', photo: userPhoto };
  const skills = profile.skills || ['Figma', 'React', 'UX Research', 'Design System', 'Storybook', 'IA Generativa'];
  const hobbies = profile.hobbies || ['Jogos de Tabuleiro', 'Fotografia Urbana', 'Café Especial', 'Trekking'];
  const hubs = profile.hubs || ['Avanade SP (Santo Antônio)', 'Avanade Recife (Porto Digital)', 'Avanade Rio de Janeiro'];
  const save = patch => { updateProfile(patch); };
  const saveEdit = event => { event.preventDefault(); save({ name: edit.name.trim(), phone: edit.phone, city: edit.city, hub: edit.hub }); setEditOpen(false); notify('Perfil atualizado com sucesso.'); };
  return <div className="community-page community-profile-page">
    <div className="community-page-heading"><div><div className="community-eyebrow"><span className="community-orange-dot" /> GOVERNANÇA DE CONEXÃO & IDENTIDADE</div><h1>Meu Perfil Corporativo</h1><p>Gerencie suas informações, afinidades mapeadas pela IA e parâmetros de disponibilidade na rede Avanade.</p></div><div className="community-visibility"><span className={profile.visible !== false ? 'available' : ''} /> {profile.visible !== false ? 'Visível para novos matches' : 'Perfil pausado'}<button onClick={() => { save({ visible: profile.visible === false }); notify(profile.visible === false ? 'Seu perfil está visível para novas conexões.' : 'Visibilidade do perfil pausada.'); }}>Alterar</button></div></div>
    <div className="community-profile-layout">
      <aside className="community-profile-left">
        <section className="community-panel community-identity"><div className="community-identity-top"><Avatar person={person} size={76} online /><button className="community-edit-button" onClick={() => { setEdit(profile); setEditOpen(true); }}><Pencil size={13} /> Editar perfil</button></div><h2>{profile.name || 'Ana Silva'} <Badge><ShieldCheck size={13} /></Badge></h2><p>Consultora de UX & Produto · Avanade Brasil</p><span className="community-profile-location"><MapPin size={13} /> {profile.city || 'São Paulo'} ({profile.hub?.includes('Santo') ? 'Chácara Santo Antônio' : profile.hub || 'Chácara Santo Antônio'})</span><div className="community-profile-awards"><span><Sparkles size={11} /> DESIGN CHAPTER LEAD</span><span><ShieldCheck size={11} /> MENTORA AVANADE 2024</span></div></section>
        <div className="community-profile-stats"><div><strong>{matches?.length || 12}</strong><span>MATCHES ATIVOS</span></div><div><strong>34</strong><span>CONEXÕES TOTAIS</span></div><div><strong>145</strong><span>VISUALIZAÇÕES</span></div></div>
        <section className="community-panel"><div className="community-panel-title"><h2><UserRound size={17} /> Resumo profissional</h2><button className="community-text-button" onClick={() => { setSummaryDraft(profile.summary || summaryDraft); setSummaryOpen(true); }}><Pencil size={12} /> Editar</button></div><p className="community-summary">{profile.summary || summaryDraft}</p></section>
        <section className="community-panel"><div className="community-panel-title"><h2><Sparkles size={17} /> Interesses profissionais</h2><Badge tone="green">MAPEADOS POR IA</Badge></div><p className="community-panel-description">Habilidades e tecnologias destacadas para matching técnico e colaboração cruzada:</p><EditableTags items={skills} onChange={items => save({ skills: items })} placeholder="Skill" /></section>
        <section className="community-panel"><div className="community-panel-title"><h2><Gamepad2 size={17} /> Interesses pessoais & hobbies</h2><span className="community-mini-caption">GELO QUEBRADO</span></div><p className="community-panel-description">Afinidades compartilhadas para puxar assunto no primeiro café virtual:</p><EditableTags items={hobbies} onChange={items => save({ hobbies: items })} placeholder="afinidade" tone="orange" /></section>
      </aside>
      <div className="community-profile-right">
        <section className="community-panel community-algorithm"><div className="community-panel-title"><h2><SlidersHorizontal size={19} /> Parâmetros do algoritmo de match</h2><button className="community-icon-button" aria-label="Sobre o algoritmo" onClick={() => notify('O equilíbrio prioriza afinidades profissionais e interesses pessoais na exibição das sugestões.', 'info')}><Info size={17} /></button></div><p className="community-panel-description">Personalize o balanceamento de conexões sugeridas pelo motor de IA.</p><div className="community-balance-box"><div><span><i /> {profile.balance ?? 70}% foco profissional</span><span>{100 - (profile.balance ?? 70)}% pessoal & hobbies <i /></span></div><input type="range" min="0" max="100" step="5" value={profile.balance ?? 70} onChange={event => save({ balance: Number(event.target.value) })} aria-label="Percentual de foco profissional" style={{ '--balance': `${profile.balance ?? 70}%` }} /><div className="community-range-labels"><span>MAIS HARD SKILLS & CARREIRAS</span><span>MAIS INTERESSES COMUNS</span></div></div><h3>Alcance geográfico preferencial</h3><p className="community-panel-description">Determine a abrangência territorial para recomendações bilaterais semanais.</p><div className="community-region-picker">{[['local', 'Local'], ['regional', 'Regional (Brasil)'], ['continental', 'Continental (LATAM)']].map(([value, label]) => <button className={profile.region === value || (!profile.region && value === 'regional') ? 'active' : ''} key={value} onClick={() => save({ region: value })}>{label}</button>)}</div><h3>Polos & unidades ativas para sincronização</h3><div className="community-hub-tags">{hubs.map(hub => <span key={hub}><i />{hub}<button aria-label={`Remover ${hub}`} onClick={() => save({ hubs: hubs.filter(item => item !== hub) })}><X size={11} /></button></span>)}<button onClick={() => setHubOpen(true)}><Plus size={12} /> Adicionar polo</button></div></section>
        <section className="community-panel community-contact-objectives"><div className="community-panel-title"><h2><HeartHandshake size={19} /> Objetivos de contato padrão</h2></div><p className="community-panel-description">Defina o tom e os convites que você está receptiva a aceitar sem atrito.</p>{[
          ['coffee', 'Aceitar convites para Coffee Chat Virtual (15 min)', 'Permite que colegas solicitem janelas automáticas de 15 minutos sincronizadas com sua agenda.', Coffee],
          ['mentoring', 'Troca de mentoria técnica e design', 'Exibir selo ativo de mentoria para novos ingressantes e pessoas em transição para áreas de design e UX.', HeartHandshake],
          ['projects', 'Exploração de alocação em novos projetos globais', 'Indicar discretamente a líderes de prática que você possui disponibilidade futura para projetos internacionais.', Globe2],
        ].map(([key, title, description, Icon]) => <label key={key} className="community-objective"><input type="checkbox" checked={!!profile[key]} onChange={event => save({ [key]: event.target.checked })} /><span><strong>{title} <Icon size={13} /></strong><small>{description}</small></span></label>)}</section>
        <section className="community-panel community-governance"><div className="community-panel-title"><h2><Shield size={19} /> Governança, notificações & privacidade</h2></div><p className="community-panel-description">Controles corporativos em conformidade com as políticas internas da Avanade.</p><div className="community-toggle-row"><div><h3>Notificações instantâneas no Microsoft Teams</h3><p>Receba alertas da rede quando um novo match bilateral ocorrer.</p></div><Toggle checked={profile.teamsNotifications !== false} onChange={value => save({ teamsNotifications: value })} label="Notificações no Microsoft Teams" /></div><div className="community-toggle-row"><div><h3>Visibilidade em squads multicountry (LATAM)</h3><p>Permite descoberta do seu perfil por colegas da Avanade Argentina, Colômbia e Chile.</p></div><Toggle checked={profile.latamVisible !== false} onChange={value => save({ latamVisible: value })} label="Visibilidade em squads LATAM" /></div><div className="community-privacy-note"><ShieldCheck size={18} /><div><strong>Privacidade e proteção de dados (LGPD/GDPR)</strong><p>Seus dados profissionais são governados pelas diretrizes éticas da Avanade Global.</p></div><button onClick={() => setPrivacyOpen(true)}>Ler diretrizes</button></div><div className="community-session"><div><strong>Sessão corporativa</strong><p>Encerrar acesso ativo deste terminal com credenciais Microsoft 365.</p></div><button onClick={logOut}><LogOut size={14} /> Sair da conta corporativa</button></div></section>
      </div>
    </div>
    {editOpen && <Modal title="Editar perfil corporativo" onClose={() => setEditOpen(false)}><form className="community-edit-form" onSubmit={saveEdit}><label>Nome completo<input required value={edit.name || ''} onChange={event => setEdit({ ...edit, name: event.target.value })} /></label><label>E-mail corporativo<input value={profile.email || ''} disabled /></label><label>Telefone / Teams<input value={edit.phone || ''} onChange={event => setEdit({ ...edit, phone: event.target.value })} /></label><label>Cidade / estado<input required value={edit.city || ''} onChange={event => setEdit({ ...edit, city: event.target.value })} /></label><label>Unidade / hub<input required value={edit.hub || ''} onChange={event => setEdit({ ...edit, hub: event.target.value })} /></label><Button type="submit">Salvar alterações <Check size={16} /></Button></form></Modal>}
    {summaryOpen && <Modal title="Seu resumo profissional" onClose={() => setSummaryOpen(false)}><form className="community-edit-form" onSubmit={event => { event.preventDefault(); save({ summary: summaryDraft }); setSummaryOpen(false); notify('Resumo profissional atualizado.'); }}><label>Conte um pouco sobre você<textarea required rows={6} maxLength={600} value={summaryDraft} onChange={event => setSummaryDraft(event.target.value)} /></label><span className="community-field-count">{summaryDraft.length}/600 caracteres</span><Button type="submit">Salvar resumo <Check size={16} /></Button></form></Modal>}
    {hubOpen && <Modal title="Adicionar unidade Avanade" onClose={() => setHubOpen(false)}><form className="community-edit-form" onSubmit={event => { event.preventDefault(); if (newHub.trim() && !hubs.includes(newHub.trim())) { save({ hubs: [...hubs, newHub.trim()] }); notify('Unidade adicionada às suas preferências.'); } setHubOpen(false); }}><label>Unidade<input list="community-hub-options" required value={newHub} onChange={event => setNewHub(event.target.value)} /><datalist id="community-hub-options"><option value="Avanade Belo Horizonte" /><option value="Avanade São Paulo" /><option value="Avanade Recife" /><option value="Avanade Rio de Janeiro" /><option value="Avanade Curitiba" /></datalist></label><Button type="submit"><Plus size={16} /> Adicionar unidade</Button></form></Modal>}
    {privacyOpen && <Modal title="Privacidade & governança" onClose={() => setPrivacyOpen(false)}><div className="community-privacy-modal"><span className="community-privacy-shield"><ShieldCheck size={31} /></span><h3>Você tem controle sobre suas conexões.</h3><p>Seu perfil exibe apenas as informações profissionais e afinidades que você escolheu compartilhar. Ajuste a visibilidade, os interesses e as preferências de contato a qualquer momento.</p><p>Esta versão é uma demonstração do front-end. Os dados ficam armazenados no navegador, e mensagens e agendamentos são simulados. A conexão com serviços corporativos e os textos oficiais de privacidade devem ser configurados antes do uso em produção.</p><Button onClick={() => setPrivacyOpen(false)}>Entendi <Check size={16} /></Button></div></Modal>}
  </div>;
}
