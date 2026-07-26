import { ValueObject } from '../base/value-object.js';

interface UrlProps {
  value: string;
}

const URL_REGEX = /^https?:\/\/.+/;

export class Url extends ValueObject<UrlProps> {
  private constructor(props: UrlProps) {
    super(props);
  }

  static create(url: string): Url {
    const trimmed = url.trim();

    if (trimmed.length === 0) {
      throw new Error('URL cannot be empty');
    }

    if (trimmed.length > 2048) {
      throw new Error('URL is too long');
    }

    if (!URL_REGEX.test(trimmed)) {
      throw new Error('Invalid URL format');
    }

    return new Url({ value: trimmed });
  }

  get value(): string {
    return this.props.value;
  }

  get hostname(): string {
    const match = this.props.value.match(/^https?:\/\/([^/]+)/);
    return match?.[1] ?? '';
  }

  get pathname(): string {
    const match = this.props.value.match(/^https?:\/\/[^/]+(\/.*)/);
    return match?.[1] ?? '/';
  }

  toString(): string {
    return this.props.value;
  }
}
