import { describe, expect, it } from 'vitest';
import { dataDoCafe } from './cafe.js';

describe('dataDoCafe', () => {
  const hoje = new Date(2026, 10, 8, 12, 0);

  it('lê dia, mês e horário do texto do convite', () => {
    const data = dataDoCafe('Segunda-feira, 10/11 às 10:30', hoje);
    expect(data).toEqual(new Date(2026, 10, 10, 10, 30));
  });

  it('usa o ano seguinte quando o dia caiu em janeiro e hoje é dezembro', () => {
    const dezembro = new Date(2026, 11, 29, 9, 0);
    expect(dataDoCafe('Sexta-feira, 02/01 às 14:00', dezembro)).toEqual(new Date(2027, 0, 2, 14, 0));
  });

  it('mantém o ano atual para um dia recente que já passou', () => {
    expect(dataDoCafe('Sexta-feira, 06/11 às 14:00', hoje)).toEqual(new Date(2026, 10, 6, 14, 0));
  });

  it('devolve null para texto fora do formato ou data impossível', () => {
    expect(dataDoCafe('amanhã cedo', hoje)).toBeNull();
    expect(dataDoCafe('Sexta-feira, 31/02 às 10:00', hoje)).toBeNull();
  });
});
