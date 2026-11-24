import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useAviso } from '../context/Avisos.jsx';
import { API } from '../services/api.js';
import { HORARIOS } from '../utils/cafe.js';
import { AVATARES } from './AvataresProntos.jsx';
import { Avatar, ChipEscolha, Modal } from './Basicos.jsx';

export const MAX_HORARIOS_PREFERIDOS = 5;

// Personalização do perfil: avatar pronto, pronomes, quem pode ver a pessoa e horários preferidos de Coffee Chat.
// Nada daqui entra no cálculo de afinidade nem em texto de IA.
export default function PersonalizarPerfil({ aoFechar }) {
  const { perfil, definirPerfil } = useAuth();
  const avisar = useAviso();
  const [avatarId, setAvatarId] = useState(perfil.avatar_id ?? null);
  const [pronomes, setPronomes] = useState(perfil.pronouns ?? '');
  const [visibilidade, setVisibilidade] = useState(perfil.visibility ?? 'ALL');
  const [horarios, setHorarios] = useState(perfil.preferred_coffee_slots ?? []);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const alternarHorario = (h) =>
    setHorarios((atuais) =>
      atuais.includes(h) ? atuais.filter((x) => x !== h) : atuais.length < MAX_HORARIOS_PREFERIDOS ? [...atuais, h] : atuais,
    );
  const cheio = horarios.length >= MAX_HORARIOS_PREFERIDOS;

  async function enviar(evento) {
    evento.preventDefault();
    setErro('');
    setSalvando(true);
    try {
      definirPerfil(
        await API.atualizarPerfil({
          avatar_id: avatarId,
          pronouns: pronomes.trim(),
          visibility: visibilidade,
          preferred_coffee_slots: horarios,
        }),
      );
    } catch (e) {
      setErro(e.message);
      setSalvando(false);
      return;
    }
    avisar('Personalização salva.');
    aoFechar();
  }

  return (
    <Modal titulo="Personalizar perfil" aoFechar={aoFechar} ocupado={salvando}>
      <form className="formulario" onSubmit={enviar}>
        <fieldset className="campo">
          <legend>Avatar</legend>
          <div className="avatares-escolha">
            <button
              type="button"
              className={`avatar-opcao${avatarId === null ? ' avatar-opcao--ativo' : ''}`}
              aria-pressed={avatarId === null}
              aria-label="Usar minhas iniciais"
              onClick={() => setAvatarId(null)}
            >
              <Avatar nome={perfil.name} tamanho={44} />
            </button>
            {AVATARES.map((a) => (
              <button
                key={a.id}
                type="button"
                className={`avatar-opcao${avatarId === a.id ? ' avatar-opcao--ativo' : ''}`}
                aria-pressed={avatarId === a.id}
                aria-label={`Avatar ${a.nome}`}
                onClick={() => setAvatarId(a.id)}
              >
                <Avatar nome={perfil.name} avatarId={a.id} tamanho={44} />
              </button>
            ))}
          </div>
          <span className="campo__ajuda">Avatares prontos, sem envio de imagem. Aparece no lugar das suas iniciais.</span>
        </fieldset>

        <label className="campo">
          <span>Pronomes (opcional)</span>
          <input
            className="campo__controle"
            value={pronomes}
            onChange={(e) => setPronomes(e.target.value)}
            maxLength={30}
            placeholder="ela/dela, ele/dele, elu/delu"
            aria-describedby="ajuda-pronomes"
          />
          <span id="ajuda-pronomes" className="campo__ajuda">
            Aparece junto ao seu nome. Use só letras e barra, até 30 caracteres.
          </span>
        </label>

        <fieldset className="campo">
          <legend>Quem pode ver você na descoberta</legend>
          <label className="opcao-radio">
            <input type="radio" name="visibilidade" checked={visibilidade === 'ALL'} onChange={() => setVisibilidade('ALL')} />
            <span>Todas as unidades</span>
          </label>
          <label className="opcao-radio">
            <input type="radio" name="visibilidade" checked={visibilidade === 'UNIT'} onChange={() => setVisibilidade('UNIT')} />
            <span>Só a minha unidade</span>
          </label>
          <span className="campo__ajuda">
            {visibilidade === 'UNIT'
              ? `Você aparece só para quem é da mesma unidade${perfil.department ? ` (${perfil.department})` : ''}. Você continua vendo todas as unidades, e as conexões que já existem seguem normais.`
              : 'Conversas entre unidades diferentes são o ponto forte do Avanade Connect. Você pode restringir quando quiser.'}
          </span>
        </fieldset>

        <fieldset className="campo">
          <legend>Horários preferidos de Coffee Chat</legend>
          <div className="chips">
            {HORARIOS.map((h) => (
              <ChipEscolha key={h} selecionado={horarios.includes(h)} aoAlternar={() => alternarHorario(h)}>
                {h}
              </ChipEscolha>
            ))}
          </div>
          <span className="campo__ajuda">
            Até {MAX_HORARIOS_PREFERIDOS} horários ({horarios.length} marcados{cheio ? ', limite atingido' : ''}). Eles vêm em destaque
            quando você propõe um café.
          </span>
        </fieldset>

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
