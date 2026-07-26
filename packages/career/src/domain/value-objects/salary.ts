import { ValueObject } from '../base/value-object.js';

type Currency = 'USD' | 'EUR' | 'GBP' | 'UAH' | 'RUB';

interface SalaryProps {
  min: number;
  max: number;
  currency: Currency;
  period: 'monthly' | 'yearly' | 'hourly';
}

export class Salary extends ValueObject<SalaryProps> {
  private constructor(props: SalaryProps) {
    super(props);
  }

  static create(min: number, max: number, currency: Currency, period: SalaryProps['period']): Salary {
    if (min < 0 || max < 0) {
      throw new Error('Salary cannot be negative');
    }

    if (min > max) {
      throw new Error('Minimum salary cannot exceed maximum salary');
    }

    return new Salary({ min, max, currency, period });
  }

  static createExact(amount: number, currency: Currency, period: SalaryProps['period']): Salary {
    return Salary.create(amount, amount, currency, period);
  }

  get min(): number {
    return this.props.min;
  }

  get max(): number {
    return this.props.max;
  }

  get currency(): Currency {
    return this.props.currency;
  }

  get period(): SalaryProps['period'] {
    return this.props.period;
  }

  get isRange(): boolean {
    return this.props.min !== this.props.max;
  }

  get average(): number {
    return (this.props.min + this.props.max) / 2;
  }

  normalizeToYearly(): { min: number; max: number; currency: Currency } {
    const multipliers: Record<SalaryProps['period'], number> = {
      monthly: 12,
      yearly: 1,
      hourly: 2080,
    };

    const multiplier = multipliers[this.props.period];

    return {
      min: this.props.min * multiplier,
      max: this.props.max * multiplier,
      currency: this.props.currency,
    };
  }

  toString(): string {
    if (this.props.min === this.props.max) {
      return `${this.props.min} ${this.props.currency}`;
    }
    return `${this.props.min}-${this.props.max} ${this.props.currency}`;
  }
}
