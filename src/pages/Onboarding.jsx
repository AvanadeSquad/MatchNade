import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, BadgeCheck, Building2, Check, CheckCircle2, ChevronDown,
  CloudUpload, Coffee, Eye, EyeOff, FileText, Flag, Globe2, HeartHandshake,
  IdCard, Info, Linkedin, LockKeyhole, MapPin, Phone, ShieldCheck, Sparkles,
  X, AtSign, Settings2, BriefcaseBusiness, Camera, Gamepad2, Footprints, BookOpen,
  PawPrint, BrainCircuit, CircleHelp, Plus,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Avatar, Badge, Button, Footer, Stepper, Tags } from '../components/ui';
import { userPhoto } from '../data';
import '../styles/onboarding.css';

const professionalInterests = ['Cloud', 'Data & AI', 'UX Design', 'Inovação', 'Métodos Ágeis', 'Gestão', 'DevOps', 'Cybersecurity'];
const personalInterests = ['Cafés Especiais', 'Jogos de Tabuleiro', 'Fotografia', 'Corridas', 'Leitura', 'Pets & Cães'];
const hobbyIcons = { 'Cafés Especiais': Coffee, 'Jogos de Tabuleiro': Gamepad2, Fotografia: Camera, Corridas: Footprints, Leitura: BookOpen, 'Pets & Cães': PawPrint };
const officeOptions = ['Avanade São Paulo', 'Avanade Recife', 'Avanade Rio', 'Avanade Belo Horizonte', 'Avanade Curitiba', 'Avanade Porto Alegre'];
const hubs = [
  'Avanade São Paulo (Chácara Santo Antônio)',
  'Avanade Recife (Porto Digital)',
  'Avanade Rio de Janeiro',
  'Avanade Belo Horizonte',
];

function ProfileField({ label, icon: Icon, status, children }) {
  return <label className="onboarding-field">
    <span className="onboarding-field-label">{label}{status && <span className={status === 'Verificado' ? 'onboarding-verified' : 'muted'}>{status === 'Verificado' && <CheckCircle2 size={13} />}{status}</span>}</span>
    <span className="onboarding-input-wrap"><Icon size={19} aria-hidden="true" />{children}</span>
  </label>;
}

function SecurityNote() {
  return <div className="onboarding-security"><span><ShieldCheck size={16} /> Avanade Single Sign-On Ativo</span><i /><span><LockKeyhole size={15} /> Privacidade de Dados em Conformidade com a LGPD & GDPR</span></div>;
}

function ToggleInterests({ items, selected, onToggle, personal = false }) {
  return <div className="onboarding-interest-chips">{items.map((item) => {
    const Icon = personal ? hobbyIcons[item] : null;
    const active = selected.includes(item);
    return <button type="button" key={item} className={`onboarding-interest-chip ${personal ? 'personal' : ''} ${active ? 'selected' : ''}`} aria-pressed={active} onClick={() => onToggle(item)}>{Icon && <Icon size={14} />}{item === 'Cafés Especiais' ? 'Café Especial' : item}{active && !personal && <Check size={13} />}</button>;
  })}</div>;
}

function RegionSelector({ value, onChange }) {
  return <div className="onboarding-regions" role="group" aria-label="Alcance geográfico">
    {[
      ['local', 'Local (SP)', Building2],
      ['regional', 'Regional (Brasil)', Flag],
      ['continental', 'Continental (LATAM)', Globe2],
    ].map(([id, label, Icon]) => <button key={id} type="button" className={value === id ? 'selected' : ''} aria-pressed={value === id} onClick={() => onChange(id)}><Icon size={17} /><span>{label}</span></button>)}
  </div>;
}

