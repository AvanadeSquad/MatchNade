// Versões de celular das telas (matchMedia simulado abaixo de 900 px): estrutura e fluxos que mudam em relação ao desktop.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.jsx';
import { AvisosProvider } from './context/Avisos.jsx';
import { API } from './services/api.js';

const auth = vi.hoisted(() => ({ valor: null }));
vi.mock('./context/AuthContext.jsx', () => ({ useAuth: () => auth.valor }));

const PERFIL = {
  id: 1,
  name: 'Ana Silva',
  email: 'ana@exemplo.test',
  bio: 'Desenho interfaces.',
  position: null,
  department: 'Experience Design',
  location: 'São Paulo, SP',
  connection_goals: ['NETWORKING'],
  max_weekly_matches: 3,
  is_paused: false,
  tags: {
    technical: [
      { id: 1, name: 'Figma', source: 'AI' },
      { id: 2, name: 'React', source: 'MANUAL' },
    ],
    hobby: [{ id: 3, name: 'Fotografia', source: 'MANUAL' }],
  },
  profile_complete: true,
  quota: { used: 1, max: 3 },
  connections_count: 2,
};
const CONEXAO = {
  match_id: 7,
  employee_id: 2,
  name: 'Marina Costa',
  department: 'Tecnologia e Inovação',
  city: 'São Paulo',
  affinity_score: 0.62,
  shared_interests: ['Figma', 'Fotografia'],
};
const PESSOA = {
  id: 2,
  name: 'Marina Costa',
  department: 'Tecnologia e Inovação',
  city: 'São Paulo',
  connection_goals: ['HOBBY'],
  tags: { technical: [{ id: 1, name: 'Figma' }], hobby: [{ id: 3, name: 'Fotografia' }] },
  affinity: { score: 0.62, technical: 0.5, personal: 0.7 },
  shared_interests: ['Figma', 'Fotografia'],
  connection: null,
};

beforeEach(() => {
  window.matchMedia = (q) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} });
  window.HTMLElement.prototype.scrollIntoView = () => {};
  vi.spyOn(API, 'conexoes').mockResolvedValue({
    recebidas: [{ ...CONEXAO, match_id: 8, employee_id: 3, name: 'Bruno Lima' }],
    aguardando: [],
    confirmadas: [{ ...CONEXAO, new: true }],
  });
  vi.spyOn(API, 'recomendacoes').mockResolvedValue({ recommendations: [CONEXAO] });
  vi.spyOn(API, 'pessoa').mockResolvedValue(PESSOA);
  vi.spyOn(API, 'tags').mockResolvedValue({
    tags: [
      { name: 'Figma', category: 'TECHNICAL', uso: 3 },
      { name: 'React', category: 'TECHNICAL', uso: 3 },
      { name: 'Fotografia', category: 'HOBBY', uso: 2 },
    ],
  });
  vi.spyOn(API, 'mensagens').mockResolvedValue({
    messages: [{ id: 1, sender_id: 2, body: 'Olá Ana!', created_at: new Date().toISOString() }],
  });
  vi.spyOn(API, 'quebraGelo').mockResolvedValue({ match_summary: 'Que tal falar de fotografia?' });
  vi.spyOn(API, 'usuariosDeDesenvolvimento').mockResolvedValue({ users: [{ name: 'Ana Silva', email: 'ana@exemplo.test' }] });
});
afterEach(() => {
  delete window.matchMedia;
});

function montar(rota, perfil = PERFIL, token = 't') {
  auth.valor = {
    token,
    perfil,
    carregando: false,
    definirPerfil: vi.fn(),
    atualizarPerfilEmSilencio: vi.fn(),
    sair: vi.fn(),
    entrar: vi.fn(),
  };
  render(
    <AvisosProvider>
      <MemoryRouter initialEntries={[rota]}>
        <App />
      </MemoryRouter>
    </AvisosProvider>,
  );
}

describe('telas no celular', () => {
  it('login', async () => {
    montar('/login', null, null);
    expect(await screen.findByText('Bem-vindo ao Global Connect')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Solicitar acesso interno' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /linkedin/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/senha/i)).not.toBeInTheDocument();
  });
  it('cadastro em duas telas', async () => {
    const u = userEvent.setup();
    vi.spyOn(API, 'atualizarPerfil').mockResolvedValue(PERFIL);
    montar('/cadastro/dados', { ...PERFIL, profile_complete: false });
    expect(screen.getByText('Conecte-se à rede Avanade')).toBeInTheDocument();
    await u.click(screen.getByRole('checkbox'));
    await u.click(screen.getByRole('button', { name: 'Conectar-se' }));
    expect(await screen.findByText('Dados da unidade')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(API.atualizarPerfil).toHaveBeenCalledWith({ name: 'Ana Silva', department: 'Experience Design', location: 'São Paulo, SP' });
  });
  it('fluxo de interesses: objetivo, importação com IA, interesses e revisão', async () => {
    const u = userEvent.setup();
    vi.spyOn(API, 'analisarBio').mockResolvedValue({ technical_tags: ['Kubernetes'], hobby_tags: [] });
    vi.spyOn(API, 'salvarInteresses').mockResolvedValue(PERFIL);
    vi.spyOn(API, 'atualizarPerfil').mockResolvedValue(PERFIL);
    montar('/cadastro/interesses');
    expect(await screen.findByText('Qual é o seu objetivo de conexão?')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByText('Importe seus interesses')).toBeInTheDocument();
    await u.type(screen.getByLabelText('Resumo para importar'), 'Uso Kubernetes.');
    await u.click(screen.getByRole('button', { name: 'Importar interesses' }));
    expect(await screen.findByText('IA identificando seu perfil...')).toBeInTheDocument();
    expect(await screen.findByText('Quais são seus interesses?', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kubernetes' })).toHaveAttribute('aria-pressed', 'true');
    await u.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByText('Perfil de Colaborador')).toBeInTheDocument();
  }, 10000);
  it('preferências', async () => {
    montar('/cadastro/preferencias');
    expect(await screen.findByText('O que você quer priorizar nas suas conexões?')).toBeInTheDocument();
  });
  it('descobrir', async () => {
    montar('/descobrir');
    expect(await screen.findByRole('heading', { name: 'Marina Costa' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /demonstrar interesse em marina/i })).toBeInTheDocument();
  });
  it('detalhes', async () => {
    montar('/pessoa/2');
    expect(await screen.findByText('Detalhes do Colaborador')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Demonstrar Interesse' })).toBeInTheDocument();
  });
  it('match', async () => {
    montar('/match/7');
    expect(await screen.findByText('É um Match!')).toBeInTheDocument();
  });
  it('conexões', async () => {
    montar('/matches');
    expect(await screen.findByText('Conexões Bilaterais')).toBeInTheDocument();
    expect(await screen.findByText('Bruno Lima')).toBeInTheDocument();
  });
  it('chat', async () => {
    montar('/chat/7');
    // A prévia da lista também mostra a mensagem; no navegador o CSS esconde a lista com a conversa aberta.
    expect((await screen.findAllByText('Olá Ana!')).length).toBeGreaterThan(0);
    expect(screen.getByText('Match bilateral')).toBeInTheDocument();
  });
  it('perfil com menu', async () => {
    const u = userEvent.setup();
    montar('/eu');
    expect(await screen.findByText('Meu Perfil Avanade')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Preferências de Busca' }));
    expect(screen.getByText('Parâmetros do Algoritmo de Match')).toBeInTheDocument();
  });
});
