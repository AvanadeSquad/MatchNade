import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { IconePessoas } from '../components/Icones.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { API } from '../services/api.js';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const SCRIPT_GOOGLE = 'https://accounts.google.com/gsi/client';
const NOVO_CADASTRO = '__novo__';

// Carrega o script do login do Google. Um script que já falhou é removido para a próxima tentativa recarregá-lo.
function carregarScriptGoogle() {
  if (window.google?.accounts?.id) return Promise.resolve();
  return new Promise((resolver, rejeitar) => {
    const existente = document.querySelector(`script[src="${SCRIPT_GOOGLE}"]`);
    const script = existente ?? Object.assign(document.createElement('script'), { src: SCRIPT_GOOGLE, async: true });
    script.addEventListener('load', resolver, { once: true });
    script.addEventListener(
      'error',
      () => {
        script.remove();
        rejeitar(new Error('Não foi possível carregar o login do Google.'));
      },
      { once: true },
    );
    if (!existente) document.head.appendChild(script);
  });
}

const mensagemDeErro = (erro) =>
  erro.code === 'EMAIL_NAO_LIBERADO' ? 'Seu e-mail ainda não está liberado. Fale com quem administra o Avanade Connect.' : erro.message;

export default function Login() {
  const { token, perfil, entrar } = useAuth();
  const navegar = useNavigate();
  const botaoGoogle = useRef(null);
  const [erro, setErro] = useState('');
  const [usuariosDev, setUsuariosDev] = useState([]);
  const [emailDev, setEmailDev] = useState('');
  const [emailNovo, setEmailNovo] = useState('');
  const [entrando, setEntrando] = useState(false);

  function concluir(resposta) {
    entrar(resposta.token, resposta.employee);
    navegar(resposta.employee.profile_complete ? '/descobrir' : '/bem-vindo', { replace: true });
  }
  // O botão do Google é criado uma vez; o callback dele chama sempre a versão atual de concluir.
  // A referência é atualizada depois de cada renderização, não durante ela, como o React exige.
  const concluirAtual = useRef(concluir);
  useLayoutEffect(() => {
    concluirAtual.current = concluir;
  });

  // Login com Google, quando o ID do cliente está configurado.
  useEffect(() => {
    if (!CLIENT_ID) return undefined;
    let ativo = true;
    carregarScriptGoogle()
      .then(() => {
        if (!ativo) return;
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: async ({ credential }) => {
            setErro('');
            try {
              concluirAtual.current(await API.loginGoogle(credential));
            } catch (e) {
              setErro(mensagemDeErro(e));
            }
          },
        });
        window.google.accounts.id.renderButton(botaoGoogle.current, {
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          width: 320,
          locale: 'pt-BR',
        });
      })
      .catch((e) => ativo && setErro(e.message));
    return () => {
      ativo = false;
    };
  }, []);

  // Em desenvolvimento a API oferece uma lista de pessoas para entrar sem Google.
  useEffect(() => {
    API.usuariosDeDesenvolvimento()
      .then(({ users }) => {
        setUsuariosDev(users);
        setEmailDev(users[0]?.email ?? '');
      })
      .catch(() => {});
  }, []);

  async function entrarComoDev(evento) {
    evento.preventDefault();
    setErro('');
    setEntrando(true);
    try {
      concluir(await API.loginDesenvolvimento(emailDev === NOVO_CADASTRO ? emailNovo : emailDev));
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setEntrando(false);
    }
  }

  if (token && perfil) return <Navigate to={perfil.profile_complete ? '/descobrir' : '/bem-vindo'} replace />;

  const semLogin = !CLIENT_ID && !usuariosDev.length;
  return (
    <main className="auth">
      <section className="auth__marca">
        <div className="entrada__logo">
          <IconePessoas />
        </div>
        <h2>Conheça pessoas da Avanade pelo que vocês têm em comum</h2>
        <p>Interesses profissionais e pessoais aproximam. Cargo e senioridade ficam de fora.</p>
      </section>

      <section className="auth__form">
        <h1>Boas-vindas ao Avanade Connect</h1>
        <p className="subtitulo">Acesse sua rede interna e conecte-se com colaboradores da Avanade.</p>

        {CLIENT_ID && <div ref={botaoGoogle} className="google-botao" />}

        {usuariosDev.length > 0 && (
          <form className="dev-caixa" onSubmit={entrarComoDev}>
            <p className="rotulo">Ambiente de desenvolvimento</p>
            <label className="campo">
              <span>Entrar como</span>
              <select value={emailDev} onChange={(e) => setEmailDev(e.target.value)}>
                {usuariosDev.map((u) => (
                  <option key={u.email} value={u.email}>
                    {u.name}
                  </option>
                ))}
                <option value={NOVO_CADASTRO}>Novo cadastro (outro e-mail)</option>
              </select>
            </label>
            {emailDev === NOVO_CADASTRO && (
              <label className="campo">
                <span>E-mail do novo cadastro</span>
                <input
                  type="email"
                  value={emailNovo}
                  onChange={(e) => setEmailNovo(e.target.value)}
                  placeholder="nome@exemplo.test"
                  required
                />
              </label>
            )}
            <button type="submit" className="botao botao--primario" disabled={entrando}>
              Entrar
            </button>
          </form>
        )}

        {semLogin && <p className="pequeno">O login ainda não está configurado neste ambiente.</p>}
        {erro && (
          <p className="erro-campo" role="alert">
            {erro}
          </p>
        )}
      </section>
    </main>
  );
}
