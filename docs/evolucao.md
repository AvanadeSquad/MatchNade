# O que ainda pode evoluir

Lista de pontos conhecidos, por área. Não é uma promessa de escopo: serve para priorizar o que vem depois do que já funciona.

## Validação em ambiente real

- **Login com Google.** Os testes usam um verificador simulado. Validar com um ID de cliente real e uma conta liberada.
- **PostgreSQL.** Os testes rodam em PGlite. Validar o esquema, as consultas e as travas de pedidos simultâneos no Neon.
- **IA.** Os testes usam respostas simuladas de Gemini e Groq. Medir precisão e cobertura da extração de tags com bios fictícias e ajustar prompts, modelo e limites.
- **Publicação.** Conferir `render.yaml`, o workflow de CI e os passos de `deploy.md` num deploy completo.

## Produto

- **Descoberta:** a busca e os filtros rodam no navegador sobre as sugestões já carregadas (até 20 por vez); falta paginação. As pessoas ignoradas ficam só no navegador; guardar no servidor evita que reapareçam em outro aparelho.
- **Chat:** avisos fora do app (e-mail ou Teams) e troca do polling por envio em tempo real se a hospedagem permitir. As conversas lidas são marcadas só no navegador.
- **Perfil:** foto, edição da bio com nova análise e histórico de conexões.
- **Moderação:** tela para quem administra tratar denúncias e gerenciar a lista de e-mails liberados. Hoje as denúncias só ficam gravadas.

## Qualidade e segurança

- **Acessibilidade:** auditoria com leitor de tela e modo escuro.
- **Segurança:** avaliação de guardar o token em cookie `httpOnly` no lugar do `localStorage` e política de retenção do registro de IA.
- **Privacidade:** confirmar a base legal e o uso de dados pelo plano gratuito do provedor de IA antes de enviar bios reais.
- **Testes:** um teste de ponta a ponta do fluxo de revisão de tags com a IA respondendo pela API (hoje a tela só é conferida pela acessibilidade, com a resposta simulada no navegador) e um teste de carga simples na API.
- **Operação:** métricas e alertas.

## Pontos conhecidos

- **Preferências de descoberta no navegador.** Equilíbrio entre interesses profissionais e pessoais, alcance geográfico, polos habilitados e hub ficam no `localStorage`, separados por conta. Não acompanham a pessoa em outro aparelho.
- **Catálogo de tags sem moderação nem sinônimos.** Qualquer pessoa cria tags; a API recusa cargo, termos genéricos e ofensivos, mas não junta grafias diferentes da mesma tag nem trata sinônimos.
- **Filtro de dados sensíveis só na saída da IA.** Tags e quebra-gelos gerados pela IA são filtrados; o que a própria pessoa digita não passa pelo filtro.

## Design

- Validar com quem desenhou as telas as adaptações para desktop e os ajustes de contraste (veja `docs/design/README.md`).
- Desenhar os estados que não existem no Figma: vazio, erro e carregando, bloquear e denunciar.
