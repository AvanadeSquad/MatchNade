import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Info, X, AlertCircle } from 'lucide-react';
import { people } from '../data';
import { readDemoState, writeDemoState } from '../utils/demoStorage';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [stored] = useState(readDemoState);
  const [profile, setProfile] = useState(stored.profile);
  const [matchIds, setMatchIds] = useState(stored.matchIds);
  const [scheduled, setScheduled] = useState(stored.scheduled);
  const [messages, setMessages] = useState(stored.messages);
  const [activeContact, setActiveContact] = useState('marina');
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const navigate = useNavigate();

  useEffect(() => { writeDemoState({ profile, matchIds, scheduled, messages }); }, [profile, matchIds, scheduled, messages]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const notify = useCallback((message, type = 'success') => {
    clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);
  const updateProfile = useCallback((patch) => setProfile(current => ({ ...current, ...(typeof patch === 'function' ? patch(current) : patch) })), []);
  const connect = useCallback((person) => {
    setMatchIds(current => current.includes(person.id) ? current : [person.id, ...current]);
    notify(`Conexão com ${person.name.split(' ')[0]} adicionada aos seus matches de demonstração.`);
  }, [notify]);
  const scheduleCoffee = useCallback((person, slot = 'Sexta-feira, às 10:30') => {
    setScheduled(current => ({ ...current, [person.id]: slot }));
    setMatchIds(current => current.includes(person.id) ? current : [person.id, ...current]);
    notify(`Café com ${person.name.split(' ')[0]} agendado: ${slot}. Convite salvo nesta demonstração.`);
  }, [notify]);
  const sendMessage = useCallback((contactId, text) => {
    const content = text.trim();
    if (!content) return;
    const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date());
    setMessages(current => ({ ...current, [contactId]: [...(current[contactId] || []), { id: crypto.randomUUID(), text: content, own: true, time }] }));
  }, []);
  const acceptInvite = useCallback((contactId) => {
    const person = people.find(item => item.id === contactId);
    if (person) scheduleCoffee(person, 'Terça-feira, às 10:30');
  }, [scheduleCoffee]);
  const logOut = useCallback(() => {
    setSearchQuery('');
    navigate('/entrar');
    notify('Você saiu da sessão de demonstração. Seu perfil continua salvo neste navegador.', 'info');
  }, [navigate, notify]);
  const matches = matchIds.map(id => people.find(person => person.id === id)).filter(Boolean);
  const value = { profile, updateProfile, matches, connect, scheduled, scheduleCoffee, activeContact, setActiveContact, messages, sendMessage, acceptInvite, logOut, notify, searchQuery, setSearchQuery };
  const ToastIcon = toast?.type === 'error' ? AlertCircle : toast?.type === 'info' ? Info : CheckCircle2;

  return <AppContext.Provider value={value}>
    {children}
    {toast && <div className={`toast toast--${toast.type}`} role="status" aria-live="polite">
      <ToastIcon size={20} /><span>{toast.message}</span><button type="button" onClick={() => setToast(null)} aria-label="Fechar notificação"><X size={17} /></button>
    </div>}
  </AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp precisa de AppProvider');
  return context;
}
