// Interesses parecidos, mas não iguais (ex.: Django e Python), vindos do score semântico. Sem pares, não mostra nada.
export default function InteressesRelacionados({ pares, nome }) {
  if (!pares?.length) return null;
  return (
    <section className="sugestao__secao interesses-relacionados" aria-label="Interesses parecidos">
      <h3>Interesses parecidos</h3>
      <ul className="interesses-relacionados__lista">
        {pares.map((par) => (
          <li key={`${par.mine}-${par.theirs}`}>
            <strong>{par.mine}</strong> <span>(seu) se parece com</span> <strong>{par.theirs}</strong> <span>(de {nome})</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
