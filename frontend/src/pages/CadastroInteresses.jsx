import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Carregando, Erro } from '../components/Basicos.jsx';
import { Anel } from '../components/Controles.jsx';
import {
  IconeAlvo,
  IconeBrilho,
  IconeCheck,
  IconeCheckCirculo,
  IconeDocumento,
  IconeLampada,
  IconeSeta,
  IconeUpload,
  IconeVoltar,
} from '../components/Icones.jsx';
import Passos from '../components/Passos.jsx';
import SeletorTags from '../components/SeletorTags.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useAviso } from '../context/Avisos.jsx';
import { useCarregar } from '../hooks/useCarregar.js';
import { useCelular } from '../hooks/useCelular.js';
import { API } from '../services/api.js';
import { listaEmTexto } from '../utils/formatar.js';
import { LIMITE_ANALISE, LIMITE_BIO, analisarComIA, lerArquivoDeTexto } from '../utils/importacao.js';
import { PROPOSITOS, propositoDosObjetivos } from '../utils/objetivos.js';
import CadastroInteressesCelular from './CadastroInteressesCelular.jsx';

export const MINIMO = 3;

// Interesses já salvos no perfil, no formato da seleção.
function selecaoInicial(perfil) {
  const itens = [
    ...perfil.tags.technical.map((t) => ({ nome: t.name, fonte: t.source, categoria: 'TECHNICAL' })),
    ...perfil.tags.hobby.map((t) => ({ nome: t.name, fonte: t.source, categoria: 'HOBBY' })),
  ];
  return new Map(itens.map((t) => [t.nome.toLowerCase(), t]));
}

// Calibragem do perfil: cresce com a quantidade de interesses e com a presença dos dois tipos.
function calibragem(selecionadas) {
  const lista = [...selecionadas.values()];
  const tecnicas = lista.filter((t) => t.categoria === 'TECHNICAL').length;
  const hobbies = lista.length - tecnicas;
  if (!lista.length) return 0;
  return Math.min(98, 20 + Math.min(tecnicas, 6) * 8 + Math.min(hobbies, 5) * 6 + (tecnicas && hobbies ? 6 : 0));
}

