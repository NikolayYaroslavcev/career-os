import type { AtsType } from '../value-objects/ats-type.js';

export interface CompanyWatchProps {
  id: string;
  name: string;
  aliases: string[];
  country?: string;
  languages: string[];
  tags: string[];
  atsType: AtsType;
  careerUrl: string;
  atsEndpoint?: string;
  pollingInterval: number;
  active: boolean;
  lastSyncAt?: Date;
  lastSyncStatus?: string;
  lastSyncError?: string;
  metadata?: Record<string, unknown>;
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class CompanyWatch {
  private constructor(private readonly props: CompanyWatchProps) {}

  static create(props: Omit<CompanyWatchProps, 'createdAt' | 'updatedAt'>): CompanyWatch {
    const now = new Date();
    return new CompanyWatch({
      ...props,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: CompanyWatchProps): CompanyWatch {
    return new CompanyWatch(props);
  }

  get id(): string {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get aliases(): string[] {
    return this.props.aliases;
  }

  get country(): string | undefined {
    return this.props.country;
  }

  get languages(): string[] {
    return this.props.languages;
  }

  get tags(): string[] {
    return this.props.tags;
  }

  get atsType(): AtsType {
    return this.props.atsType;
  }

  get careerUrl(): string {
    return this.props.careerUrl;
  }

  get atsEndpoint(): string | undefined {
    return this.props.atsEndpoint;
  }

  get pollingInterval(): number {
    return this.props.pollingInterval;
  }

  get active(): boolean {
    return this.props.active;
  }

  get lastSyncAt(): Date | undefined {
    return this.props.lastSyncAt;
  }

  get lastSyncStatus(): string | undefined {
    return this.props.lastSyncStatus;
  }

  get lastSyncError(): string | undefined {
    return this.props.lastSyncError;
  }

  get metadata(): Record<string, unknown> | undefined {
    return this.props.metadata;
  }

  get workspaceId(): string {
    return this.props.workspaceId;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  updateSyncStatus(status: string, error?: string): void {
    this.props.lastSyncStatus = status;
    this.props.lastSyncAt = new Date();
    this.props.lastSyncError = error;
    this.props.updatedAt = new Date();
  }

  isActive(): boolean {
    return this.props.active;
  }

  shouldSync(): boolean {
    if (!this.props.lastSyncAt) return true;
    const elapsed = Date.now() - this.props.lastSyncAt.getTime();
    return elapsed >= this.props.pollingInterval * 1000;
  }

  toProps(): CompanyWatchProps {
    return { ...this.props };
  }
}
