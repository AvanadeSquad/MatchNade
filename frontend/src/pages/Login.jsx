import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  IconeCheckCirculo,
  IconeGoogle,
  IconeLinkedin,
  IconeMicrosoft,
  IconeOlho,
  IconeOlhoFechado,
  IconeSeta,
} from '../components/Icones.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useAviso } from '../context/Avisos.jsx';
import { useCelular } from '../hooks/useCelular.js';
import { API } from '../services/api.js';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const SCRIPT_GOOGLE = 'https://accounts.google.com/gsi/client';

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

const destinoDepoisDoLogin = (perfil) => (perfil.profile_complete ? '/descobrir' : '/cadastro/dados');

export default function Login() {
  const { token, perfil, entrar } = useAuth();
  const avisar = useAviso();
  const navegar = useNavigate();
  const botaoGoogle = useRef(null);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [verSenha, setVerSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [usuariosDev, setUsuariosDev] = useState(null);
  const celular = useCelular();

  function concluir(resposta) {
    entrar(resposta.token, resposta.employee);
    navegar(destinoDepoisDoLogin(resposta.employee), { replace: true });
  }
  // O botão do Google é criado uma vez; o callback dele chama sempre a versão atual de concluir.
  const concluirAtual = useRef(concluir);
  useLayoutEffect(() => {
    concluirAtual.current = concluir;
  });

  // SSO com Google, quando o ID do cliente está configurado (é o SSO que a API valida hoje).
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
          shape: 'rectangular',
          text: 'continue_with',
          width: 346,
          locale: 'pt-BR',
        });
      })
      .catch((e) => ativo && setErro(e.message));
    return () => {
      ativo = false;
    };
  }, []);

  // Em desenvolvimento a API libera o acesso pelo e-mail (AUTH_DEV_LOGIN) e lista as contas de demonstração.
  useEffect(() => {
    API.usuariosDeDesenvolvimento()
      .then(({ users }) => setUsuariosDev(users))
      .catch(() => setUsuariosDev([]));
  }, []);

  const acessoPorEmail = usuariosDev !== null && usuariosDev.length > 0;

  async function enviar(evento) {
    evento.preventDefault();
    setErro('');
    if (!acessoPorEmail) {
      setErro('O acesso por e-mail ainda não está habilitado neste ambiente. Use o SSO corporativo abaixo.');
      return;
    }
    setEntrando(true);
    try {
      concluir(await API.loginDesenvolvimento(email.trim()));
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setEntrando(false);
    }
  }

  const ssoIndisponivel = (provedor) => () =>
    avisar(
      `O SSO ${provedor} ainda não está habilitado na API. ${CLIENT_ID ? 'Use o botão do Google.' : 'Use o e-mail corporativo.'}`,
      'info',
    );

  const esqueciSenha = () => avisar('A senha é a mesma da sua conta corporativa. Para trocar, use o portal de TI.', 'info');
  const solicitarAcesso = () =>
    avisar(
      acessoPorEmail
        ? 'Informe seu e-mail corporativo acima: o cadastro começa no primeiro acesso.'
        : 'Peça a liberação do seu e-mail a quem administra o Avanade Connect.',
      'info',
    );

  if (token && perfil) return <Navigate to={destinoDepoisDoLogin(perfil)} replace />;

  return (
    <main className="login">
      <div className="login__cartao">
        <section className="login__marca" aria-label="Sobre o Avanade Connect">
          <p className="login__logo">
            Avanade <strong>Connect</strong>
          </p>
          <span className="selo-ponto">Plataforma exclusiva Avanade</span>
          <h1>Conecte-se à rede global de colaboradores.</h1>
          <p className="login__texto">
            Promova networking espontâneo, compartilhe inovações e impulsione seu desenvolvimento por meio de mentorias corporativas
            internacionais.
          </p>
          <div className="login__rodape-marca">
            <span>
              <IconeCheckCirculo /> Ambiente seguro: sessão autenticada por token
            </span>
            <span>Cargo e senioridade ficam de fora</span>
          </div>
        </section>

        <section className="login__form">
          <h2>{celular ? 'Bem-vindo ao Global Connect' : 'Acesse sua conta'}</h2>
          <p className="subtitulo">
            {celular
              ? 'Acesse sua rede interna e conecte-se com colaboradores da Avanade.'
              : 'Informe suas credenciais ou autentique via SSO corporativo.'}
          </p>

          <form onSubmit={enviar}>
            <label className="campo">
              <span>{celular ? 'E-mail' : 'E-mail corporativo'}</span>
              <input
                className="campo__controle"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={celular ? 'seu@email.com' : 'nome.sobrenome@avanade.com'}
                autoComplete="username"
                required
              />
            </label>
            <div className="campo">
              <span className="campo__linha">
                <label htmlFor="senha">Senha</label>
                {!celular && (
                  <button type="button" className="link-acao" onClick={esqueciSenha}>
                    Esqueceu sua senha corporativa?
                  </button>
                )}
              </span>
              <span className="campo__com-icone">
                <input
                  id="senha"
                  className="campo__controle"
                  type={verSenha ? 'text' : 'password'}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Digite sua senha"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="campo__acao"
                  aria-label={verSenha ? 'Ocultar senha' : 'Mostrar senha'}
                  onClick={() => setVerSenha(!verSenha)}
                >
                  {verSenha ? <IconeOlhoFechado /> : <IconeOlho />}
                </button>
              </span>
              {celular && (
                <button type="button" className="link-acao login__esqueci" onClick={esqueciSenha}>
                  Esqueceu sua senha corporativa?
                </button>
              )}
            </div>

            {acessoPorEmail && (
              <p className="nota-dev">
                Ambiente de desenvolvimento: a API libera o acesso pelo e-mail e não confere a senha. Contas de demonstração:{' '}
                {usuariosDev.slice(0, 5).map((u, i) => (
                  <span key={u.email}>
                    {i > 0 && ', '}
                    <button type="button" className="link-acao" onClick={() => setEmail(u.email)}>
                      {u.name}
                    </button>
                  </span>
                ))}
                . Um e-mail novo inicia um cadastro.
              </p>
            )}

            {erro && (
              <p className="erro-campo" role="alert">
                {erro}
              </p>
            )}

            <button type="submit" className="botao botao--primario" disabled={entrando || !email.trim()}>
              {entrando ? 'Entrando...' : 'Acessar o Global Connect'} {!celular && <IconeSeta />}
            </button>
            {celular && (
              <button type="button" className="botao botao--suave" onClick={solicitarAcesso}>
                Solicitar acesso interno
              </button>
            )}
          </form>

          <p className="divisor">
            <span>{celular ? 'ou entrar com sua conta corporativa' : 'ou autenticar com SSO corporativo'}</span>
          </p>

          {/* O botão do Google fica sempre no mesmo lugar do DOM: o script do Google o desenha uma vez só. */}
          <div className="login__sso">
            {CLIENT_ID && <div ref={botaoGoogle} className="google-botao" />}
            {!celular && (
              <button type="button" className="botao botao--contorno" onClick={ssoIndisponivel('Microsoft 365')}>
                <IconeMicrosoft /> Entrar com Microsoft 365 (Entra ID)
              </button>
            )}
            <button type="button" className="botao botao--contorno login__linkedin" onClick={ssoIndisponivel('LinkedIn')}>
              <IconeLinkedin /> {celular ? 'LinkedIn' : 'Avanade LinkedIn Corporativo'}
            </button>
            {celular && !CLIENT_ID && (
              <button type="button" className="botao botao--contorno" onClick={ssoIndisponivel('Google')}>
                <IconeGoogle /> Google
              </button>
            )}
          </div>

          {!celular && (
            <p className="login__novo">
              Novo colaborador ou primeiro acesso?{' '}
              <button type="button" className="link-acao" onClick={solicitarAcesso}>
                Solicitar acesso interno
              </button>
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
