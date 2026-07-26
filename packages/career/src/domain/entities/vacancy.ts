import { AggregateRoot } from '../base/aggregate-root.js';
import type { VacancyId, CompanyId } from '../base/identifier.js';
import { ExperienceLevel } from '../enums/experience-level.js';
import { Location } from '../value-objects/location.js';
import { Salary } from '../value-objects/salary.js';
import { Technology } from '../value-objects/technology.js';

interface VacancyProps {
  title: string;
  description: string;
  companyId: CompanyId;
  location: Location;
  salary?: Salary;
  experienceLevel: ExperienceLevel;
  employmentType?: string;
  technologies: Technology[];
  requirements: string[];
  responsibilities: string[];
  isActive: boolean;
  publishedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class Vacancy extends AggregateRoot<VacancyId> {
  private props: VacancyProps;

  private constructor(id: VacancyId, props: VacancyProps) {
    super(id);
    this.props = props;
  }

  static create(params: {
    id: VacancyId;
    title: string;
    description: string;
    companyId: CompanyId;
    location: Location;
    experienceLevel: ExperienceLevel;
    salary?: Salary;
    employmentType?: string;
    technologies?: Technology[];
    requirements?: string[];
    responsibilities?: string[];
  }): Vacancy {
    const now = new Date();

    return new Vacancy(params.id, {
      title: params.title.trim(),
      description: params.description.trim(),
      companyId: params.companyId,
      location: params.location,
      salary: params.salary,
      experienceLevel: params.experienceLevel,
      employmentType: params.employmentType,
      technologies: params.technologies ?? [],
      requirements: params.requirements ?? [],
      responsibilities: params.responsibilities ?? [],
      isActive: true,
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(id: VacancyId, props: VacancyProps): Vacancy {
    return new Vacancy(id, props);
  }

  get title(): string {
    return this.props.title;
  }

  get description(): string {
    return this.props.description;
  }

  get companyId(): CompanyId {
    return this.props.companyId;
  }

  get location(): Location {
    return this.props.location;
  }

  get salary(): Salary | undefined {
    return this.props.salary;
  }

  get experienceLevel(): ExperienceLevel {
    return this.props.experienceLevel;
  }

  get employmentType(): string | undefined {
    return this.props.employmentType;
  }

  get technologies(): ReadonlyArray<Technology> {
    return [...this.props.technologies];
  }

  get requirements(): ReadonlyArray<string> {
    return [...this.props.requirements];
  }

  get responsibilities(): ReadonlyArray<string> {
    return [...this.props.responsibilities];
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get publishedAt(): Date | undefined {
    return this.props.publishedAt;
  }

  get expiresAt(): Date | undefined {
    return this.props.expiresAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get isExpired(): boolean {
    if (!this.props.expiresAt) return false;
    return new Date() > this.props.expiresAt;
  }

  updateDescription(description: string): void {
    this.props.description = description.trim();
    this.touch();
  }

  updateSalary(salary: Salary): void {
    this.props.salary = salary;
    this.touch();
  }

  updateLocation(location: Location): void {
    this.props.location = location;
    this.touch();
  }

  addTechnology(technology: Technology): void {
    const exists = this.props.technologies.some((t) => t.equals(technology));

    if (!exists) {
      this.props.technologies.push(technology);
      this.touch();
    }
  }

  addRequirement(requirement: string): void {
    const trimmed = requirement.trim();

    if (trimmed.length > 0) {
      this.props.requirements.push(trimmed);
      this.touch();
    }
  }

  deactivate(): void {
    this.props.isActive = false;
    this.touch();
  }

  activate(): void {
    this.props.isActive = true;
    this.touch();
  }

  setExpiry(date: Date): void {
    this.props.expiresAt = date;
    this.touch();
  }

  private touch(): void {
    this.props.updatedAt = new Date();
    this.incrementVersion();
  }
}
