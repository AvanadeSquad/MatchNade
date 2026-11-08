export const MICROSOFT_CLIENT_ID = import.meta.env.VITE_MICROSOFT_CLIENT_ID || '';

// Contas de trabalho ou escola de qualquer organização; contas pessoais da Microsoft ficam de fora.
// A API confere o locatário e o e-mail liberados, então escolher a organização aqui não dá acesso.
const AUTORIDADE = 'https://login.microsoftonline.com/organizations';

// Abre a janela de login da Microsoft (código de autorização com PKCE, feito pela biblioteca) e
// devolve o ID token para a API validar. Devolve null quando a pessoa fecha a janela.
// `carregar` e `clientId` existem para os testes; a biblioteca só é baixada quando alguém clica.
export async function obterIdTokenMicrosoft({ clientId = MICROSOFT_CLIENT_ID, carregar = () => import('@azure/msal-browser') } = {}) {
  const { PublicClientApplication } = await carregar();
  const aplicativo = new PublicClientApplication({
    auth: { clientId, authority: AUTORIDADE, redirectUri: window.location.origin },
    cache: { cacheLocation: 'sessionStorage' },
  });
  await aplicativo.initialize();
  try {
    const resultado = await aplicativo.loginPopup({ scopes: ['openid', 'profile', 'email'], prompt: 'select_account' });
    return resultado.idToken || null;
  } catch (erro) {
    if (erro?.errorCode === 'user_cancelled') return null;
    throw new Error('Não foi possível entrar com a Microsoft. Tente novamente.');
  }
}
