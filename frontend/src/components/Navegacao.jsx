import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Avatar } from './Basicos.jsx';
import { IconeBussola, IconeChat, IconeMatches, IconePerfil, IconePessoas } from './Icones.jsx';

const itens = [
  { para: '/descobrir', rotulo: 'Descobrir', Icone: IconeBussola },
  { para: '/conexoes', rotulo: 'Conexões', Icone: IconeMatches },
  { para: '/chat', rotulo: 'Chat', Icone: IconeChat },
  { para: '/eu', rotulo: 'Perfil', Icone: IconePerfil },
];

const classe = ({ isActive }) => (isActive ? 'ativo' : '');

// Navegação principal: menu lateral em telas largas e barra inferior em telas pequenas.
// Os dois ficam no HTML e o CSS mostra um por vez, então só um é anunciado a leitores de tela.
export default function Navegacao() {
  const { perfil } = useAuth();
  return (
    <>
      <aside className="lateral">
        <div className="lateral__marca">
          <span className="lateral__logo">
            <IconePessoas />
          </span>
          <strong>
            Avanade <span className="destaque">Connect</span>
          </strong>
        </div>
        <nav aria-label="Navegação principal">
          {itens.map(({ para, rotulo, Icone }) => (
            <NavLink key={para} to={para} className={classe}>
              <Icone />
              {rotulo}
            </NavLink>
          ))}
        </nav>
        {perfil && (
          <div className="lateral__usuario">
            <Avatar nome={perfil.name} tamanho={36} />
            <span>{perfil.name}</span>
          </div>
        )}
      </aside>

      <nav className="nav-inferior" aria-label="Navegação principal">
        {itens.map(({ para, rotulo, Icone }) => (
          <NavLink key={para} to={para} className={classe}>
            <Icone />
            {rotulo}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
