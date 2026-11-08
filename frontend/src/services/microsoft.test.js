import { describe, expect, it, vi } from 'vitest';
import { obterIdTokenMicrosoft } from './microsoft.js';

function biblioteca({ loginPopup }) {
  const instancias = [];
  class PublicClientApplication {
    constructor(configuracao) {
      this.configuracao = configuracao;
      this.initialize = vi.fn().mockResolvedValue();
      this.loginPopup = loginPopup;
      instancias.push(this);
    }
  }
  return { carregar: async () => ({ PublicClientApplication }), instancias };
}

describe('obterIdTokenMicrosoft', () => {
  it('configura o aplicativo para contas de trabalho e devolve o ID token', async () => {
    const { carregar, instancias } = biblioteca({ loginPopup: vi.fn().mockResolvedValue({ idToken: 'token-da-microsoft' }) });
    const token = await obterIdTokenMicrosoft({ clientId: 'app-1', carregar });
    expect(token).toBe('token-da-microsoft');
    const [app] = instancias;
    expect(app.configuracao.auth).toMatchObject({ clientId: 'app-1', authority: 'https://login.microsoftonline.com/organizations' });
    expect(app.initialize).toHaveBeenCalled();
    expect(app.loginPopup).toHaveBeenCalledWith(expect.objectContaining({ scopes: ['openid', 'profile', 'email'] }));
  });

  it('devolve null quando a pessoa fecha a janela', async () => {
    const { carregar } = biblioteca({ loginPopup: vi.fn().mockRejectedValue({ errorCode: 'user_cancelled' }) });
    expect(await obterIdTokenMicrosoft({ clientId: 'app-1', carregar })).toBeNull();
  });

  it('transforma outras falhas em mensagem em português, sem vazar o erro original', async () => {
    const { carregar } = biblioteca({ loginPopup: vi.fn().mockRejectedValue(new Error('AADSTS50011 detalhe interno')) });
    await expect(obterIdTokenMicrosoft({ clientId: 'app-1', carregar })).rejects.toThrow(
      'Não foi possível entrar com a Microsoft. Tente novamente.',
    );
  });
});
