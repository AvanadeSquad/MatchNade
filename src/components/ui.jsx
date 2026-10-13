import { useEffect, useId, useRef, useState } from 'react';
import { Check, X, ShieldCheck, LockKeyhole } from 'lucide-react';

export function Button({ variant = 'primary', className = '', children, type = 'button', ...props }) {
  return <button type={type} className={`btn btn--${variant} ${className}`} {...props}>{children}</button>;
}

export function Badge({ tone = 'orange', className = '', children, ...props }) {
  return <span className={`badge badge--${tone} ${className}`} {...props}>{children}</span>;
}

export function Avatar({ person, size = 48, online = false, className = '' }) {
  const [failed, setFailed] = useState(false);
  const initials = (person?.name || 'Avanade Connect').split(' ').map(word => word[0]).slice(0, 2).join('');
  return <span className={`avatar ${className}`} style={{ width: size, height: size, '--avatar-size': `${size}px` }}>
    {person?.photo && !failed ? <img src={person.photo} alt={`Foto de ${person.name}`} onError={() => setFailed(true)} loading="lazy" /> : <span className="avatar-initials" aria-label={person?.name}>{initials}</span>}
    {online && <span className={`avatar-status ${person?.status === 'away' ? 'avatar-status--away' : ''}`} aria-label={person?.status === 'away' ? 'Ausente' : 'Disponível'} />}
  </span>;
}

export function Tags({ items = [], tone = 'purple', onRemove }) {
  return <div className="tags">{items.map(item => <span className={`chip chip--${tone}`} key={item}>{item}{onRemove && <button type="button" aria-label={`Remover ${item}`} onClick={() => onRemove(item)}><X size={12} /></button>}</span>)}</div>;
}

export function Modal({ title, children, onClose }) {
  const titleId = useId();
  const dialog = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    const scroll = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.querySelector('button, input, select, textarea, [tabindex="0"]')?.focus();
    function onKey(event) {
      if (event.key === 'Escape') close.current();
      if (event.key === 'Tab') {
        const focusable = [...(dialog.current?.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]') || [])];
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = scroll; document.removeEventListener('keydown', onKey); previous?.focus(); };
  }, []);
  return <div className="modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={dialog}>
      <div className="modal-heading"><h2 id={titleId}>{title}</h2><button className="icon-button" type="button" onClick={onClose} aria-label="Fechar janela"><X size={20} /></button></div>
      <div className="modal-body">{children}</div>
    </section>
  </div>;
}

export function Stepper({ step = 1 }) {
  const labels = ['Dados Básicos', 'Interesses & IA', 'Preferências & Match'];
  return <nav className={`stepper stepper--${step}`} aria-label="Etapas de configuração"><ol>{labels.map((label, index) => <li key={label} className={`${index + 1 < step ? 'complete' : ''} ${index + 1 === step ? 'current' : ''}`} aria-current={index + 1 === step ? 'step' : undefined}>
    <span className="step-circle">{index + 1 < step ? <Check size={16} /> : index + 1}</span><span className="step-label">{label}</span>
  </li>)}</ol></nav>;
}

export function Logo({ compact = false }) {
  return <span className={`brand ${compact ? 'brand--compact' : ''}`}><span>Avanade</span><strong>Connect</strong></span>;
}

export function Footer({ simple = false }) {
  const [document, setDocument] = useState(null);
  return <>
    <footer className={`site-footer ${simple ? 'site-footer--simple' : ''}`}>
      {simple ? <span>© 2025 Avanade Inc. Todos os direitos reservados.</span> : <div className="footer-brand"><strong>Avanade Connect</strong><span>• Fostering Global Human Connection</span></div>}
      <nav aria-label="Links institucionais"><button onClick={() => setDocument('Políticas de Conexão')}>{simple ? 'Política de Privacidade Global' : 'Políticas de Conexão'}</button><button onClick={() => setDocument('Privacidade Avanade')}>{simple ? 'Normas de Conduta Corporativa' : 'Privacidade Avanade'}</button><button onClick={() => setDocument('Suporte & Mentoria')}>{simple ? 'Central de Suporte de TI' : 'Suporte & Mentoria'}</button></nav>
      {!simple && <span className="footer-copyright">© 2025 Avanade Inc. All rights reserved.</span>}
    </footer>
    {document && <Modal title={document} onClose={() => setDocument(null)}><div className="info-document"><ShieldCheck size={32} /><p>Este é um protótipo de front-end do Avanade Global Connect. As informações de perfil, conexões e mensagens são dados de demonstração armazenados neste navegador.</p><p>Em uma implantação corporativa, este espaço receberá as políticas aprovadas e os canais oficiais de suporte da organização.</p><Button onClick={() => setDocument(null)}>Entendido <Check size={16} /></Button></div></Modal>}
  </>;
}

export function SecurityNote() {
  return <div className="security-note"><span><ShieldCheck size={14} />Avanade Single Sign-On Ativo</span><span className="security-dot">•</span><span><LockKeyhole size={14} />Privacidade de Dados em Conformidade com a LGPD & GDPR</span></div>;
}
