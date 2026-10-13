# Segurança

## Como reportar uma vulnerabilidade

Não descreva a falha em issue pública, pull request ou comentário. Avise a equipe do projeto pelo canal combinado do squad ou fale direto com quem administra o repositório, e descreva:

- o que foi encontrado e onde (rota, tela ou arquivo);
- como reproduzir, com dados fictícios;
- o impacto que você enxerga.

Por favor, não teste contra dados reais de pessoas nem divulgue o problema antes da correção.

Se o repositório se tornar público, o canal passa a ser o reporte privado do GitHub: na aba **Security**, **Report a vulnerability**.

## O que o repositório verifica

- O Dependabot propõe atualizações semanais para backend, frontend, testes de ponta a ponta e GitHub Actions.
- O CI roda `npm audit` no backend e no frontend e falha com vulnerabilidade alta ou crítica nas dependências de produção.
- O CodeQL analisa o JavaScript a cada pull request, a cada push em `main` e `develop` e toda semana, quando está ativado: exige o Code scanning ligado no repositório e a variável de repositório `CODEQL_ATIVO` com o valor `true`. Sem isso, o job fica pulado.