export function LoginPage() {
  const { updateProfile, notify } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const enterDemo = (provider) => {
    if (email.trim()) updateProfile({ email: email.trim() });
    notify(provider ? `${provider}: acesso de demonstração. Nenhuma autenticação externa foi realizada.` : 'Bem-vindo ao ambiente de demonstração!');
    navigate('/cadastro');
  };
  const onSubmit = (event) => {
    event.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Preencha seu e-mail corporativo e a senha para continuar.');
      return;
    }
    enterDemo();
  };

  return <div className="login-page">
    <main className="login-card">
      <section className="login-story">
        <div className="login-mini-brand"><Sparkles size={15} /><span>Avanade<span>Global Connect</span></span></div>
        <Badge tone="orange"><span className="status-dot" /> PLATAFORMA EXCLUSIVA AVANADE</Badge>
        <h1>Conecte-se à rede global de colaboradores.</h1>
        <p>Promova networking espontâneo, compartilhe inovações e impulsione seu desenvolvimento por meio de mentorias corporativas internacionais.</p>
        <div className="login-trust"><span><CheckCircle2 size={16} /> Ambiente seguro com criptografia corporativa</span><span>SSO Ativo</span></div>
        <div className="login-art" aria-hidden="true"><div /><div /><div /></div>
      </section>
      <section className="login-form-section">
        <div className="login-form-heading"><h2>Acesse sua conta</h2><p>Informe suas credenciais ou autentique via SSO corporativo.</p></div>
        <form onSubmit={onSubmit} className="login-form">
          <label className="login-field"><span>E-mail corporativo</span><input autoComplete="username" type="email" placeholder="nome.sobrenome@avanade.com" value={email} onChange={(event) => { setEmail(event.target.value); setError(''); }} required /></label>
          <div className="login-field"><div className="login-password-label"><label htmlFor="login-password">Senha</label><button type="button" onClick={() => notify('Nesta demonstração, use qualquer senha. A recuperação corporativa depende da integração com o Microsoft Entra ID.', 'info')}>Esqueceu sua senha corporativa?</button></div><span className="login-password-input"><input id="login-password" autoComplete="current-password" type={showPassword ? 'text' : 'password'} placeholder="Digite sua senha" value={password} onChange={(event) => { setPassword(event.target.value); setError(''); }} required /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></span></div>
          {error && <p className="onboarding-error" role="alert">{error}</p>}
          <Button type="submit" className="login-submit">Acessar o Global Connect <ArrowRight size={18} /></Button>
        </form>
        <div className="login-divider"><span />ou autenticar com SSO corporativo<span /></div>
        <div className="login-sso-buttons">
          <Button variant="secondary" onClick={() => enterDemo('Microsoft 365')}><span className="microsoft-logo" aria-hidden="true"><i /><i /><i /><i /></span>Entrar com Microsoft 365 (Entra ID)</Button>
          <Button variant="secondary" onClick={() => enterDemo('LinkedIn corporativo')}><Linkedin size={19} className="linkedin-icon" />Avanade LinkedIn Corporativo</Button>
        </div>
        <p className="login-new-user">Novo colaborador ou necessita de primeiro acesso? <button onClick={() => { notify('Vamos configurar seu perfil de demonstração.', 'info'); navigate('/cadastro'); }}>Solicitar acesso interno</button></p>
        <p className="login-demo-note"><Info size={13} /> Protótipo interativo. Login e SSO demonstrativos.</p>
      </section>
    </main>
    <Footer simple />
  </div>;
}

