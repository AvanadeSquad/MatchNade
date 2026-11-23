# Registrar o aplicativo no Entra ID (login Microsoft)

Cartão S4-11. O código do login com Microsoft está pronto e testado com tokens simulados; falta registrar o aplicativo num tenant do projeto. A Avanade não libera o tenant dela, então o registro é próprio, aberto a qualquer conta Microsoft. Numa adoção real, bastaria apontar para o tenant da empresa (`MICROSOFT_ALLOWED_TENANTS`).

**Nada de segredo neste fluxo.** O aplicativo é do tipo página única (SPA) com PKCE: só o ID do aplicativo (cliente) é usado, e ele não é segredo, mas fica em variável de ambiente e não no repositório.

## 1. Ter um tenant

O registro de aplicativo exige um tenant do Microsoft Entra ID. Os caminhos documentados pela Microsoft:

- **Conta Azure gratuita**: cria um tenant padrão e pede verificação por cartão, sem cobrança no plano gratuito.
- **Microsoft 365 Developer Program**: tenant de desenvolvedor, quando disponível para a conta.

A documentação oficial é ambígua sobre o que acontece depois que o período gratuito do Azure acaba. Registrar o aplicativo em si não tem custo, mas confirme na primeira vez que você ainda consegue editar o registro, e anote o ID do aplicativo logo, para não depender de reabrir o portal. Criar a conta e informar o cartão são passos seus.

## 2. Registrar o aplicativo

No portal [entra.microsoft.com](https://entra.microsoft.com), em Identidade, Aplicativos, Registros de aplicativo, Novo registro (os nomes dos menus podem variar):

1. **Nome:** Avanade Connect.
2. **Tipos de conta com suporte:** "Contas em qualquer diretório organizacional e contas pessoais da Microsoft". Escolha só organizações se não quiser contas pessoais.
3. **URI de redirecionamento:** plataforma "Aplicativo de página única (SPA)", com `http://localhost:5173`. Depois do deploy, acrescente a URL do frontend. Use SPA, não "Web": é o que habilita PKCE sem segredo.
4. Registrar. Na página "Visão geral", copie o **ID do aplicativo (cliente)**.

Não é preciso criar segredo do cliente, nem conceder consentimento de administrador: o login básico (nome e e-mail) usa as permissões padrão `openid`, `profile` e `email`.

## 3. Configurar

| Onde | Variável | Valor |
|---|---|---|
| `backend/.env` | `MICROSOFT_CLIENT_ID` | ID do aplicativo |
| `backend/.env` | `MICROSOFT_ALLOW_PERSONAL` | `true` para aceitar contas pessoais |
| `backend/.env` | `MICROSOFT_ALLOWED_TENANTS` | ID do tenant de cada organização aceita, separados por vírgula (opcional se só aceitar contas pessoais) |
| `frontend/.env` | `VITE_MICROSOFT_CLIENT_ID` | o mesmo ID do aplicativo |

Sem `MICROSOFT_CLIENT_ID`, ou sem nenhum locatário aceito, o botão não funciona e a API responde 503 `MICROSOFT_NAO_CONFIGURADA`. O front pede a autoridade `common` (organizações e contas pessoais); quem decide o que entra é a API e o tipo de conta do registro.

## 4. Testar

1. Suba a API e o app (README, "Rodar localmente") e abra `http://localhost:5173`.
2. Na tela de login, "Entrar com Microsoft", escolha uma conta e confirme que o app abre o cadastro (primeiro acesso) ou a Descoberta.
3. Entre de novo com a mesma conta: deve cair na mesma pessoa (a identidade é o par locatário e `oid`, não o e-mail).
4. Com `ALLOWED_EMAIL_DOMAINS` definido, uma conta de outro domínio deve receber "Seu e-mail ainda não está liberado".

## Riscos conhecidos

- **Vínculo por e-mail.** Se já existir uma conta com o mesmo e-mail (por exemplo, criada com senha), o login Microsoft de **organização** entra nela: o tenant da lista é a garantia da posse do e-mail. A conta **pessoal** nunca assume uma conta existente pelo e-mail, porque nenhum tenant garante a posse da caixa: a API recusa com 409 `EMAIL_JA_CADASTRADO` e a pessoa entra com o e-mail e a senha daquela conta. A conta pessoal que já entrou continua entrando pelo próprio identificador. Em produção real, ainda vale combinar `MICROSOFT_ALLOW_PERSONAL` com `ALLOWED_EMAIL_DOMAINS` ou `ALLOWED_EMAILS`, para limitar quem pode criar conta.
- **Não testado com a Microsoft real.** Os testes automatizados usam tokens assinados com chaves de teste. O primeiro login real é o teste de verdade.
