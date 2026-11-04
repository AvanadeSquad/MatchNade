import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { IconeCheckCirculo, IconeGoogle, IconeMicrosoft, IconeSeta } from '../components/Icones.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useAviso } from '../context/Avisos.jsx';
import { useCelular } from '../hooks/useCelular.js';
import { API } from '../services/api.js';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const SCRIPT_GOOGLE = 'https://accounts.google.com/gsi/client';

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

const destinoDepoisDoLogin = (perfil) => (perfil.profile_complete ? '/descobrir' : '/cadastro/dados');
const mensagemDeErro = (erro) =>
  erro.code === 'EMAIL_NAO_LIBERADO' ? 'Seu e-mail ainda não está liberado. Fale com quem administra o Avanade Connect.' : erro.message;

export default function Login() {
  const { token, perfil, entrar } = useAuth();
  const avisar = useAviso();
  const navegar = useNavigate();
  const botaoGoogle = useRef(null);
  const concluirAtual = useRef(null);
  const [modo, setModo] = useState('login'); // login | cadastro | recuperar | redefinir
  const [email, setEmail] = useState('');
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [perguntas, setPerguntas] = useState([]);
  const [perguntaId, setPerguntaId] = useState('');
  const [respostaSeguranca, setRespostaSeguranca] = useState('');
  const [perguntaRecuperacao, setPerguntaRecuperacao] = useState('');
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const celular = useCelular();

  function concluir(resposta) {
    entrar(resposta.token, resposta.employee);
    navegar(destinoDepoisDoLogin(resposta.employee), { replace: true });
  }
  useLayoutEffect(() => {
    concluirAtual.current = concluir;
  });

  useEffect(() => {
    API.perguntasSeguranca()
      .then(({ questions }) => setPerguntas(questions))
      .catch(() => setPerguntas([]));
  }, []);

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
        if (botaoGoogle.current)
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

  async function enviar(evento) {
    evento.preventDefault();
    setErro('');
    setSucesso('');
    setOcupado(true);
    try {
      if (modo === 'login') {
        concluir(await API.loginSenha(email.trim(), senha));
      } else if (modo === 'cadastro') {
        if (senha !== confirmarSenha) throw new Error('As senhas não coincidem.');
        concluir(
          await API.cadastrar({
            name: nome.trim(),
            email: email.trim().toLowerCase(),
            password: senha,
            security_question_id: perguntaId,
            security_answer: respostaSeguranca.trim(),
          }),
        );
      } else if (modo === 'recuperar') {
        const resultado = await API.perguntaRecuperacao(email.trim().toLowerCase());
        if (!resultado.available || !resultado.question)
          throw new Error('Não foi possível iniciar a recuperação. Confira o e-mail ou fale com o administrador.');
        setPerguntaRecuperacao(resultado.question);
        setModo('redefinir');
        setSucesso('Responda à pergunta de segurança para definir uma nova senha.');
      } else {
        if (senha !== confirmarSenha) throw new Error('As senhas não coincidem.');
        await API.redefinirSenha(email.trim().toLowerCase(), respostaSeguranca.trim(), senha);
        setModo('login');
        setSenha('');
        setConfirmarSenha('');
        setRespostaSeguranca('');
        setPerguntaRecuperacao('');
        setSucesso('Senha redefinida. Entre com sua nova senha.');
      }
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setOcupado(false);
    }
  }

  function trocarModo(novoModo) {
    setModo(novoModo);
    setErro('');
    setSucesso('');
    setSenha('');
    setConfirmarSenha('');
    setRespostaSeguranca('');
  }

  const ssoIndisponivel = (provedor) => () => avisar(`O SSO ${provedor} ainda precisa ser configurado na API e no ambiente.`, 'info');
  if (token && perfil) return <Navigate to={destinoDepoisDoLogin(perfil)} replace />;

  const titulo =
    modo === 'cadastro'
      ? 'Criar sua conta'
      : modo === 'recuperar'
        ? 'Recuperar senha'
        : modo === 'redefinir'
          ? 'Redefinir senha'
          : celular
            ? 'Bem-vindo ao Global Connect'
            : 'Acesse sua conta';
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
          <h2>{titulo}</h2>
          <p className="subtitulo">
            {modo === 'cadastro'
              ? 'Crie suas credenciais e configure a recuperação de senha.'
              : modo.startsWith('recuper') || modo === 'redefinir'
                ? 'Recupere o acesso usando sua pergunta de segurança.'
                : 'Entre com seu e-mail corporativo e senha ou use o SSO corporativo.'}
          </p>
          <form onSubmit={enviar}>
            {modo === 'cadastro' && (
              <label className="campo">
                <span>Nome completo</span>
                <input
                  className="campo__controle"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  autoComplete="name"
                  required
                  minLength={2}
                />
              </label>
            )}
            <label className="campo">
              <span>E-mail corporativo</span>
              <input
                className="campo__controle"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome.sobrenome@avanade.com"
                autoComplete="username"
                required
              />
            </label>
            {(modo === 'login' || modo === 'cadastro' || modo === 'redefinir') && (
              <label className="campo">
                <span>{modo === 'redefinir' ? 'Nova senha' : 'Senha'}</span>
                <input
                  className="campo__controle"
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
                  minLength={10}
                  maxLength={128}
                  required
                />
              </label>
            )}
            {(modo === 'cadastro' || modo === 'redefinir') && (
              <label className="campo">
                <span>Confirmar senha</span>
                <input
                  className="campo__controle"
                  type="password"
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  autoComplete="new-password"
                  minLength={10}
                  required
                />
              </label>
            )}
            {modo === 'cadastro' && (
              <>
                <label className="campo">
                  <span>Pergunta de segurança</span>
                  <select className="campo__controle" value={perguntaId} onChange={(e) => setPerguntaId(e.target.value)} required>
                    <option value="">Selecione uma pergunta</option>
                    {perguntas.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.pergunta}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="campo">
                  <span>Resposta de segurança</span>
                  <input
                    className="campo__controle"
                    value={respostaSeguranca}
                    onChange={(e) => setRespostaSeguranca(e.target.value)}
                    autoComplete="off"
                    minLength={2}
                    maxLength={200}
                    required
                  />
                </label>
                <p className="nota-dev">Guarde a resposta. Ela será usada para recuperar sua senha.</p>
              </>
            )}
            {modo === 'redefinir' && (
              <>
                <p className="nota-dev">{perguntaRecuperacao}</p>
                <label className="campo">
                  <span>Resposta de segurança</span>
                  <input
                    className="campo__controle"
                    value={respostaSeguranca}
                    onChange={(e) => setRespostaSeguranca(e.target.value)}
                    autoComplete="off"
                    required
                  />
                </label>
              </>
            )}
            {erro && (
              <p className="erro-campo" role="alert">
                {erro}
              </p>
            )}
            {sucesso && (
              <p role="status" className="nota-dev">
                {sucesso}
              </p>
            )}
            <button type="submit" className="botao botao--primario" disabled={ocupado || (modo === 'cadastro' && perguntas.length === 0)}>
              {ocupado
                ? 'Aguarde...'
                : modo === 'login'
                  ? 'Entrar'
                  : modo === 'cadastro'
                    ? 'Criar conta'
                    : modo === 'recuperar'
                      ? 'Continuar'
                      : 'Redefinir senha'}{' '}
              {!celular && <IconeSeta />}
            </button>
          </form>
          <div className="login__novo">
            {modo === 'login' && (
              <>
                <button type="button" className="link-acao" onClick={() => trocarModo('recuperar')}>
                  Esqueci minha senha
                </button>
                <span> · </span>
                <button type="button" className="link-acao" onClick={() => trocarModo('cadastro')}>
                  Criar conta
                </button>
              </>
            )}
            {modo !== 'login' && (
              <button type="button" className="link-acao" onClick={() => trocarModo('login')}>
                Voltar para login
              </button>
            )}
            {modo === 'recuperar' && <p className="nota-dev">Digite seu e-mail e avance para consultar a pergunta de segurança.</p>}
          </div>
          {modo === 'login' && (
            <>
              <p className="divisor">
                <span>ou autenticar com SSO corporativo</span>
              </p>
              <div className="login__sso">
                {CLIENT_ID && <div ref={botaoGoogle} className="google-botao" />}
                <button type="button" className="botao botao--contorno" onClick={ssoIndisponivel('Microsoft Entra ID')}>
                  <IconeMicrosoft /> Entrar com Microsoft corporativo
                </button>
                {!CLIENT_ID && (
                  <button type="button" className="botao botao--contorno" onClick={ssoIndisponivel('Google')}>
                    <IconeGoogle /> Google corporativo
                  </button>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