export function BasicsPage() {
  const { profile, updateProfile, notify } = useApp();
  const navigate = useNavigate();
  const [details, setDetails] = useState({ name: profile.name, email: profile.email, phone: profile.phone, hub: profile.hub, city: profile.city, postal: profile.postal });
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState('');
  const update = (key) => (event) => setDetails((current) => ({ ...current, [key]: event.target.value }));
  const onSubmit = (event) => {
    event.preventDefault();
    if (!terms) { setError('Aceite os termos de convivência para continuar.'); return; }
    updateProfile(details);
    navigate('/interesses');
  };
  return <div className="onboarding-page basics-page">
    <main className="onboarding-container basics-container">
      <Stepper step={1} />
      <header className="onboarding-heading"><Badge tone="purple"><span className="status-dot" /> Avanade Global Connect</Badge><h1>Conecte-se à rede Avanade</h1><p>Confirme seus dados profissionais para viabilizar conexões autênticas com colegas de squads, comunidades e unidades ao redor do mundo.</p></header>
      <form className="basics-card onboarding-card" onSubmit={onSubmit}>
        <div className="basics-columns">
          <section><div className="onboarding-section-heading"><h2>Perfil do Colaborador</h2><p>Informações sincronizadas com o diretório interno</p></div>
            <ProfileField label="Nome completo (crachá)" icon={IdCard} status="Obrigatório"><input value={details.name} onChange={update('name')} required autoComplete="name" /></ProfileField>
            <ProfileField label="E-mail corporativo" icon={AtSign} status="Verificado"><input value={details.email} onChange={update('email')} required type="email" autoComplete="email" /></ProfileField>
            <ProfileField label="Telefone interno / Teams" icon={Phone}><input value={details.phone} onChange={update('phone')} type="tel" autoComplete="tel" /></ProfileField>
          </section>
          <section><div className="onboarding-section-heading"><h2>Hub & Localidade</h2><p>Sua base física de trabalho ou referência</p></div>
            <ProfileField label="Unidade / Hub Avanade" icon={Building2}><select value={details.hub} onChange={update('hub')} aria-label="Unidade ou Hub Avanade">{!hubs.includes(details.hub) && <option value={details.hub}>{details.hub}</option>}{hubs.map((hub) => <option key={hub}>{hub}</option>)}</select><ChevronDown size={15} /></ProfileField>
            <ProfileField label="Cidade / Estado" icon={MapPin}><input value={details.city} onChange={update('city')} required autoComplete="address-level2" /></ProfileField>
            <ProfileField label="Localidade / CEP corporativo" icon={Building2}><input value={details.postal} onChange={update('postal')} autoComplete="postal-code" /></ProfileField>
          </section>
        </div>
        <div className="basics-actions"><div className="basics-terms"><label><input type="checkbox" checked={terms} onChange={(event) => { setTerms(event.target.checked); setError(''); }} /><span>Concordo com os <button type="button" onClick={() => notify('Respeite seus colegas, mantenha os dados corporativos em sigilo e use a rede para conexões profissionais e humanas. Os termos oficiais serão disponibilizados pela Avanade.', 'info')}>Termos de Convivência</button> e Governança Global Connect</span></label>{error && <p className="onboarding-error" role="alert">{error}</p>}</div><Button type="button" variant="ghost" onClick={() => navigate('/entrar')}>Cancelar</Button><Button type="submit">Continuar para Interesses <ArrowRight size={18} /></Button></div>
      </form>
      <SecurityNote />
    </main>
  </div>;
}

