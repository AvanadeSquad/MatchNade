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

  it('só de ler, apaga do navegador telefone, CEP e e-mail pessoal', () => {
    localStorage.setItem(
      'preferencias:11',
      JSON.stringify({
        telefone: '(11) 90000-0000',
        cep: '00000-000',
        emailPessoal: 'pessoa@exemplo.test',
        hub: 'Avanade Recife (Porto Digital)',
      }),
    );
    lerPreferencias(11);
    const gravado = JSON.parse(localStorage.getItem('preferencias:11'));
    for (const chave of ['telefone', 'cep', 'emailPessoal']) expect(gravado).not.toHaveProperty(chave);
    expect(gravado).toEqual({ hub: 'Avanade Recife (Porto Digital)' });
  });

  it('valor ilegível no navegador fica como está', () => {
    localStorage.setItem('preferencias:12', '{quebrado');
    expect(lerPreferencias(12)).toEqual(PADRAO);
    expect(localStorage.getItem('preferencias:12')).toBe('{quebrado');
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
