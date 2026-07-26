import { AggregateRoot } from '../base/aggregate-root.js';
import type { CompanyId } from '../base/identifier.js';
import { Url } from '../value-objects/url.js';

interface CompanyProps {
  name: string;
  description?: string;
  website?: Url;
  logoUrl?: Url;
  industry?: string;
  size?: string;
  headquarters?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Company extends AggregateRoot<CompanyId> {
  private props: CompanyProps;

  private constructor(id: CompanyId, props: CompanyProps) {
    super(id);
    this.props = props;
  }

  static create(params: {
    id: CompanyId;
    name: string;
    description?: string;
    website?: Url;
    logoUrl?: Url;
    industry?: string;
    size?: string;
    headquarters?: string;
  }): Company {
    const now = new Date();

    return new Company(params.id, {
      name: params.name.trim(),
      description: params.description?.trim(),
      website: params.website,
      logoUrl: params.logoUrl,
      industry: params.industry?.trim(),
      size: params.size?.trim(),
      headquarters: params.headquarters?.trim(),
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(id: CompanyId, props: CompanyProps): Company {
    return new Company(id, props);
  }

  get name(): string {
    return this.props.name;
  }

  get description(): string | undefined {
    return this.props.description;
  }

  get website(): Url | undefined {
    return this.props.website;
  }

  get logoUrl(): Url | undefined {
    return this.props.logoUrl;
  }

  get industry(): string | undefined {
    return this.props.industry;
  }

  get size(): string | undefined {
    return this.props.size;
  }

  get headquarters(): string | undefined {
    return this.props.headquarters;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  updateInfo(params: {
    description?: string;
    website?: Url;
    logoUrl?: Url;
    industry?: string;
    size?: string;
    headquarters?: string;
  }): void {
    if (params.description !== undefined) this.props.description = params.description.trim();
    if (params.website !== undefined) this.props.website = params.website;
    if (params.logoUrl !== undefined) this.props.logoUrl = params.logoUrl;
    if (params.industry !== undefined) this.props.industry = params.industry.trim();
    if (params.size !== undefined) this.props.size = params.size.trim();
    if (params.headquarters !== undefined) this.props.headquarters = params.headquarters.trim();
    this.touch();
  }

  private touch(): void {
    this.props.updatedAt = new Date();
    this.incrementVersion();
  }
}
