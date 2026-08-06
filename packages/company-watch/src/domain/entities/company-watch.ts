import type { AtsType } from '../value-objects/ats-type.js';
import {
  type CompanyWatchHealthStatus,
  deriveNextHealthStatus,
  computePriorityScore,
  derivePollingIntervalSeconds,
} from '../health.js';

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
  consecutiveFailureCount: number;
  healthStatus: CompanyWatchHealthStatus;
  priorityScore: number;
  lastSuccessfulSyncAt?: Date;
}

export class CompanyWatch {
  private constructor(private readonly props: CompanyWatchProps) {}

  static create(
    props: Omit<
      CompanyWatchProps,
      'createdAt' | 'updatedAt' | 'consecutiveFailureCount' | 'healthStatus' | 'priorityScore'
    >
  ): CompanyWatch {
    const now = new Date();
    return new CompanyWatch({
      ...props,
      createdAt: now,
      updatedAt: now,
      consecutiveFailureCount: 0,
      healthStatus: 'ACTIVE',
      priorityScore: 50,
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

  get consecutiveFailureCount(): number {
    return this.props.consecutiveFailureCount;
  }

  get healthStatus(): CompanyWatchHealthStatus {
    return this.props.healthStatus;
  }

  get priorityScore(): number {
    return this.props.priorityScore;
  }

  get lastSuccessfulSyncAt(): Date | undefined {
    return this.props.lastSuccessfulSyncAt;
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

  /**
   * ADR-035 §7/§9: on a successful sync, resets the failure count, recomputes
   * priorityScore from trailing NEW_JOB velocity, and derives pollingInterval
   * from the new priority — a manually-set pollingInterval is superseded here
   * by design (confirmed with the team: priorityScore drives pollingInterval
   * directly, not just advisory).
   */
  recordSyncSuccess(newJobsInTrailingWindow: number): void {
    this.props.consecutiveFailureCount = 0;
    this.props.healthStatus = this.props.healthStatus === 'RETIRED' ? 'RETIRED' : 'ACTIVE';
    this.props.lastSuccessfulSyncAt = new Date();
    this.props.priorityScore = computePriorityScore(newJobsInTrailingWindow);
    this.props.pollingInterval = derivePollingIntervalSeconds(this.props.priorityScore, this.props.healthStatus);
    this.props.updatedAt = new Date();
  }

  /**
   * ADR-035 §7/§8: mirrors Source.recordSyncFailure (VacancySource, ADR-030),
   * extended with the ACTIVE/DEGRADED/BROKEN split and structural-failure
   * fast-track this ADR adds on top of that precedent.
   */
  recordSyncFailure(isStructuralFailure: boolean): void {
    this.props.consecutiveFailureCount += 1;
    this.props.healthStatus = deriveNextHealthStatus({
      currentStatus: this.props.healthStatus,
      consecutiveFailureCount: this.props.consecutiveFailureCount,
      isStructuralFailure,
    });
    this.props.pollingInterval = derivePollingIntervalSeconds(this.props.priorityScore, this.props.healthStatus);
    this.props.updatedAt = new Date();
  }

  /** ADR-035 §8: BROKEN for >=14 continuous days -> RETIRED, active=false. */
  retire(): void {
    this.props.healthStatus = 'RETIRED';
    this.props.active = false;
    this.props.pollingInterval = derivePollingIntervalSeconds(this.props.priorityScore, 'RETIRED');
    this.props.updatedAt = new Date();
  }

  toProps(): CompanyWatchProps {
    return { ...this.props };
  }
}
