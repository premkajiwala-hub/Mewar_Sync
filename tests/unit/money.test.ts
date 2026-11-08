import { describe, expect, it } from 'vitest';
import { formatINR, parseMoneyInput, parseQuantityInput, roundMoney, MAX_AMOUNT } from '../../lib/money';

describe('roundMoney', () => {
  it('rounds to paise without floating point drift', () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(33.333333)).toBe(33.33);
  });

  it('treats non-finite values as zero', () => {
    expect(roundMoney(Number.NaN)).toBe(0);
    expect(roundMoney(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('parseMoneyInput', () => {
  it('accepts whole and two-decimal rupee values', () => {
    expect(parseMoneyInput('1250')).toEqual({ ok: true, value: 1250 });
    expect(parseMoneyInput('99.5')).toEqual({ ok: true, value: 99.5 });
    expect(parseMoneyInput('₹1,25,000')).toEqual({ ok: true, value: 125000 });
  });

  it('rejects negative, empty, malformed and over-precise values instead of fixing them', () => {
    expect(parseMoneyInput('-5').ok).toBe(false);
    expect(parseMoneyInput('').ok).toBe(false);
    expect(parseMoneyInput('12abc').ok).toBe(false);
    expect(parseMoneyInput('1.005').ok).toBe(false);
    expect(parseMoneyInput('1e5').ok).toBe(false);
  });

  it('rejects zero unless explicitly allowed', () => {
    expect(parseMoneyInput('0').ok).toBe(false);
    expect(parseMoneyInput('0', { allowZero: true })).toEqual({ ok: true, value: 0 });
  });

  it('enforces the maximum amount', () => {
    expect(parseMoneyInput(String(MAX_AMOUNT)).ok).toBe(true);
    expect(parseMoneyInput(String(MAX_AMOUNT + 1)).ok).toBe(false);
  });
});

describe('parseQuantityInput', () => {
  it('requires whole numbers within bounds', () => {
    expect(parseQuantityInput('3')).toEqual({ ok: true, value: 3 });
    expect(parseQuantityInput('2.5').ok).toBe(false);
    expect(parseQuantityInput('0').ok).toBe(false);
    expect(parseQuantityInput('0', { min: 0 })).toEqual({ ok: true, value: 0 });
    expect(parseQuantityInput('-1').ok).toBe(false);
    expect(parseQuantityInput('10000001').ok).toBe(false);
  });
});

describe('formatINR', () => {
  it('uses Indian digit grouping', () => {
    expect(formatINR(125000)).toBe('₹1,25,000');
    expect(formatINR(99.5)).toBe('₹99.5');
  });
});
