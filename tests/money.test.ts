import { describe, expect, it } from 'vitest';
import { clamp, decimalOf, moneyNumber, percentage, roundMoney } from '../src/server/lib/money.js';

describe('money helpers', () => {
  it('rounds currency values to two decimals', () => {
    expect(moneyNumber(roundMoney(123.456))).toBe(123.46);
    expect(moneyNumber(roundMoney(123.451))).toBe(123.45);
  });

  it('converts percentages to ratios', () => {
    expect(percentage('12.5').toNumber()).toBe(0.125);
  });

  it('clamps prices inside hard floor and ceiling bounds', () => {
    const result = clamp(decimalOf('700.00'), decimalOf('96.00'), decimalOf('650.00'));
    expect(result.toFixed(2)).toBe('650.00');
  });
});