export function InterestsPage() {
  const { profile, updateProfile, notify } = useApp();
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [analysis, setAnalysis] = useState('idle');
  const [uploadError, setUploadError] = useState('');
  const fileInput = useRef(null);
  const analysisTimer = useRef(null);
  useEffect(() => () => { if (analysisTimer.current) clearTimeout(analysisTimer.current); }, []);
  const skills = profile.skills || [];
  const hobbies = profile.hobbies || [];
  const toggle = (key, item) => {
    updateProfile((current) => {
      const values = current[key] || [];
      return { [key]: values.includes(item) ? values.filter((value) => value !== item) : [...values, item] };
    });
  };
  const chooseFile = (selected) => {
    if (!selected) return;
    if (!/\.(pdf|docx)$/i.test(selected.name)) { setUploadError('Selecione um arquivo PDF ou DOCX.'); return; }
    if (selected.size > 10 * 1024 * 1024) { setUploadError('O arquivo deve ter no máximo 10 MB.'); return; }
    setFile(selected); setUploadError(''); setAnalysis('idle');
  };
  const analyze = () => {
    if (!file) { fileInput.current?.click(); return; }
    setAnalysis('loading');
    analysisTimer.current = setTimeout(() => {
      updateProfile((current) => ({ skills: [...new Set([...(current.skills || []), 'Cloud', 'UX Design'])] }));
      setAnalysis('done');
      notify('Demonstração concluída: Cloud e UX Design foram adicionados. Seu arquivo não foi enviado nem analisado por um serviço externo.', 'info');
    }, 1100);
  };
  return <div className="onboarding-page interests-page">
    <main className="onboarding-container interests-container">
      <div className="interests-stepper"><Stepper step={2} /></div>
      <header className="interests-heading"><Badge tone="orange"><Sparkles size={13} /> Mapeamento Dinâmico de Afinidades</Badge><h1>Quais são os seus interesses e objetivos?</h1><p>O algoritmo cruza afinidades técnicas e humanas para sugerir colegas ideais.</p></header>
      <div className="interests-grid">
        <div className="interests-left-column">
          <section className="onboarding-card interests-goal-card"><span className="onboarding-kicker">PROPÓSITO DE REDE</span><div className="onboarding-heading-row"><h2>Qual o seu objetivo principal de conexão?</h2><CircleHelp size={17} /></div>
            <label className={`goal-option ${profile.goal === 'colleagues' ? 'selected' : ''}`}><input type="radio" name="goal" checked={profile.goal === 'colleagues'} onChange={() => updateProfile({ goal: 'colleagues' })} /><span><strong><Coffee size={17} /> Conectar com colegas <small>Recomendado</small></strong><span>Interesses mútuos, vivências culturais, trocas de rotina e cafés informais entre equipes globais.</span></span></label>
            <label className={`goal-option ${profile.goal === 'opportunities' ? 'selected' : ''}`}><input type="radio" name="goal" checked={profile.goal === 'opportunities'} onChange={() => updateProfile({ goal: 'opportunities' })} /><span><strong><HeartHandshake size={17} /> Encontrar oportunidades</strong><span>Mentoria executiva, colaboração em novos squads, projetos cross-regional e intercâmbio de competências.</span></span></label>
          </section>
          <section className="onboarding-card import-card"><div className="onboarding-heading-row"><div><span className="onboarding-kicker green">ACELERADOR INTELIGENTE <Badge tone="green">Opcional</Badge></span><h2>Importação Inteligente com IA</h2><p>Experimente o fluxo de extração de competências a partir do seu currículo corporativo.</p></div><span className="import-icon"><FileText size={25} /></span></div>
            <div className={`onboarding-uploader ${dragging ? 'dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files[0]); }}>
              <input ref={fileInput} type="file" accept=".pdf,.docx" onChange={(event) => chooseFile(event.target.files[0])} className="visually-hidden" aria-label="Selecionar currículo PDF ou DOCX" />
              <button className="upload-select-button" type="button" onClick={() => fileInput.current?.click()}><span className="upload-cloud"><CloudUpload size={23} /></span><strong>{file ? file.name : 'Arrastar currículo ou perfil em PDF'}</strong><span>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB · Clique para trocar o arquivo` : 'Suporta PDF ou DOCX · máximo de 10 MB'}</span></button>
              <Button variant="secondary" type="button" onClick={analyze} disabled={analysis === 'loading'}><BrainCircuit size={16} />{analysis === 'loading' ? 'Simulando análise...' : 'Analisar com IA'}</Button>
              <span className="analysis-demo-label">Demonstração local · análise simulada</span>
            </div>
            {uploadError && <p className="onboarding-error" role="alert">{uploadError}</p>}
            <div className="analysis-feedback" aria-live="polite"><div><strong><CheckCircle2 size={16} /> Feedback em Tempo Real da IA</strong><span>{analysis === 'done' ? 'SIMULAÇÃO CONCLUÍDA' : analysis === 'loading' ? 'PROCESSANDO DEMONSTRAÇÃO' : 'PERFIL SINCRONIZADO'}</span></div><div className="analysis-status"><span><BadgeCheck size={15} />{analysis === 'done' ? 'Simulação de leitura ✓' : 'Perfil disponível ✓'}</span><span><Building2 size={15} />Interesses mapeados ({skills.length + hobbies.length}) ✓</span></div><p><Sparkles size={16} />{analysis === 'done' ? 'Sugestão demonstrativa: adicionamos Cloud e UX Design. Você pode ajustar todos os interesses ao lado.' : 'Suas escolhas ajudam a encontrar pessoas com afinidades profissionais e pessoais.'}</p></div>
          </section>
        </div>
        <section className="onboarding-card interests-selection-card"><div className="onboarding-selection-section"><div className="onboarding-heading-row"><div><span className="onboarding-kicker">HARD SKILLS & DISCIPLINAS</span><h2>Interesses Profissionais</h2></div><Badge tone="purple">{skills.length} Selecionados</Badge></div><p>Selecione as frentes de especialidade que você domina ou gostaria de discutir.</p><ToggleInterests items={professionalInterests} selected={skills} onToggle={(item) => toggle('skills', item)} /></div>
          <div className="onboarding-selection-section"><div className="onboarding-heading-row"><div><span className="onboarding-kicker green">AFINIDADE HUMANA</span><h2>Interesses Pessoais / Quebra-Gelo</h2></div><Badge tone="purple">{hobbies.length} Selecionados</Badge></div><p>Tópicos da vida real para transformar bate-papos virtuais em pontes de amizade.</p><ToggleInterests items={personalInterests} selected={hobbies} onToggle={(item) => toggle('hobbies', item)} personal /></div>
          <div className="interest-relevance"><span className="relevance-circle">{skills.length + hobbies.length >= 5 ? 88 : Math.min(88, 40 + (skills.length + hobbies.length) * 8)}%</span><div><h3>Índice de Relevância</h3><p>{skills.length + hobbies.length >= 5 ? 'Seu perfil está pronto para descobrir conexões com interesses em comum.' : 'Selecione seus interesses para melhorar as sugestões de conexão.'}</p></div></div>
        </section>
      </div>
      <div className="onboarding-card onboarding-bottom-actions"><Button variant="secondary" onClick={() => navigate('/cadastro')}><ArrowLeft size={17} /> Voltar</Button><div><span>Progresso salvo neste dispositivo</span><Button onClick={() => { if (!skills.length) { notify('Selecione pelo menos um interesse profissional para continuar.', 'info'); return; } navigate('/preferencias'); }}>Salvar e Ver Preferências <ArrowRight size={18} /></Button></div></div>
    </main>
  </div>;
}

