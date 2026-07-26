import { ValueObject } from '../base/value-object.js';

interface EmailProps {
  value: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class Email extends ValueObject<EmailProps> {
  private constructor(props: EmailProps) {
    super(props);
  }

  static create(email: string): Email {
    const trimmed = email.trim().toLowerCase();

    if (trimmed.length === 0) {
      throw new Error('Email cannot be empty');
    }

    if (trimmed.length > 254) {
      throw new Error('Email is too long');
    }

    if (!EMAIL_REGEX.test(trimmed)) {
      throw new Error('Invalid email format');
    }

    return new Email({ value: trimmed });
  }

  get value(): string {
    return this.props.value;
  }

  get domain(): string {
    return this.props.value.split('@')[1] ?? '';
  }

  get localPart(): string {
    return this.props.value.split('@')[0] ?? '';
  }

  toString(): string {
    return this.props.value;
  }
}
