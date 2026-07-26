import { describe, it, expect } from 'vitest';
import { Salary } from './salary.js';

describe('Salary', () => {
  it('should create a salary range', () => {
    const salary = Salary.create(50000, 80000, 'USD', 'yearly');
    expect(salary.min).toBe(50000);
    expect(salary.max).toBe(80000);
    expect(salary.currency).toBe('USD');
    expect(salary.period).toBe('yearly');
  });

  it('should create an exact salary', () => {
    const salary = Salary.createExact(60000, 'EUR', 'yearly');
    expect(salary.min).toBe(60000);
    expect(salary.max).toBe(60000);
    expect(salary.isRange).toBe(false);
  });

  it('should calculate average', () => {
    const salary = Salary.create(40000, 60000, 'USD', 'yearly');
    expect(salary.average).toBe(50000);
  });

  it('should normalize monthly to yearly', () => {
    const salary = Salary.create(5000, 8000, 'USD', 'monthly');
    const yearly = salary.normalizeToYearly();
    expect(yearly.min).toBe(60000);
    expect(yearly.max).toBe(96000);
  });

  it('should throw on negative values', () => {
    expect(() => Salary.create(-1000, 50000, 'USD', 'yearly')).toThrow('Salary cannot be negative');
  });

  it('should throw when min exceeds max', () => {
    expect(() => Salary.create(80000, 50000, 'USD', 'yearly')).toThrow('Minimum salary cannot exceed maximum');
  });

  it('should throw on equal min and max for range', () => {
    const salary = Salary.create(50000, 50000, 'USD', 'yearly');
    expect(salary.isRange).toBe(false);
  });

  it('should convert to string', () => {
    const range = Salary.create(50000, 80000, 'USD', 'yearly');
    expect(range.toString()).toBe('50000-80000 USD');

    const exact = Salary.createExact(60000, 'EUR', 'yearly');
    expect(exact.toString()).toBe('60000 EUR');
  });
});