export function PreferencesPage() {
  const { profile, updateProfile, notify } = useApp();
  const navigate = useNavigate();
  const [addingHub, setAddingHub] = useState(false);
  const [newHub, setNewHub] = useState('');
  const enabledHubs = profile.hubs || [];
  const balance = Number(profile.balance ?? 70);
  const person = { name: profile.name, photo: userPhoto };
  const addHub = () => {
    if (!newHub) return;
    updateProfile({ hubs: [...new Set([...enabledHubs, newHub])] });
    setNewHub(''); setAddingHub(false);
  };
  return <div className="onboarding-page preferences-page">
    <main className="onboarding-container preferences-container">
      <Stepper step={3} />
      <header className="onboarding-heading preferences-heading"><Badge tone="orange">ETAPA FINAL DE CONFIGURAÇÃO</Badge><h1>Suas preferências de Match Corporativo</h1><p>Defina o equilíbrio das sugestões para que os encontros virtuais sejam relevantes para sua rotina.</p></header>
      <div className="preferences-grid">
        <section className="preferences-profile-column"><div className="preferences-column-heading"><h2>Resumo do seu Perfil</h2><Badge tone="green"><span className="status-dot" /> Verificado</Badge></div><div className="onboarding-card preferences-profile-card"><div className="preferences-person"><Avatar person={person} size={66} /><div><h3>{profile.name} <BadgeCheck size={16} /></h3><p>UX & Design Consultant</p><small><MapPin size={12} />{profile.city} · Studio Digital</small></div></div><p className="preferences-summary">{profile.summary || 'Especialista em Design System, Acessibilidade e Design Ops na Avanade. Interessada em expandir parcerias entre times de Produto, Arquitetura de Nuvem e Mentoria de novos talentos.'}</p><div className="preferences-tag-section"><div><span>INTERESSES PROFISSIONAIS</span><button onClick={() => navigate('/interesses')}>Editar</button></div><Tags items={profile.skills || []} tone="purple" /></div><div className="preferences-tag-section"><div><span>HOBBIES & CONEXÃO PESSOAL</span><button onClick={() => navigate('/interesses')}>Editar</button></div><Tags items={profile.hobbies || []} tone="orange" /></div><div className="preferences-profile-footer"><span><BadgeCheck size={15} /> Perfil preenchido</span><button onClick={() => notify('Este resumo mostra as informações que seus colegas poderão ver no ambiente de demonstração.', 'info')}>Ver preview público</button></div></div></section>
        <section className="preferences-controls-column"><div className="preferences-column-heading"><h2>Parâmetros de Prioridade de Match</h2><span><Settings2 size={14} /> Ajuste Dinâmico</span></div><div className="onboarding-card preferences-controls-card">
          <div className="balance-heading"><div><h3>Equilíbrio do Algoritmo</h3><p>Como você prefere balancear as recomendações de coffee chat?</p></div><div className="balance-values"><Badge tone="orange">{balance}%<br />Profissional</Badge><Badge tone="orange">{100 - balance}%<br />Pessoal</Badge></div></div>
          <input className="onboarding-balance-slider" type="range" min="0" max="100" step="5" value={balance} onChange={(event) => updateProfile({ balance: Number(event.target.value) })} aria-label="Porcentagem de afinidade profissional" style={{ '--balance': `${balance}%` }} />
          <div className="balance-legends"><span><BriefcaseBusiness size={12} /> MAIS FOCO TÉCNICO / CARREIRA</span><span>MAIS AMIZADE / DESCONTRAÇÃO <Coffee size={12} /></span></div>
          <div className="preferences-control-section"><h3>Alcance Geográfico</h3><p>Escolha o raio de pessoas prioritárias para suas rodadas de conexão.</p><RegionSelector value={profile.region} onChange={(region) => updateProfile({ region })} /></div>
          <div className="preferences-control-section"><div className="onboarding-heading-row"><div><h3>Unidades Avanade Habilitadas</h3><p>Selecione escritórios dos quais deseja receber convites espontâneos.</p></div><button className="onboarding-text-button" onClick={() => setAddingHub(!addingHub)}><Plus size={13} /> Adicionar Polo</button></div><div className="preferences-hubs">{enabledHubs.map((hub) => <span key={hub}><Building2 size={13} />{hub}<button type="button" aria-label={`Remover ${hub}`} onClick={() => updateProfile({ hubs: enabledHubs.filter((value) => value !== hub) })}><X size={13} /></button></span>)}<button className="add-hub-button" onClick={() => setAddingHub(true)}><Plus size={13} /> Adicionar unidade</button></div>{addingHub && <div className="preferences-add-hub"><select aria-label="Polo para adicionar" value={newHub} onChange={(event) => setNewHub(event.target.value)}><option value="">Selecione uma unidade</option>{officeOptions.filter((hub) => !enabledHubs.includes(hub)).map((hub) => <option key={hub}>{hub}</option>)}</select><Button variant="secondary" onClick={addHub} disabled={!newHub}>Adicionar</Button></div>}</div>
          <div className="preferences-privacy"><ShieldCheck size={22} /><div><h3>Privacidade Avanade Shield</h3><p>Seus dados são restritos ao ecossistema corporativo interno.<br />Você pode alterar pesos de match e disponibilidade na agenda a qualquer momento.</p></div></div>
          <div className="preferences-save-actions"><Button variant="ghost" onClick={() => navigate('/interesses')}><ArrowLeft size={16} /> Voltar ao Mapeamento</Button><Button onClick={() => { notify('Preferências salvas. Sua próxima conexão começa aqui!'); navigate('/descobrir'); }}>Salvar preferências e acessar a plataforma <ArrowRight size={20} /></Button></div>
        </div></section>
      </div>
    </main>
  </div>;
}
