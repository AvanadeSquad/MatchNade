import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar, Cabecalho } from '../components/Basicos.jsx';
import { Equilibrio, Polos, Segmentado } from '../components/Controles.jsx';
import { EditarBio, PreviewPublico, preenchimento } from '../components/EdicaoPerfil.jsx';
import {
  IconeAjustes,
  IconeEditar,
  IconeEscudoCheck,
  IconeGlobo,
  IconePino,
  IconePredio,
  IconeSeta,
  IconeSomar,
  IconeSubtrair,
  IconeVerificado,
  IconeVoltar,
} from '../components/Icones.jsx';
import Passos from '../components/Passos.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useAviso } from '../context/Avisos.jsx';
import { useCelular } from '../hooks/useCelular.js';
import { usePreferencias } from '../hooks/usePreferencias.js';
import { API } from '../services/api.js';
import { ALCANCES } from '../utils/preferencias.js';

const ICONES_ALCANCE = { LOCAL: IconePredio, REGIONAL: IconePino, CONTINENTAL: IconeGlobo };

// Etapa 3 do cadastro: resumo do perfil e parâmetros de match. Equilíbrio, alcance e polos ficam nas
// preferências locais (usadas para ordenar e filtrar a descoberta); a cota semanal vai para a API.
export default function CadastroPreferencias() {
  const { perfil, definirPerfil } = useAuth();
  const avisar = useAviso();
  const navegar = useNavigate();
  const [preferencias, atualizarPreferencias] = usePreferencias();
  const [peso, setPeso] = useState(preferencias.pesoProfissional);
  const [alcance, setAlcance] = useState(preferencias.alcance);
  const [polos, setPolos] = useState(preferencias.polos.length ? preferencias.polos : preferencias.hub ? [preferencias.hub] : []);
  const [cota, setCota] = useState(perfil.max_weekly_matches);
  const [dialogo, setDialogo] = useState(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const celular = useCelular();

  async function salvar() {
    setErro('');
    if (!perfil.profile_complete) {
      setErro('Antes de acessar a plataforma, conclua as etapas anteriores: unidade, 3 interesses e um objetivo.');
      return;
    }
    setSalvando(true);
    try {
      if (cota !== perfil.max_weekly_matches) definirPerfil(await API.atualizarPerfil({ max_weekly_matches: cota }));
    } catch (e) {
      setErro(e.message);
      setSalvando(false);
      return;
    }
    atualizarPreferencias({ pesoProfissional: peso, alcance, polos, configurado: true });
    avisar('Tudo pronto! Veja quem tem a ver com você.');
    navegar('/descobrir', { replace: true });
  }

  const pct = preenchimento(perfil);

  // Celular: só os parâmetros, cada um no seu cartão (o resumo do perfil já foi revisado na etapa anterior).
  if (celular) {
    return (
      <main className="cadastro">
        <Cabecalho titulo="O que você quer priorizar nas suas conexões?" aoVoltar={() => navegar('/cadastro/interesses')} />
        <section className="cartao bloco">
          <h2 className="titulo-laranja">Prioridade</h2>
          <div className="equilibrio__extremos" aria-hidden="true">
            <span>Interesses profissionais</span>
            <span>Interesses pessoais</span>
          </div>
          <Equilibrio valor={peso} aoMudar={setPeso} compacto />
        </section>
        <section className="cartao bloco">
          <h2 className="titulo-laranja">Alcance geográfico</h2>
          <Segmentado
            rotulo="Alcance geográfico"
            opcoes={ALCANCES.map((a) => ({ ...a, rotulo: a.rotulo.split(' ')[0] }))}
            valor={alcance}
            aoMudar={setAlcance}
          />
        </section>
        <section className="cartao bloco">
          <h2 className="titulo-laranja">Unidades de conexão</h2>
          <Polos polos={polos} aoMudar={setPolos} />
        </section>
        {erro && (
          <p className="erro-campo" role="alert">
            {erro}
          </p>
        )}
        <button type="button" className="botao botao--primario" onClick={salvar} disabled={salvando}>
          {salvando ? 'Salvando...' : 'Salvar preferências'}
        </button>
      </main>
    );
  }

  return (
    <main className="cadastro cadastro--largo">
      <Passos atual={3} />

      <header className="cadastro__cabecalho cadastro__cabecalho--centro">
        <span className="selo-ponto selo-ponto--suave">Etapa final de configuração</span>
        <h1>Suas preferências de Match Corporativo</h1>
        <p className="subtitulo">Defina o equilíbrio das sugestões para que os encontros virtuais sejam relevantes para sua rotina.</p>
      </header>

      <div className="grade-prefs">
        <section aria-labelledby="resumo-titulo">
          <div className="titulo-secao">
            <h2 id="resumo-titulo">Resumo do seu Perfil</h2>
            <span className="pilula pilula--verde">● Verificado</span>
          </div>
          <div className="cartao bloco resumo-perfil">
            <div className="linha">
              <Avatar nome={perfil.name} tamanho={64} quadrado />
              <div>
                <p className="resumo-perfil__nome">
                  {perfil.name} <IconeVerificado className="icone-verificado" aria-label="Verificado" />
                </p>
                <p className="pequeno">{[perfil.position, perfil.department].filter(Boolean).join(' • ')}</p>
                {perfil.location && (
                  <p className="pequeno meta">
                    <IconePino /> {perfil.location}
                  </p>
                )}
              </div>
            </div>

            {perfil.bio ? (
              <button type="button" className="caixa-bio" onClick={() => setDialogo('bio')} aria-label="Editar resumo profissional">
                {perfil.bio}
              </button>
            ) : (
              <button type="button" className="caixa-bio caixa-bio--vazia" onClick={() => setDialogo('bio')}>
                <IconeSomar /> Adicionar um resumo profissional (aparece só depois do match)
              </button>
            )}

            <div className="resumo-perfil__grupo">
              <div className="titulo-secao">
                <p className="rotulo">Interesses profissionais</p>
                <Link to="/cadastro/interesses" className="link-acao">
                  <IconeEditar /> Editar
                </Link>
              </div>
              <div className="chips">
                {perfil.tags.technical.map((t) => (
                  <span key={t.id} className="chip chip--azul">
                    {t.name}
                  </span>
                ))}
                {!perfil.tags.technical.length && <span className="pequeno">Nenhum ainda.</span>}
              </div>
            </div>

            <div className="resumo-perfil__grupo">
              <div className="titulo-secao">
                <p className="rotulo">Hobbies & conexão pessoal</p>
                <Link to="/cadastro/interesses" className="link-acao">
                  <IconeEditar /> Editar
                </Link>
              </div>
              <div className="chips">
                {perfil.tags.hobby.map((t) => (
                  <span key={t.id} className="chip chip--pessego">
                    {t.name}
                  </span>
                ))}
                {!perfil.tags.hobby.length && <span className="pequeno">Nenhum ainda.</span>}
              </div>
            </div>

            <div className="resumo-perfil__rodape">
              <span className="pequeno destaque-verde">
                <IconeEscudoCheck /> Perfil {pct}% preenchido
              </span>
              <button type="button" className="link-acao" onClick={() => setDialogo('preview')}>
                Ver preview público
              </button>
            </div>
          </div>
        </section>

        <section aria-labelledby="parametros-titulo">
          <div className="titulo-secao">
            <h2 id="parametros-titulo">Parâmetros de Prioridade de Match</h2>
            <span className="link-acao link-acao--estatico">
              <IconeAjustes /> Ajuste dinâmico
            </span>
          </div>
          <div className="cartao bloco">
            <div className="parametro">
              <div>
                <h3>Equilíbrio do Algoritmo</h3>
                <p className="pequeno">Como você prefere balancear as recomendações de coffee chat?</p>
              </div>
              <Equilibrio valor={peso} aoMudar={setPeso} />
            </div>

            <div className="parametro">
              <div>
                <h3>Alcance Geográfico</h3>
                <p className="pequeno">Escolha o raio de pessoas prioritárias para suas rodadas de conexão.</p>
              </div>
              <Segmentado
                rotulo="Alcance geográfico"
                opcoes={ALCANCES.map((a) => ({ ...a, Icone: ICONES_ALCANCE[a.id] }))}
                valor={alcance}
                aoMudar={setAlcance}
              />
            </div>

            <div className="parametro">
              <div>
                <h3>Unidades Avanade Habilitadas</h3>
                <p className="pequeno">Selecione escritórios dos quais deseja receber convites espontâneos.</p>
              </div>
              <Polos polos={polos} aoMudar={setPolos} />
            </div>

            <div className="parametro parametro--linha">
              <div>
                <h3 id="cota-titulo">Solicitações por semana</h3>
                <p className="pequeno">De 1 a 5, de segunda a domingo. Aceitar um pedido recebido não gasta a sua cota.</p>
              </div>
              <div className="passo" role="group" aria-labelledby="cota-titulo">
                <button type="button" aria-label="Diminuir" onClick={() => setCota(Math.max(1, cota - 1))} disabled={cota <= 1}>
                  <IconeSubtrair />
                </button>
                <output aria-live="polite">{cota}</output>
                <button type="button" aria-label="Aumentar" onClick={() => setCota(Math.min(5, cota + 1))} disabled={cota >= 5}>
                  <IconeSomar />
                </button>
              </div>
            </div>

            <div className="aviso-privacidade">
              <IconeEscudoCheck />
              <div>
                <strong>Privacidade Avanade Shield</strong>
                <p className="pequeno">
                  Seus dados ficam restritos ao ambiente corporativo interno. Cargo e resumo só aparecem depois do match, e você pode
                  alterar pesos de match, pausar sua exposição ou excluir seus dados a qualquer momento.
                </p>
              </div>
            </div>

            {erro && (
              <p className="erro-campo" role="alert">
                {erro}
              </p>
            )}

            <div className="parametro__acoes">
              <button type="button" className="botao botao--texto botao--auto" onClick={() => navegar('/cadastro/interesses')}>
                <IconeVoltar /> Voltar ao Mapeamento
              </button>
              <button type="button" className="botao botao--primario botao--auto botao--grande" onClick={salvar} disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar preferências e acessar plataforma'} <IconeSeta />
              </button>
            </div>
          </div>
        </section>
      </div>

      {dialogo === 'bio' && <EditarBio aoFechar={() => setDialogo(null)} />}
      {dialogo === 'preview' && <PreviewPublico aoFechar={() => setDialogo(null)} />}
    </main>
  );
}
