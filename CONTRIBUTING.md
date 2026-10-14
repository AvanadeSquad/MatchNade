# Como contribuir

## Fluxo

1. Crie uma branch a partir de `develop`: `feature/<assunto>` ou `fix/<assunto>`.
2. Faça mudanças pequenas e focadas. Rode os testes da parte que mexeu (veja o `README.md`).
3. Abra um pull request para `develop`. A `main` só recebe o que já foi validado.

## PRs empilhados

Os PRs 3 a 7 apontam para `develop`. Os PRs a partir do 8 apontam para a branch de um deles (ou de outro PR filho), não para `develop`, para que o diff de cada um mostre só a própria mudança:

| Base | PRs que apontam para ela |
|---|---|
| `develop` | 3, 4, 5, 6, 7 e 24 |
| `feature/backend-api` (PR 4) | 8, 10, 11, 13, 17, 19, 22, 23 e 28 |
| `feature/frontend-app` (PR 5) | 14, 16, 20 e 29 |
| `feature/e2e-playwright` (PR 3) | 12 e 18 |
| `feature/documentacao` (PR 6) | 30 e o desta seção |
| `feature/ci-e-publicacao` (PR 7) | 9, 15 e 21 |
| `feature/regressao-visual` (PR 18) | 25 |
| `feature/observabilidade` (PR 22) | 26 |
| `feature/cabecalhos-seguranca` (PR 16) | 27 |

Mescle sempre com merge commit ("Create a merge commit"), nunca com squash: como os PRs são empilhados, o squash cria commits novos e os PRs filhos passam a mostrar de novo as mudanças do pai.

Ordem de mesclagem:

1. **PR 24 primeiro de todos** (fim de linha), antes de qualquer outro, para que tudo o que entrar depois já chegue em LF.
2. **Os PRs base**, nesta ordem: 4, 5, 3, 6 e 7. O **PR 28** entra logo depois do 4 (reaponte-o para `develop` antes): ele aumenta o limite de tempo dos testes do backend, e sem ele os filhos do backend podem falhar por tempo esgotado ao criar o banco em memória em máquinas lentas.
3. **Os filhos**, na ordem dos números, depois de reapontar cada um para `develop` (no PR, "Edit" ao lado do título) assim que o PR da sua base for mesclado. Algumas dependências fixam a ordem:
   - PR 8 antes do PR 9. O 8 cria o modo de testes em PostgreSQL real; sem ele, o job de PostgreSQL do 9 passa sem testar PostgreSQL.
   - PRs 18 e 25 entram juntos: mescle primeiro o PR 25 na branch do PR 18 (`feature/regressao-visual`) e depois o PR 18 em `develop`. O 18 sozinho repete o teste visual no CI, que falha na segunda tentativa.
   - PRs 19 e 20 antes do PR 21. O 21 roda no CI os scripts de lint que eles criam.
   - PR 22 antes do PR 26, e PR 16 antes do PR 27, porque são as bases deles.
   - PRs 16 e 27 antes do PR 31. O `docs/deploy.md` do 31 cita `frontend/public/_headers` e `npm run test:cabecalhos`, que vêm deles.

   Na prática: 24; 4, 28, 5, 3, 6, 7; 8, 9, 10, 11, 12, 13, 14, 15, 16, 17; 25 dentro do 18 e então 18; 19, 20, 21, 22, 23, 26, 27, 29, 30 e 31.

**Branch base apagada.** Quando o próprio GitHub apaga a branch de um PR depois do merge (o botão "Delete branch" ou a opção de apagar automaticamente), os PRs filhos são reapontados sozinhos para a base do pai. O risco é apagar a branch por fora, no terminal (`git push origin --delete`): aí os PRs filhos são fechados e precisam ser reabertos ou recriados. Não apague branches pelo terminal enquanto houver PR apontando para elas.

**Conflitos esperados.** Seis merges conflitam na ordem acima, porque várias branches acrescentam coisas no mesmo lugar:

| PR | Arquivos em conflito |
|---|---|
| 13 | `backend/README.md` e `backend/package.json` |
| 17 | `backend/package.json` |
| 19 | `backend/package.json` |
| 20 | `frontend/README.md`, `frontend/package.json` e `frontend/package-lock.json` |
| 23 | `backend/package.json` e `backend/package-lock.json` |
| 27 | `frontend/package.json` |

Como resolver:

- `package.json`: manter os dois lados não basta. Confira em que bloco (`scripts`, `dependencies`, `devDependencies`, `overrides`) cada linha ficou depois de juntar. Na união dos PRs 14 e 20, por exemplo, as dependências de lint podem cair dentro de `overrides`: o Git não avisa nada, e o lint quebra. Confira também as vírgulas: o arquivo precisa continuar sendo JSON válido.
- `package-lock.json`: aceite qualquer um dos lados e rode `npm install` na pasta para regenerar o arquivo a partir do `package.json` já resolvido.
- `README.md` do backend e do frontend: mantenha as duas seções.
- Antes de concluir o merge, valide na pasta: `npm ci`, `npm test` e `npm run lint` e `npm run format:check` (backend e frontend). No Windows, use `npm run format:check -- --end-of-line auto` até o PR 24 estar mesclado.

## Fim de linha

O `.gitattributes` da raiz força LF em código, JSON, YAML, SQL, CSS, HTML e Markdown, e marca imagens e PDFs como binários. Sem isso, o `core.autocrlf` do Windows converte os arquivos para CRLF e o `npm run format:check` falha em todos eles. Quem já tinha clonado no Windows antes desse arquivo precisa refazer o checkout para os arquivos voltarem a LF. Depois de puxar, com a árvore de trabalho limpa (faça commit ou `git stash` antes, porque o segundo comando descarta mudanças locais):

```powershell
git rm -r --cached -q .
git reset --hard
```

Só `git add --renormalize .` não basta: ele corrige o que está versionado, que já é LF, e não reescreve os arquivos da pasta. Clonar de novo também resolve.

## Commits

Mensagens em português, no imperativo, com um prefixo: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`. A primeira linha resume o que muda; o corpo, se houver, explica o motivo.

## Código

- Comentário explica o código: o que ele faz e por quê. Não registre contexto de gestão do projeto, histórico de decisões nem estado de andamento ("provisório", "a fazer").
- Textos de interface e de documentação em português do Brasil, sem travessão. Ícones são SVG, não emoji.
- Dados de teste, exemplos e seeds são sempre fictícios.
- Regras de negócio ficam no backend e são cobertas por teste de API; o teste de ponta a ponta confere os fluxos principais.
- Cargo e senioridade não entram em filtro, pontuação, cartão da descoberta nem texto de IA.

## Antes de abrir o PR

```powershell
cd backend; npm test
cd ..\frontend; npm test; npm run build
cd ..\e2e; npm test
```
