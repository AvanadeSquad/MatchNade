import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar, Carregando, Modal } from '../components/Basicos.jsx';
import {
  IconeBloquear,
  IconeEditar,
  IconeEscudo,
  IconeEstrela,
  IconeInfo,
  IconePessoas,
  IconeSair,
  IconeSomar,
  IconeSubtrair,
} from '../components/Icones.jsx';
import Navegacao from '../components/Navegacao.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useAviso } from '../context/Avisos.jsx';
import { useCarregar } from '../hooks/useCarregar.js';
import { API } from '../services/api.js';
import { unidadeECidade } from '../utils/formatar.js';

function EditarDados({ perfil, aoFechar, aoSalvar }) {
  const [dados, setDados] = useState({
    name: perfil.name,
    department: perfil.department ?? '',
    location: perfil.location ?? '',
    position: perfil.position ?? '',
  });
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const campo = (nome) => ({ value: dados[nome], onChange: (e) => setDados({ ...dados, [nome]: e.target.value }) });

  async function enviar(evento) {
    evento.preventDefault();
    setSalvando(true);
    try {
      await API.atualizarPerfil(dados);
    } catch (e) {
      setErro(e.message);
      setSalvando(false);
      return;
    }
    await aoSalvar();
    aoFechar();
  }

  return (
    <Modal titulo="Editar meus dados" aoFechar={aoFechar} ocupado={salvando}>
      <form className="formulario" onSubmit={enviar}>
        <label className="campo">
          <span>Nome</span>
          <input {...campo('name')} required minLength={2} maxLength={120} />
        </label>
        <label className="campo">
          <span>Unidade</span>
          <input {...campo('department')} required maxLength={80} />
        </label>
        <label className="campo">
          <span>Cidade</span>
          <input {...campo('location')} required maxLength={80} />
        </label>
        <label className="campo">
          <span>Cargo (opcional)</span>
          <input {...campo('position')} maxLength={80} />
          <p className="campo__ajuda">Só aparece para quem já deu match com você, nunca na descoberta.</p>
        </label>
        {erro && (
          <p className="erro-campo" role="alert">
            {erro}
          </p>
        )}
        <div className="modal__acoes">
          <button type="button" className="botao botao--contorno" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </button>
          <button type="submit" className="botao botao--primario" disabled={salvando}>
            Salvar
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Bloqueados({ aoFechar }) {
  const avisar = useAviso();
  const { dados, carregando, recarregar } = useCarregar(() => API.bloqueados(), []);

  async function desbloquear(pessoa) {
    try {
      await API.desbloquear(pessoa.id);
      avisar(`Pessoa desbloqueada: ${pessoa.name}.`);
      recarregar();
    } catch (e) {
      avisar(e.message, 'erro');
    }
  }

  return (
    <Modal titulo="Pessoas bloqueadas" aoFechar={aoFechar}>
      {carregando && <Carregando />}
      {dados && !dados.blocked.length && <p>Você não bloqueou ninguém.</p>}
      {dados && dados.blocked.length > 0 && (
        <ul className="lista">
          {dados.blocked.map((p) => (
            <li key={p.id} className="linha linha--entre">
              <span>{p.name}</span>
              <button type="button" className="botao botao--contorno botao--pequeno botao--auto" onClick={() => desbloquear(p)}>
                Desbloquear
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="botao botao--contorno" onClick={aoFechar}>
        Fechar
      </button>
    </Modal>
  );
}

export default function Eu() {
  const { perfil, atualizarPerfilEmSilencio, sair } = useAuth();
  const avisar = useAviso();
  const navegar = useNavigate();
  const [dialogo, setDialogo] = useState(null);
  const [apagando, setApagando] = useState(false);
  const [pausado, setPausado] = useState(perfil.is_paused);
  const [cota, setCota] = useState(perfil.max_weekly_matches);
  const [salvandoCota, setSalvandoCota] = useState(false);
  const fechar = () => setDialogo(null);

  // Atualiza o interruptor na hora e só desfaz se a API recusar; falha ao reler o perfil não desfaz nada.
  async function alternarPausa(valor) {
    setPausado(valor);
    try {
      await API.pausar(valor);
    } catch (e) {
      setPausado(!valor);
      avisar(e.message, 'erro');
      return;
    }
    await atualizarPerfilEmSilencio();
    avisar(valor ? 'Exposição pausada.' : 'Exposição retomada.');
  }

  async function alterarCota(delta) {
    const nova = Math.min(5, Math.max(1, cota + delta));
    if (nova === cota || salvandoCota) return;
    const anterior = cota;
    setCota(nova);
    setSalvandoCota(true);
    try {
      await API.atualizarPerfil({ max_weekly_matches: nova });
      await atualizarPerfilEmSilencio();
    } catch (e) {
      setCota(anterior);
      avisar(e.message, 'erro');
    } finally {
      setSalvandoCota(false);
    }
  }

  async function excluir() {
    setApagando(true);
    try {
      await API.excluirPerfil();
    } catch (e) {
      avisar(e.message, 'erro');
      setApagando(false);
      return;
    }
    sair();
    navegar('/login', { replace: true });
  }

  return (
    <>
      <main className="tela tela--app">
        <h1>Meu perfil</h1>
        <div className="duas-colunas">
          <div className="coluna">
            <section className="cartao linha">
              <Avatar nome={perfil.name} tamanho={64} />
              <div className="espaco">
                <h2>{perfil.name}</h2>
                <p className="pequeno">{unidadeECidade(perfil.department, perfil.location)}</p>
                <button type="button" className="link-simples" onClick={() => setDialogo('editar')}>
                  <IconeEditar /> Editar perfil
                </button>
              </div>
            </section>

            <div className="estatisticas">
              <div className="cartao estatistica">
                <strong>{perfil.connections_count}</strong>
                <span>Conexões</span>
              </div>
              <div className="cartao estatistica">
                <strong>
                  {perfil.quota.used}/{perfil.quota.max}
                </strong>
                <span>Solicitações na semana</span>
              </div>
            </div>

            <section className="cartao" aria-label="Meus interesses">
              <h2 className="bloco__titulo">Interesses</h2>
              <div className="chips">
                {[...perfil.tags.technical, ...perfil.tags.hobby].map((t) => (
                  <span className="chip chip--marca" key={t.id}>
                    {t.name}
                  </span>
                ))}
              </div>
            </section>
          </div>

          <div className="coluna">
            <nav className="lista" aria-label="Configurações">
              <Link className="item-menu" to="/perfil/interesses?de=eu">
                <IconeEstrela /> Interesses
              </Link>
              <Link className="item-menu" to="/perfil/objetivos?de=eu">
                <IconePessoas /> Objetivos de conexão
              </Link>
              <button type="button" className="item-menu" onClick={() => setDialogo('bloqueados')}>
                <IconeBloquear /> Pessoas bloqueadas
              </button>
              <button type="button" className="item-menu" onClick={() => setDialogo('sobre')}>
                <IconeInfo /> Sobre o Avanade Connect
              </button>
            </nav>

            <section className="cartao lista" aria-label="Privacidade">
              <h2 className="bloco__titulo">
                <IconeEscudo width={14} height={14} style={{ verticalAlign: '-2px' }} /> Privacidade
              </h2>
              <label className="interruptor">
                <span>
                  <strong>Pausar minha exposição</strong>
                  <span className="pequeno" style={{ display: 'block' }}>
                    Você some da descoberta. Seus matches continuam.
                  </span>
                </span>
                <input type="checkbox" checked={pausado} onChange={(e) => alternarPausa(e.target.checked)} />
              </label>
              <div className="interruptor">
                <span>
                  <strong id="cota-rotulo">Solicitações por semana</strong>
                  <span className="pequeno" style={{ display: 'block' }}>
                    De 1 a 5, de segunda a domingo.
                  </span>
                </span>
                <div className="passo" role="group" aria-labelledby="cota-rotulo">
                  <button type="button" aria-label="Diminuir" onClick={() => alterarCota(-1)} disabled={cota <= 1 || salvandoCota}>
                    <IconeSubtrair />
                  </button>
                  <output aria-live="polite">{cota}</output>
                  <button type="button" aria-label="Aumentar" onClick={() => alterarCota(1)} disabled={cota >= 5 || salvandoCota}>
                    <IconeSomar />
                  </button>
                </div>
              </div>
            </section>

            <button type="button" className="item-menu item-menu--perigo" onClick={() => setDialogo('excluir')}>
              <IconeBloquear /> Excluir meus dados
            </button>
            <button
              type="button"
              className="item-menu item-menu--perigo"
              onClick={() => {
                sair();
                navegar('/login', { replace: true });
              }}
            >
              <IconeSair /> Sair da conta
            </button>
          </div>
        </div>
      </main>
      <Navegacao />

      {dialogo === 'editar' && <EditarDados perfil={perfil} aoFechar={fechar} aoSalvar={atualizarPerfilEmSilencio} />}
      {dialogo === 'bloqueados' && <Bloqueados aoFechar={fechar} />}
      {dialogo === 'sobre' && (
        <Modal titulo="Sobre o Avanade Connect" aoFechar={fechar}>
          <p>
            Plataforma interna para colaboradores da Avanade se conhecerem por interesses profissionais e pessoais. A conexão só acontece
            quando as duas pessoas querem, e cargo ou senioridade nunca entram na escolha.
          </p>
          <button type="button" className="botao botao--contorno" onClick={fechar}>
            Fechar
          </button>
        </Modal>
      )}
      {dialogo === 'excluir' && (
        <Modal titulo="Excluir meus dados?" aoFechar={fechar} ocupado={apagando}>
          <p>Seu perfil, interesses, conexões e mensagens são apagados de forma definitiva. Esta ação não pode ser desfeita.</p>
          <div className="modal__acoes">
            <button type="button" className="botao botao--contorno" onClick={fechar} disabled={apagando}>
              Cancelar
            </button>
            <button type="button" className="botao botao--perigo" disabled={apagando} onClick={excluir}>
              Excluir tudo
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
