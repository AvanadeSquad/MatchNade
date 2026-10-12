# Segurança

## Como reportar uma vulnerabilidade

Não abra uma issue pública. Use o reporte privado do GitHub: na aba **Security** do repositório, clique em **Report a vulnerability** e descreva:

- o que foi encontrado e onde (rota, tela ou arquivo);
- como reproduzir, com dados fictícios;
- o impacto que você enxerga.

Respondemos pelo próprio reporte. Por favor, não teste contra dados reais de pessoas nem divulgue o problema antes da correção.

## O que o repositório verifica

- CodeQL analisa o JavaScript a cada pull request, a cada push em `main` e `develop` e toda semana.
- O Dependabot propõe atualizações semanais para backend, frontend, testes de ponta a ponta e GitHub Actions.
- O CI roda `npm audit` e falha com vulnerabilidade alta ou crítica nas dependências de produção.
