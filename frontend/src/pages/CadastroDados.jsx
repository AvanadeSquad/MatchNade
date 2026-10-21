import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconeCadeado,
  IconeCheckCirculo,
  IconeCracha,
  IconeEmail,
  IconeEscudoCheck,
  IconeMaleta,
  IconePino,
  IconePredio,
  IconeSeta,
  IconeTelefone,
} from '../components/Icones.jsx';
import { Cabecalho } from '../components/Basicos.jsx';
import Passos from '../components/Passos.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCelular } from '../hooks/useCelular.js';
import { usePreferencias } from '../hooks/usePreferencias.js';
import { API } from '../services/api.js';
import { AREAS, CIDADE_DO_HUB, HUBS } from '../utils/preferencias.js';

function mascaraTelefone(valor) {
  const d = valor.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function mascaraCep(valor) {
  const d = valor.replace(/\D/g, '').slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

// "São Paulo, SP" <-> ["São Paulo", "SP"]. A API guarda cidade e estado num campo só.
const separarCidade = (texto = '') => {
  const [cidade, ...resto] = texto.split(',');
  return [cidade.trim(), resto.join(',').trim()];
};
const juntarCidade = (cidade, uf) => [cidade.trim(), uf.trim().toUpperCase()].filter(Boolean).join(', ');

// Campo com ícone à esquerda, no estilo do cadastro.
function Campo({ rotulo, extra, Icone, children }) {
  return (
    <label className="campo">
      <span className="campo__linha">
        <span>{rotulo}</span>
        {extra}
      </span>
      <span className="campo__com-icone campo__com-icone--esquerda">
        <Icone className="campo__icone" />
        {children}
      </span>
    </label>
  );
}

// Etapa 1 do cadastro: nome, unidade e cidade vão para a API; telefone, hub e CEP ficam nas preferências locais.
export default function CadastroDados() {
  const { perfil, definirPerfil, sair } = useAuth();
  const [preferencias, atualizarPreferencias] = usePreferencias();
  const navegar = useNavigate();
  const [dados, setDados] = useState({
    nome: perfil.name ?? '',
    unidade: perfil.department ?? '',
    cidade: perfil.location ?? '',
    telefone: preferencias.telefone,
    hub: preferencias.hub,
    cep: preferencias.cep,
    emailPessoal: preferencias.emailPessoal,
  });
  const celular = useCelular();
  const [parte, setParte] = useState(1);
  const [aceite, setAceite] = useState(perfil.profile_complete);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const mudar = (campo) => (e) => setDados({ ...dados, [campo]: e.target.value });

  function escolherHub(e) {
    const hub = e.target.value;
    setDados({ ...dados, hub, cidade: dados.cidade || CIDADE_DO_HUB[hub] || '' });
  }

  async function enviar(evento) {
    evento.preventDefault();
    setErro('');
    setSalvando(true);
    try {
      definirPerfil(await API.atualizarPerfil({ name: dados.nome, department: dados.unidade, location: dados.cidade }));
    } catch (e) {
      setErro(e.message);
      setSalvando(false);
      return;
    }
    atualizarPreferencias({ telefone: dados.telefone, hub: dados.hub, cep: dados.cep, emailPessoal: dados.emailPessoal });
    navegar('/cadastro/interesses');
  }

  function cancelar() {
    sair();
    navegar('/login', { replace: true });
  }

  // Celular: a etapa é dividida em duas telas, dados pessoais e dados da unidade.
  if (celular) {
    const [nomeCidade, uf] = separarCidade(dados.cidade);
    const mudarCidade = (nova, novoUf) => setDados({ ...dados, cidade: juntarCidade(nova, novoUf) });
    const telefone = (e) => setDados({ ...dados, telefone: mascaraTelefone(e.target.value) });
    const cep = (e) => setDados({ ...dados, cep: mascaraCep(e.target.value) });

    if (parte === 1) {
      return (
        <main className="cadastro">
          <header className="cadastro__cabecalho">
            <h1>Conecte-se à rede Avanade</h1>
            <p className="subtitulo">Preencha seus dados para se conectar com outros colaboradores da Avanade.</p>
          </header>
          <form
            className="formulario"
            onSubmit={(e) => {
              e.preventDefault();
              setParte(2);
            }}
          >
            <label className="campo">
              <span>Nome completo (como aparece no crachá)</span>
              <input
                className="campo__controle"
                value={dados.nome}
                onChange={mudar('nome')}
                placeholder="Ex: Ana Silva"
                required
                minLength={2}
                maxLength={120}
                autoComplete="name"
              />
            </label>
            <label className="campo">
              <span className="campo__linha">
                <span>E-mail corporativo</span>
                <span className="campo__dica campo__dica--ok">
                  <IconeCheckCirculo /> Verificado
                </span>
              </span>
              <input className="campo__controle" value={perfil.email} readOnly aria-readonly="true" />
            </label>
            <label className="campo">
              <span>E-mail pessoal (opcional)</span>
              <input
                className="campo__controle"
                type="email"
                value={dados.emailPessoal}
                onChange={mudar('emailPessoal')}
                placeholder="seu@email.com"
                autoComplete="email"
              />
            </label>
            <label className="campo">
              <span>Telefone (para conexões internas)</span>
              <input
                className="campo__controle"
                value={dados.telefone}
                onChange={telefone}
                placeholder="(11) 99999-9999"
                inputMode="tel"
                autoComplete="tel"
              />
            </label>
            <label className="campo">
              <span>CEP (para localização da unidade)</span>
              <input
                className="campo__controle"
                value={dados.cep}
                onChange={cep}
                placeholder="00000-000"
                inputMode="numeric"
                autoComplete="postal-code"
              />
            </label>
            <div className="campo-duplo">
              <label className="campo">
                <span>Cidade</span>
                <input
                  className="campo__controle"
                  value={nomeCidade}
                  onChange={(e) => mudarCidade(e.target.value, uf)}
                  placeholder="São Paulo"
                  required
                  maxLength={70}
                  autoComplete="address-level2"
                />
              </label>
              <label className="campo">
                <span>Estado</span>
                <input
                  className="campo__controle"
                  value={uf}
                  onChange={(e) => mudarCidade(nomeCidade, e.target.value.slice(0, 2))}
                  placeholder="SP"
                  maxLength={2}
                  autoComplete="address-level1"
                />
              </label>
            </div>
            <label className="marcar">
              <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} required />
              <span>
                Li e concordo com os <strong className="destaque-roxo">Termos de Uso</strong> e{' '}
                <strong className="destaque-roxo">Privacidade</strong>.
              </span>
            </label>
            <button type="submit" className="botao botao--primario" disabled={!aceite}>
              Conectar-se
            </button>
            <button type="button" className="botao botao--texto" onClick={cancelar}>
              Entrei com a conta errada: sair
            </button>
          </form>
        </main>
      );
    }

    return (
      <main className="cadastro">
        <Cabecalho titulo="Conexão Avanade" aoVoltar={() => setParte(1)} />
        <header className="cadastro__cabecalho">
          <h1>Dados da unidade</h1>
          <p className="subtitulo">Preencha os dados da sua unidade e localidade para continuar.</p>
        </header>
        <form className="formulario" onSubmit={enviar}>
          <label className="campo">
            <span>Unidade</span>
            <select className="campo__controle" value={dados.hub} onChange={escolherHub}>
              <option value="">Ex.: Avanade São Paulo</option>
              {HUBS.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </label>
          <label className="campo">
            <span>Área de atuação (unidade de negócio)</span>
            <input
              className="campo__controle"
              value={dados.unidade}
              onChange={mudar('unidade')}
              placeholder="Ex.: Experience Design"
              list="areas-avanade-celular"
              required
              maxLength={80}
            />
            <datalist id="areas-avanade-celular">
              {AREAS.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </label>
          <label className="campo">
            <span>Localidade</span>
            <input
              className="campo__controle"
              value={dados.cidade}
              onChange={mudar('cidade')}
              placeholder="Ex.: São Paulo, SP"
              required
              maxLength={80}
            />
          </label>
          <label className="campo">
            <span>CEP corporativo</span>
            <input className="campo__controle" value={dados.cep} onChange={cep} placeholder="00000-000" inputMode="numeric" />
          </label>
          <p className="nota">A unidade e a cidade aparecem no seu cartão. Telefone, e-mail pessoal, hub e CEP ficam só neste aparelho.</p>
          {erro && (
            <p className="erro-campo" role="alert">
              {erro}
            </p>
          )}
          <button type="submit" className="botao botao--primario" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Continuar'}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="cadastro">
      <Passos atual={1} />

      <header className="cadastro__cabecalho cadastro__cabecalho--centro">
        <span className="selo-ponto">Avanade Global Connect</span>
        <h1>Conecte-se à rede Avanade</h1>
        <p className="subtitulo">
          Confirme seus dados profissionais para viabilizar conexões autênticas com colegas de squads, comunidades e unidades ao redor do
          mundo.
        </p>
      </header>

      <form className="cartao cadastro__form" onSubmit={enviar}>
        <div className="grade-2">
          <fieldset className="grupo">
            <legend>
              <strong>Perfil do Colaborador</strong>
              <span>Informações da sua conta corporativa</span>
            </legend>
            <Campo rotulo="Nome completo (crachá)" extra={<span className="campo__dica">Obrigatório</span>} Icone={IconeCracha}>
              <input
                className="campo__controle"
                value={dados.nome}
                onChange={mudar('nome')}
                placeholder="Ex.: Ana Silva"
                required
                minLength={2}
                maxLength={120}
                autoComplete="name"
              />
            </Campo>
            <Campo
              rotulo="E-mail corporativo"
              extra={
                <span className="campo__dica campo__dica--ok">
                  <IconeCheckCirculo /> Verificado
                </span>
              }
              Icone={IconeEmail}
            >
              <input className="campo__controle" value={perfil.email} readOnly aria-readonly="true" />
            </Campo>
            <Campo rotulo="Telefone interno / Teams" extra={<span className="campo__dica">Opcional</span>} Icone={IconeTelefone}>
              <input
                className="campo__controle"
                value={dados.telefone}
                onChange={(e) => setDados({ ...dados, telefone: mascaraTelefone(e.target.value) })}
                placeholder="(11) 98765-4321"
                inputMode="tel"
                autoComplete="tel"
              />
            </Campo>
            <Campo rotulo="Unidade de negócio / prática" extra={<span className="campo__dica">Obrigatório</span>} Icone={IconeMaleta}>
              <input
                className="campo__controle"
                value={dados.unidade}
                onChange={mudar('unidade')}
                placeholder="Ex.: Experience Design"
                list="areas-avanade"
                required
                maxLength={80}
              />
              <datalist id="areas-avanade">
                {AREAS.map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
            </Campo>
          </fieldset>

          <fieldset className="grupo">
            <legend>
              <strong>Hub & Localidade</strong>
              <span>Sua base física de trabalho ou referência</span>
            </legend>
            <Campo rotulo="Unidade / Hub Avanade" Icone={IconePredio}>
              <select className="campo__controle" value={dados.hub} onChange={escolherHub}>
                <option value="">Selecione seu hub</option>
                {HUBS.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Cidade / Estado" extra={<span className="campo__dica">Obrigatório</span>} Icone={IconePino}>
              <input
                className="campo__controle"
                value={dados.cidade}
                onChange={mudar('cidade')}
                placeholder="Ex.: São Paulo"
                required
                maxLength={80}
                autoComplete="address-level2"
              />
            </Campo>
            <Campo rotulo="Localidade / CEP corporativo" extra={<span className="campo__dica">Opcional</span>} Icone={IconePredio}>
              <input
                className="campo__controle"
                value={dados.cep}
                onChange={(e) => setDados({ ...dados, cep: mascaraCep(e.target.value) })}
                placeholder="04711-130"
                inputMode="numeric"
                autoComplete="postal-code"
              />
            </Campo>
            <p className="nota">
              A cidade aparece no seu cartão de descoberta. Telefone, hub e CEP ficam só neste navegador e não são compartilhados.
            </p>
          </fieldset>
        </div>

        {erro && (
          <p className="erro-campo" role="alert">
            {erro}
          </p>
        )}

        <div className="cadastro__acoes">
          <label className="marcar">
            <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} required />
            <span>
              Concordo com os <strong className="destaque">Termos de Convivência</strong> e a Governança do Avanade Connect.
            </span>
          </label>
          <div className="cadastro__botoes">
            <button type="button" className="botao botao--texto botao--auto" onClick={cancelar}>
              Cancelar
            </button>
            <button type="submit" className="botao botao--primario botao--auto" disabled={salvando || !aceite}>
              {salvando ? 'Salvando...' : 'Continuar para Interesses'} <IconeSeta />
            </button>
          </div>
        </div>
      </form>

      <p className="cadastro__garantias">
        <span>
          <IconeEscudoCheck /> Sessão corporativa autenticada
        </span>
        <span aria-hidden="true">•</span>
        <span>
          <IconeCadeado /> Você pode excluir seus dados a qualquer momento
        </span>
      </p>
    </main>
  );
}
