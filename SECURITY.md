# Segurança

## Como reportar uma vulnerabilidade

O repositório é público. Não descreva a falha em issue pública, pull request ou comentário. Use o reporte privado do GitHub: na aba **Security**, **Report a vulnerability**, e descreva:

- o que foi encontrado e onde (rota, tela ou arquivo);
- como reproduzir, com dados fictícios;
- o impacto que você enxerga.

Por favor, não teste contra dados reais de pessoas nem divulgue o problema antes da correção.

## O que o repositório verifica

- O Dependabot propõe atualizações semanais para backend, frontend, testes de ponta a ponta e GitHub Actions.
- O CI roda `npm audit` no backend e no frontend e falha com vulnerabilidade alta ou crítica nas dependências de produção.
- O CodeQL (`.github/workflows/codeql.yml`, job "Análise do JavaScript") analisa o JavaScript a cada pull request, a cada push em `main` e `develop` e toda semana. O job roda com a variável de repositório `CODEQL_ATIVO` igual a `true`; se ela for removida, o job fica pulado.
