import { AggregateRoot } from '../base/aggregate-root.js';
import type { VacancySourceId, VacancyId } from '../base/identifier.js';
import type { VacancySource } from '../enums/vacancy-source.js';
import type { ProviderType } from '../enums/provider-type.js';
import type { SourceStatus } from '../enums/source-status.js';
import { BaseDomainEvent } from '../base/domain-event.js';

interface SourceProps {
  vacancyId: VacancyId;
  providerType: ProviderType;
  providerId: VacancySource;
  externalId: string;
  sourceUrl?: string;
  applyUrl?: string;
  status: SourceStatus;
  discoveredAt: Date;
  lastSeenAt: Date;
  isPrimary: boolean;
  metadata?: Record<string, unknown>;
  lastSuccessfulSync?: Date;
  lastFailedSync?: Date;
  failureCount: number;
}

export class SourceDiscoveredEvent extends BaseDomainEvent {
  readonly vacancyId: string;
  readonly providerId: string;
  readonly externalId: string;

  constructor(aggregateId: string, vacancyId: string, providerId: string, externalId: string) {
    super('SourceDiscovered', aggregateId);
    this.vacancyId = vacancyId;
    this.providerId = providerId;
    this.externalId = externalId;
  }
}

export class Source extends AggregateRoot<VacancySourceId> {
  private props: SourceProps;

  private constructor(id: VacancySourceId, props: SourceProps) {
    super(id);
    this.props = props;
  }

  static create(params: {
    id: VacancySourceId;
    vacancyId: VacancyId;
    providerType: ProviderType;
    providerId: VacancySource;
    externalId: string;
    sourceUrl?: string;
    applyUrl?: string;
    isPrimary?: boolean;
    metadata?: Record<string, unknown>;
  }): Source {
    const now = new Date();

    const source = new Source(params.id, {
      vacancyId: params.vacancyId,
      providerType: params.providerType,
      providerId: params.providerId,
      externalId: params.externalId,
      sourceUrl: params.sourceUrl,
      applyUrl: params.applyUrl,
      status: 'ACTIVE' as SourceStatus,
      discoveredAt: now,
      lastSeenAt: now,
      isPrimary: params.isPrimary ?? false,
      metadata: params.metadata,
      failureCount: 0,
    });

    source.addDomainEvent(
      new SourceDiscoveredEvent(
        params.id,
        params.vacancyId,
        params.providerId,
        params.externalId
      )
    );

    return source;
  }

  static reconstitute(id: VacancySourceId, props: SourceProps): Source {
    return new Source(id, props);
  }

  get vacancyId(): VacancyId {
    return this.props.vacancyId;
  }

  get providerType(): ProviderType {
    return this.props.providerType;
  }

  get providerId(): VacancySource {
    return this.props.providerId;
  }

  get externalId(): string {
    return this.props.externalId;
  }

  get sourceUrl(): string | undefined {
    return this.props.sourceUrl;
  }

  get applyUrl(): string | undefined {
    return this.props.applyUrl;
  }

  get status(): SourceStatus {
    return this.props.status;
  }

  get discoveredAt(): Date {
    return this.props.discoveredAt;
  }

  get lastSeenAt(): Date {
    return this.props.lastSeenAt;
  }

  get isPrimary(): boolean {
    return this.props.isPrimary;
  }

  get metadata(): Record<string, unknown> | undefined {
    return this.props.metadata;
  }

  get lastSuccessfulSync(): Date | undefined {
    return this.props.lastSuccessfulSync;
  }

  get lastFailedSync(): Date | undefined {
    return this.props.lastFailedSync;
  }

  get failureCount(): number {
    return this.props.failureCount;
  }

  get isActive(): boolean {
    return this.props.status === 'ACTIVE';
  }

  updateLastSeen(): void {
    this.props.lastSeenAt = new Date();
    this.touch();
  }

  setPrimary(): void {
    this.props.isPrimary = true;
    this.touch();
  }

  unsetPrimary(): void {
    this.props.isPrimary = false;
    this.touch();
  }

  updateSourceUrl(url: string): void {
    this.props.sourceUrl = url;
    this.touch();
  }

  updateApplyUrl(url: string): void {
    this.props.applyUrl = url;
    this.touch();
  }

  updateMetadata(metadata: Record<string, unknown>): void {
    this.props.metadata = metadata;
    this.touch();
  }

  updateStatus(status: SourceStatus): void {
    this.props.status = status;
    this.touch();
  }

  recordSyncSuccess(): void {
    this.props.lastSuccessfulSync = new Date();
    this.props.lastSeenAt = new Date();
    this.props.failureCount = 0;
    this.props.status = 'ACTIVE' as SourceStatus;
    this.touch();
  }

  recordSyncFailure(): void {
    this.props.lastFailedSync = new Date();
    this.props.failureCount += 1;
    if (this.props.failureCount >= 3) {
      this.props.status = 'BROKEN' as SourceStatus;
    }
    this.touch();
  }

  markExpired(): void {
    this.props.status = 'EXPIRED' as SourceStatus;
    this.touch();
  }

  markRemoved(): void {
    this.props.status = 'REMOVED' as SourceStatus;
    this.touch();
  }

  private touch(): void {
    this.incrementVersion();
  }
}
