import { ValueObject } from '../base/value-object.js';

type WorkMode = 'remote' | 'hybrid' | 'onsite';

interface LocationProps {
  city?: string;
  country?: string;
  workMode: WorkMode;
  isRelocationPossible: boolean;
}

export class Location extends ValueObject<LocationProps> {
  private constructor(props: LocationProps) {
    super(props);
  }

  static create(params: {
    city?: string;
    country?: string;
    workMode: WorkMode;
    isRelocationPossible?: boolean;
  }): Location {
    return new Location({
      city: params.city?.trim(),
      country: params.country?.trim(),
      workMode: params.workMode,
      isRelocationPossible: params.isRelocationPossible ?? false,
    });
  }

  get city(): string | undefined {
    return this.props.city;
  }

  get country(): string | undefined {
    return this.props.country;
  }

  get workMode(): WorkMode {
    return this.props.workMode;
  }

  get isRelocationPossible(): boolean {
    return this.props.isRelocationPossible;
  }

  get isRemote(): boolean {
    return this.props.workMode === 'remote';
  }

  get hasGeographicRestriction(): boolean {
    return this.props.workMode !== 'remote' && !this.props.isRelocationPossible;
  }

  toString(): string {
    const parts: string[] = [];

    if (this.props.city) parts.push(this.props.city);
    if (this.props.country) parts.push(this.props.country);

    const location = parts.length > 0 ? parts.join(', ') : 'Unspecified';
    return `${location} (${this.props.workMode})`;
  }
}
