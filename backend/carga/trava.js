// Trava do teste de carga. O script ajusta a cota semanal de todas as pessoas e insere perfis fictícios,
// então só pode rodar num banco que tenha apenas dados dele mesmo: vazio, ou já preparado por uma
// execução anterior (pessoas do seed e perfis `carga*@exemplo.test`).

export class BancoComDadosAlheios extends Error {
  constructor(quantidade) {
    super(
      `O banco de DATABASE_URL tem ${quantidade} ${quantidade === 1 ? 'pessoa' : 'pessoas'} que não vêm do seed nem do teste de carga. ` +
        'O teste de carga altera a cota semanal de todas as pessoas e insere perfis fictícios, então só roda em banco vazio ' +
        'ou preparado por ele mesmo. Nada foi alterado.',
    );
    this.name = 'BancoComDadosAlheios';
    this.quantidade = quantidade;
  }
}

// `consultar(sql, parametros)` devolve as linhas. Roda antes de qualquer escrita; se a tabela
// `employee` ainda não existe, o banco é novo e a execução segue.
export async function exigirBancoSemDadosAlheios(consultar, { emailsDoSeed, emailDoScript }) {
  const [{ existe }] = await consultar(`SELECT to_regclass('employee') IS NOT NULL AS existe`, []);
  if (!existe) return;
  const [{ total }] = await consultar(
    `SELECT COUNT(*)::int AS total FROM employee
      WHERE email <> ALL($1::text[]) AND email <> $2 AND email NOT LIKE 'carga%@exemplo.test'`,
    [emailsDoSeed, emailDoScript],
  );
  if (total > 0) throw new BancoComDadosAlheios(total);
}
