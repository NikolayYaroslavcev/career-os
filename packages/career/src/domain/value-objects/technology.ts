import { ValueObject } from '../base/value-object.js';

type TechnologyCategory =
  | 'language'
  | 'framework'
  | 'library'
  | 'database'
  | 'tool'
  | 'cloud'
  | 'methodology'
  | 'other';

interface TechnologyProps {
  name: string;
  category: TechnologyCategory;
  version?: string;
}

export class Technology extends ValueObject<TechnologyProps> {
  private constructor(props: TechnologyProps) {
    super(props);
  }

  static create(name: string, category: TechnologyCategory, version?: string): Technology {
    const trimmed = name.trim();

    if (trimmed.length === 0) {
      throw new Error('Technology name cannot be empty');
    }

    if (trimmed.length > 100) {
      throw new Error('Technology name is too long');
    }

    return new Technology({
      name: trimmed,
      category,
      version,
    });
  }

  get name(): string {
    return this.props.name;
  }

  get category(): TechnologyCategory {
    return this.props.category;
  }

  get version(): string | undefined {
    return this.props.version;
  }

  toString(): string {
    if (this.props.version) {
      return `${this.props.name} ${this.props.version}`;
    }
    return this.props.name;
  }
}