// Importação com IA: o texto (colado ou de um arquivo .txt) vai para a análise de bio da API,
// que devolve skills e hobbies. A IA nunca bloqueia: se falhar, a pessoa escolhe manualmente.
function ImportacaoIA({ bioInicial, aoReceberTags }) {
  const { definirPerfil } = useAuth();
  const [texto, setTexto] = useState(bioInicial ?? '');
  const [usarComoBio, setUsarComoBio] = useState(!bioInicial);
  const [arrastando, setArrastando] = useState(false);
  const [analisando, setAnalisando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState('');
  const arquivo = useRef(null);

  async function lerArquivo(lista) {
    const escolhido = lista?.[0];
    if (!escolhido) return;
    setErro('');
    try {
      const conteudo = await lerArquivoDeTexto(escolhido);
      setTexto(conteudo);
      setUsarComoBio(conteudo.length <= LIMITE_BIO);
    } catch (e) {
      setErro(e.message);
    }
  }

  async function analisar() {
    setErro('');
    setAnalisando(true);
    setResultado(null);
    try {
      const r = await analisarComIA({ texto, usarComoBio, definirPerfil });
      if (!r.falhou) aoReceberTags(r.tecnicas, r.hobbies);
      setResultado(r);
    } catch (e) {
      setErro(e.message);
    } finally {
      setAnalisando(false);
    }
  }

  return (
    <section className="cartao bloco">
      <div className="bloco__topo">
        <div>
          <p className="sobretitulo">
            Acelerador inteligente <span className="pilula pilula--verde">Opcional</span>
          </p>
          <h2>Importação Inteligente com IA</h2>
          <p className="pequeno">Extraia competências automaticamente a partir de um resumo do seu perfil ou currículo.</p>
        </div>
        <span className="bloco__icone">
          <IconeDocumento />
        </span>
      </div>

      <div
        className={`soltar${arrastando ? ' soltar--ativo' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastando(false);
          lerArquivo(e.dataTransfer.files);
        }}
      >
        <span className="soltar__icone">
          <IconeUpload />
        </span>
        <strong>Arraste um arquivo de texto ou cole seu resumo</strong>
        <span className="pequeno">Arquivos .txt ou .md (máx. 10 MB). Para PDF ou DOCX, cole o texto.</span>
        <button type="button" className="link-acao" onClick={() => arquivo.current?.click()}>
          Escolher arquivo
        </button>
        <input
          ref={arquivo}
          type="file"
          accept=".txt,.md,text/plain,text/markdown"
          className="so-leitor"
          tabIndex={-1}
          onChange={(e) => lerArquivo(e.target.files)}
        />
        <label className="so-leitor" htmlFor="texto-ia">
          Resumo para análise
        </label>
        <textarea
          id="texto-ia"
          className="campo__controle soltar__texto"
          rows={4}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          maxLength={LIMITE_ANALISE}
          placeholder="Ex.: Sou designer de UX há 4 anos, trabalho com Figma e design systems. Fora do trabalho corro e jogo jogos de tabuleiro."
        />
        <label className="marcar marcar--pequeno">
          <input type="checkbox" checked={usarComoBio} onChange={(e) => setUsarComoBio(e.target.checked)} />
          <span>Usar este texto como meu resumo profissional (primeiros {LIMITE_BIO} caracteres)</span>
        </label>
        <button type="button" className="botao botao--suave botao--auto" onClick={analisar} disabled={analisando}>
          <IconeBrilho /> {analisando ? 'Analisando...' : 'Analisar com IA'}
        </button>
      </div>

      {erro && (
        <p className="erro-campo" role="alert">
          {erro}
        </p>
      )}

      {analisando && (
        <div className="feedback-ia" role="status">
          <p className="feedback-ia__titulo">
            <span className="giro giro--pequeno" aria-hidden="true" /> Lendo seu perfil e identificando skills e hobbies...
          </p>
        </div>
      )}

      {resultado?.falhou && (
        <div className="feedback-ia feedback-ia--alerta" role="status">
          <p className="feedback-ia__titulo">Não conseguimos analisar agora</p>
          <p className="pequeno">Sem problema: escolha seus interesses ao lado em poucos cliques.</p>
        </div>
      )}

      {resultado?.total > 0 && (
        <div className="feedback-ia" role="status">
          <div className="feedback-ia__topo">
            <p className="feedback-ia__titulo">
              <IconeCheckCirculo /> Feedback em tempo real da IA
            </p>
            <span className="rotulo rotulo--verde">Perfil sincronizado</span>
          </div>
          <div className="feedback-ia__itens">
            <span>
              <IconeCheck /> Leitura de perfil
            </span>
            <span>
              <IconeCheck /> Interesses mapeados ({resultado.total})
            </span>
          </div>
          <p className="pequeno">
            <IconeLampada /> Sugestão da IA: adicionamos{' '}
            <strong>{listaEmTexto([...resultado.tecnicas, ...resultado.hobbies].slice(0, 4))}</strong> com base no seu texto. Revise ao
            lado.
          </p>
        </div>
      )}
    </section>
  );
}

// Etapa 2 do cadastro: propósito de rede (objetivos), interesses profissionais e pessoais e importação com IA.
export default function CadastroInteresses() {
  const { perfil, definirPerfil } = useAuth();
  const avisar = useAviso();
  const navegar = useNavigate();
  const [params] = useSearchParams();
  const editando = params.get('de') === 'eu';
  const catalogo = useCarregar(() => API.tags(), []);
  const propositoInicial = useRef(propositoDosObjetivos(perfil.connection_goals));
  const [proposito, setProposito] = useState(propositoInicial.current);
  const [selecionadas, setSelecionadas] = useState(() => selecaoInicial(perfil));
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const celular = useCelular();

  const alternar = (nome, categoria) =>
    setSelecionadas((atual) => {
      const copia = new Map(atual);
      const chave = nome.toLowerCase();
      if (copia.has(chave)) copia.delete(chave);
      else copia.set(chave, { nome, categoria, fonte: 'MANUAL' });
      return copia;
    });

  async function criarTag(nome, categoria) {
    const tag = await API.criarTag(nome, categoria);
    setSelecionadas((atual) => new Map(atual).set(tag.name.toLowerCase(), { nome: tag.name, categoria: tag.category, fonte: 'MANUAL' }));
  }

  function receberDaIA(tecnicas, hobbies) {
    setSelecionadas((atual) => {
      const copia = new Map(atual);
      for (const nome of tecnicas)
        if (!copia.has(nome.toLowerCase())) copia.set(nome.toLowerCase(), { nome, categoria: 'TECHNICAL', fonte: 'AI' });
      for (const nome of hobbies)
        if (!copia.has(nome.toLowerCase())) copia.set(nome.toLowerCase(), { nome, categoria: 'HOBBY', fonte: 'AI' });
      return copia;
    });
  }

  // Grava interesses e objetivos na API. Devolve true quando deu certo.
  async function gravar() {
    setErro('');
    setSalvando(true);
    try {
      const interests = [...selecionadas.values()].map((t) => ({
        name: t.nome,
        category: t.categoria,
        source: t.fonte === 'AI' ? 'AI' : 'MANUAL',
      }));
      let atualizado = await API.salvarInteresses(interests);
      // O propósito só substitui os objetivos quando a pessoa o mudou ou ainda não tinha nenhum.
      if (proposito !== propositoInicial.current || !perfil.connection_goals.length) {
        const objetivos = PROPOSITOS.find((p) => p.id === proposito).objetivos;
        atualizado = await API.atualizarPerfil({ connection_goals: objetivos });
      }
      definirPerfil(atualizado);
    } catch (e) {
      setErro(e.message);
      setSalvando(false);
      return false;
    }
    setSalvando(false);
    avisar('Interesses salvos.');
    return true;
  }

  async function salvar() {
    if (await gravar()) navegar(editando ? '/eu' : '/cadastro/preferencias');
  }

  if (catalogo.carregando)
    return (
      <main className="cadastro">
        <Carregando texto="Carregando interesses..." />
      </main>
    );
  if (catalogo.erro)
    return (
      <main className="cadastro">
        <Erro erro={catalogo.erro} aoTentarDeNovo={catalogo.recarregar} />
      </main>
    );

  const tags = catalogo.dados.tags;
  const doTipo = (categoria) => tags.filter((t) => t.category === categoria).map((t) => t.name);
  const usoPorNome = new Map(tags.map((t) => [t.name.toLowerCase(), t.uso ?? 0]));
  const lista = [...selecionadas.values()];
  const qtdTecnicas = lista.filter((t) => t.categoria === 'TECHNICAL').length;
  const qtdHobbies = lista.length - qtdTecnicas;
  const ocorrencias = lista.reduce((soma, t) => soma + (usoPorNome.get(t.nome.toLowerCase()) ?? 0), 0);
  const faltam = Math.max(0, MINIMO - lista.length);

  if (celular) {
    return (
      <CadastroInteressesCelular
        catalogo={tags}
        proposito={proposito}
        aoMudarProposito={setProposito}
        selecionadas={selecionadas}
        aoAlternar={alternar}
        aoCriarTag={criarTag}
        aoReceberDaIA={receberDaIA}
        aoGravar={gravar}
        salvando={salvando}
        erro={erro}
        editando={editando}
        minimo={MINIMO}
      />
    );
  }

  return (
    <main className="cadastro cadastro--largo">
      {!editando && <Passos atual={2} />}

      <header className="cadastro__cabecalho">
        <span className="selo-ponto selo-ponto--suave">
          <IconeBrilho /> Mapeamento dinâmico de afinidades
        </span>
        <h1>Quais são os seus interesses e objetivos?</h1>
        <p className="subtitulo">O algoritmo cruza afinidades técnicas e humanas para sugerir colegas ideais.</p>
      </header>

      <div className="grade-2 grade-2--topo">
        <div className="coluna">
          <section className="cartao bloco">
            <div className="bloco__topo">
              <div>
                <p className="sobretitulo">Propósito de rede</p>
                <h2 id="proposito-titulo">Qual o seu objetivo principal de conexão?</h2>
              </div>
              <span className="bloco__icone bloco__icone--simples">
                <IconeAlvo />
              </span>
            </div>
            <div className="opcoes" role="radiogroup" aria-labelledby="proposito-titulo">
              {PROPOSITOS.map((p) => (
                <label key={p.id} className={`opcao${proposito === p.id ? ' opcao--ativa' : ''}`}>
                  <input type="radio" name="proposito" value={p.id} checked={proposito === p.id} onChange={() => setProposito(p.id)} />
                  <span>
                    <strong>
                      {p.titulo} {p.recomendado && <span className="pilula pilula--laranja">Recomendado</span>}
                    </strong>
                    <span className="pequeno">{p.descricao}</span>
                  </span>
                </label>
              ))}
            </div>
          </section>

          <ImportacaoIA bioInicial={perfil.bio} aoReceberTags={receberDaIA} />
        </div>

        <div className="coluna">
          <section className="cartao bloco">
            <div className="bloco__topo">
              <div>
                <p className="sobretitulo">Hard skills & disciplinas</p>
                <h2>Interesses Profissionais</h2>
              </div>
              <span className="pilula pilula--cinza">{qtdTecnicas} selecionados</span>
            </div>
            <p className="pequeno">Selecione as frentes de especialidade que você domina ou gostaria de discutir:</p>
            <SeletorTags
              categoria="TECHNICAL"
              catalogo={doTipo('TECHNICAL')}
              selecionadas={selecionadas}
              aoAlternar={alternar}
              aoCriar={criarTag}
            />

            <hr className="separador" />

            <div className="bloco__topo">
              <div>
                <p className="sobretitulo sobretitulo--verde">Afinidade humana</p>
                <h2>Interesses Pessoais / Quebra-Gelo</h2>
              </div>
              <span className="pilula pilula--cinza">{qtdHobbies} selecionados</span>
            </div>
            <p className="pequeno">Tópicos de vida real para transformar bate-papos virtuais em pontes de amizade:</p>
            <SeletorTags
              categoria="HOBBY"
              catalogo={doTipo('HOBBY')}
              selecionadas={selecionadas}
              aoAlternar={alternar}
              aoCriar={criarTag}
              tom="pessego"
            />

            <div className="indice">
              <Anel valor={calibragem(selecionadas)} />
              <div>
                <strong>Índice de calibragem</strong>
                <p className="pequeno">
                  {lista.length
                    ? `Seus interesses aparecem ${ocorrencias} vezes em perfis de colegas. Misturar skills e hobbies melhora as sugestões.`
                    : 'Escolha interesses para calibrar suas sugestões.'}
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>

      {erro && (
        <p className="erro-campo" role="alert">
          {erro}
        </p>
      )}

      <div className="barra-final cartao">
        <button type="button" className="botao botao--cinza botao--auto" onClick={() => navegar(editando ? '/eu' : '/cadastro/dados')}>
          <IconeVoltar /> Voltar
        </button>
        <p className="pequeno" aria-live="polite">
          {faltam > 0
            ? `Escolha mais ${faltam} ${faltam === 1 ? 'interesse' : 'interesses'} (mínimo de ${MINIMO})`
            : `${lista.length} interesses selecionados`}
        </p>
        <button type="button" className="botao botao--primario botao--auto" disabled={faltam > 0 || salvando} onClick={salvar}>
          {salvando ? 'Salvando...' : editando ? 'Salvar interesses' : 'Salvar e Ver Preferências'} <IconeSeta />
        </button>
      </div>
    </main>
  );
}
