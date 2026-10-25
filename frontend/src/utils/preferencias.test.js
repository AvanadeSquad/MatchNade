import { describe, expect, it } from 'vitest';
import { lerPreferencias, PADRAO, salvarPreferencias } from './preferencias.js';

describe('preferencias', () => {
  it('descarta telefone, CEP e e-mail pessoal gravados antes, ao ler e ao gravar', () => {
    localStorage.setItem(
      'preferencias:7',
      JSON.stringify({
        telefone: '(11) 90000-0000',
        cep: '00000-000',
        emailPessoal: 'pessoa@exemplo.test',
        hub: 'Avanade Curitiba',
        alcance: 'LOCAL',
      }),
    );
    const lidas = lerPreferencias(7);
    expect(lidas).not.toHaveProperty('telefone');
    expect(lidas).not.toHaveProperty('cep');
    expect(lidas).not.toHaveProperty('emailPessoal');
    expect(lidas).toMatchObject({ hub: 'Avanade Curitiba', alcance: 'LOCAL' });

    salvarPreferencias(7, { notificacoes: false });
    const gravado = JSON.parse(localStorage.getItem('preferencias:7'));
    expect(Object.keys(gravado).sort()).toEqual(Object.keys(PADRAO).sort());
    expect(gravado).toMatchObject({ hub: 'Avanade Curitiba', alcance: 'LOCAL', notificacoes: false });
  });

  it('ignora chave desconhecida também no que é salvo', () => {
    const novas = salvarPreferencias(8, { hub: 'Avanade Brasília', telefone: '(61) 90000-0000' });
    expect(novas).not.toHaveProperty('telefone');
    expect(JSON.parse(localStorage.getItem('preferencias:8'))).not.toHaveProperty('telefone');
  });

  it('valores padrão não incluem os campos removidos', () => {
    for (const chave of ['telefone', 'cep', 'emailPessoal']) expect(PADRAO).not.toHaveProperty(chave);
    expect(lerPreferencias(99)).toEqual(PADRAO);
  });
});
