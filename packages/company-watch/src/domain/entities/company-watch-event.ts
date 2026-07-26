export type CompanyWatchEventType = 'NEW_JOB' | 'REMOVED_JOB' | 'CHANGED_JOB';

export interface CompanyWatchEventProps {
  id: string;
  type: CompanyWatchEventType;
  externalId?: string;
  title?: string;
  description?: string;
  url?: string;
  location?: string;
  salary?: { min?: number; max?: number; currency?: string };
  technologies: string[];
  publishedAt?: Date;
  detectedAt: Date;
  processed: boolean;
  notifiedAt?: Date;
  metadata?: Record<string, unknown>;
  companyWatchId: string;
}

export class CompanyWatchEvent {
  private constructor(private readonly props: CompanyWatchEventProps) {}

  static create(props: Omit<CompanyWatchEventProps, 'detectedAt' | 'processed'>): CompanyWatchEvent {
    return new CompanyWatchEvent({
      ...props,
      detectedAt: new Date(),
      processed: false,
    });
  }

  static reconstitute(props: CompanyWatchEventProps): CompanyWatchEvent {
    return new CompanyWatchEvent(props);
  }

  get id(): string {
    return this.props.id;
  }

  get type(): CompanyWatchEventType {
    return this.props.type;
  }

  get externalId(): string | undefined {
    return this.props.externalId;
  }

  get title(): string | undefined {
    return this.props.title;
  }

  get description(): string | undefined {
    return this.props.description;
  }

  get url(): string | undefined {
    return this.props.url;
  }

  get location(): string | undefined {
    return this.props.location;
  }

  get salary(): { min?: number; max?: number; currency?: string } | undefined {
    return this.props.salary;
  }

  get technologies(): string[] {
    return this.props.technologies;
  }

  get publishedAt(): Date | undefined {
    return this.props.publishedAt;
  }

  get detectedAt(): Date {
    return this.props.detectedAt;
  }

  get processed(): boolean {
    return this.props.processed;
  }

  get notifiedAt(): Date | undefined {
    return this.props.notifiedAt;
  }

  get metadata(): Record<string, unknown> | undefined {
    return this.props.metadata;
  }

  get companyWatchId(): string {
    return this.props.companyWatchId;
  }

  markProcessed(): void {
    this.props.processed = true;
  }

  markNotified(): void {
    this.props.notifiedAt = new Date();
  }

  toProps(): CompanyWatchEventProps {
    return { ...this.props };
  }
}
