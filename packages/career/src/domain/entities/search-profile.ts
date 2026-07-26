import { AggregateRoot } from '../base/aggregate-root.js';
import type { SearchProfileId, UserId } from '../base/identifier.js';
import { ExperienceLevel } from '../enums/experience-level.js';
import { Location } from '../value-objects/location.js';
import { Salary } from '../value-objects/salary.js';
import { Technology } from '../value-objects/technology.js';

interface SearchProfileProps {
  userId: UserId;
  name: string;
  desiredPositions: string[];
  desiredTechnologies: Technology[];
  experienceLevel: ExperienceLevel;
  desiredSalary?: Salary;
  desiredLocations: Location[];
  isRemoteOnly: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class SearchProfile extends AggregateRoot<SearchProfileId> {
  private props: SearchProfileProps;

  private constructor(id: SearchProfileId, props: SearchProfileProps) {
    super(id);
    this.props = props;
  }

  static create(params: {
    id: SearchProfileId;
    userId: UserId;
    name: string;
    desiredPositions?: string[];
    desiredTechnologies?: Technology[];
    experienceLevel: ExperienceLevel;
    desiredSalary?: Salary;
    desiredLocations?: Location[];
    isRemoteOnly?: boolean;
  }): SearchProfile {
    const now = new Date();

    return new SearchProfile(params.id, {
      userId: params.userId,
      name: params.name.trim(),
      desiredPositions: params.desiredPositions ?? [],
      desiredTechnologies: params.desiredTechnologies ?? [],
      experienceLevel: params.experienceLevel,
      desiredSalary: params.desiredSalary,
      desiredLocations: params.desiredLocations ?? [],
      isRemoteOnly: params.isRemoteOnly ?? false,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(id: SearchProfileId, props: SearchProfileProps): SearchProfile {
    return new SearchProfile(id, props);
  }

  get userId(): UserId {
    return this.props.userId;
  }

  get name(): string {
    return this.props.name;
  }

  get desiredPositions(): ReadonlyArray<string> {
    return [...this.props.desiredPositions];
  }

  get desiredTechnologies(): ReadonlyArray<Technology> {
    return [...this.props.desiredTechnologies];
  }

  get experienceLevel(): ExperienceLevel {
    return this.props.experienceLevel;
  }

  get desiredSalary(): Salary | undefined {
    return this.props.desiredSalary;
  }

  get desiredLocations(): ReadonlyArray<Location> {
    return [...this.props.desiredLocations];
  }

  get isRemoteOnly(): boolean {
    return this.props.isRemoteOnly;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  updateName(name: string): void {
    this.props.name = name.trim();
    this.touch();
  }

  addDesiredPosition(position: string): void {
    const trimmed = position.trim();

    if (trimmed.length > 0 && !this.props.desiredPositions.includes(trimmed)) {
      this.props.desiredPositions.push(trimmed);
      this.touch();
    }
  }

  removeDesiredPosition(position: string): void {
    const index = this.props.desiredPositions.indexOf(position.trim());

    if (index !== -1) {
      this.props.desiredPositions.splice(index, 1);
      this.touch();
    }
  }

  addDesiredTechnology(technology: Technology): void {
    const exists = this.props.desiredTechnologies.some((t) => t.equals(technology));

    if (!exists) {
      this.props.desiredTechnologies.push(technology);
      this.touch();
    }
  }

  removeDesiredTechnology(technology: Technology): void {
    const index = this.props.desiredTechnologies.findIndex((t) => t.equals(technology));

    if (index !== -1) {
      this.props.desiredTechnologies.splice(index, 1);
      this.touch();
    }
  }

  updateExperienceLevel(level: ExperienceLevel): void {
    this.props.experienceLevel = level;
    this.touch();
  }

  updateDesiredSalary(salary: Salary): void {
    this.props.desiredSalary = salary;
    this.touch();
  }

  addDesiredLocation(location: Location): void {
    this.props.desiredLocations.push(location);
    this.touch();
  }

  removeDesiredLocation(index: number): void {
    if (index >= 0 && index < this.props.desiredLocations.length) {
      this.props.desiredLocations.splice(index, 1);
      this.touch();
    }
  }

  setRemoteOnly(remoteOnly: boolean): void {
    this.props.isRemoteOnly = remoteOnly;
    this.touch();
  }

  activate(): void {
    this.props.isActive = true;
    this.touch();
  }

  deactivate(): void {
    this.props.isActive = false;
    this.touch();
  }

  private touch(): void {
    this.props.updatedAt = new Date();
    this.incrementVersion();
  }
}
