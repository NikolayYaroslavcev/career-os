import { AggregateRoot } from '../base/aggregate-root.js';
import type { ResumeId, UserId } from '../base/identifier.js';
import { ResumeFormat } from '../enums/resume-format.js';
import { ResumeVersionStatus } from '../enums/resume-version-status.js';
import { Skill } from '../value-objects/skill.js';
import { Technology } from '../value-objects/technology.js';

interface ResumeExperience {
  company: string;
  position: string;
  startDate: Date;
  endDate?: Date;
  description: string;
  technologies: Technology[];
}

interface ResumeEducation {
  institution: string;
  degree: string;
  field: string;
  startDate: Date;
  endDate?: Date;
}

interface ResumeProps {
  userId: UserId;
  title: string;
  summary: string;
  description: string;
  language?: string;
  tags: string[];
  status: ResumeVersionStatus;
  skills: Skill[];
  technologies: Technology[];
  experience: ResumeExperience[];
  education: ResumeEducation[];
  format: ResumeFormat;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  rawText?: string;
}

export class Resume extends AggregateRoot<ResumeId> {
  private props: ResumeProps;

  private constructor(id: ResumeId, props: ResumeProps) {
    super(id);
    this.props = props;
  }

  static create(params: {
    id: ResumeId;
    userId: UserId;
    title: string;
    summary?: string;
    description?: string;
    language?: string;
    tags?: string[];
    status?: ResumeVersionStatus;
    format?: ResumeFormat;
    rawText?: string;
  }): Resume {
    const now = new Date();

    return new Resume(params.id, {
      userId: params.userId,
      title: params.title.trim(),
      summary: params.summary?.trim() ?? '',
      description: params.description?.trim() ?? '',
      language: params.language?.trim(),
      tags: params.tags ? [...params.tags] : [],
      status: params.status ?? ResumeVersionStatus.ACTIVE,
      skills: [],
      technologies: [],
      experience: [],
      education: [],
      format: params.format ?? ResumeFormat.JSON,
      isDefault: false,
      createdAt: now,
      updatedAt: now,
      rawText: params.rawText,
    });
  }

  static reconstitute(id: ResumeId, props: ResumeProps): Resume {
    return new Resume(id, props);
  }

  get userId(): UserId {
    return this.props.userId;
  }

  get title(): string {
    return this.props.title;
  }

  get summary(): string {
    return this.props.summary;
  }

  get description(): string {
    return this.props.description;
  }

  get language(): string | undefined {
    return this.props.language;
  }

  get tags(): ReadonlyArray<string> {
    return [...this.props.tags];
  }

  get status(): ResumeVersionStatus {
    return this.props.status;
  }

  get rawText(): string | undefined {
    return this.props.rawText;
  }

  get skills(): ReadonlyArray<Skill> {
    return [...this.props.skills];
  }

  get technologies(): ReadonlyArray<Technology> {
    return [...this.props.technologies];
  }

  get experience(): ReadonlyArray<ResumeExperience> {
    return [...this.props.experience];
  }

  get education(): ReadonlyArray<ResumeEducation> {
    return [...this.props.education];
  }

  get format(): ResumeFormat {
    return this.props.format;
  }

  get isDefault(): boolean {
    return this.props.isDefault;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get totalYearsOfExperience(): number {
    if (this.props.experience.length === 0) return 0;

    const first = this.props.experience[0];
    if (!first) return 0;

    const earliest = this.props.experience.reduce(
      (earliest, exp) => (exp.startDate < earliest ? exp.startDate : earliest),
      first.startDate
    );

    const now = new Date();
    const diffMs = now.getTime() - earliest.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365));
  }

  updateTitle(title: string): void {
    this.props.title = title.trim();
    this.touch();
  }

  updateSummary(summary: string): void {
    this.props.summary = summary.trim();
    this.touch();
  }

  updateDescription(description: string): void {
    this.props.description = description.trim();
    this.touch();
  }

  updateLanguage(language: string): void {
    this.props.language = language.trim();
    this.touch();
  }

  setTags(tags: readonly string[]): void {
    this.props.tags = [...tags];
    this.touch();
  }

  updateStatus(status: ResumeVersionStatus): void {
    this.props.status = status;
    this.touch();
  }

  addSkill(skill: Skill): void {
    const exists = this.props.skills.some((s) => s.equals(skill));

    if (!exists) {
      this.props.skills.push(skill);
      this.touch();
    }
  }

  removeSkill(skill: Skill): void {
    const index = this.props.skills.findIndex((s) => s.equals(skill));

    if (index !== -1) {
      this.props.skills.splice(index, 1);
      this.touch();
    }
  }

  addTechnology(technology: Technology): void {
    const exists = this.props.technologies.some((t) => t.equals(technology));

    if (!exists) {
      this.props.technologies.push(technology);
      this.touch();
    }
  }

  removeTechnology(technology: Technology): void {
    const index = this.props.technologies.findIndex((t) => t.equals(technology));

    if (index !== -1) {
      this.props.technologies.splice(index, 1);
      this.touch();
    }
  }

  addExperience(experience: ResumeExperience): void {
    this.props.experience.push(experience);
    this.touch();
  }

  removeExperience(index: number): void {
    if (index >= 0 && index < this.props.experience.length) {
      this.props.experience.splice(index, 1);
      this.touch();
    }
  }

  addEducation(education: ResumeEducation): void {
    this.props.education.push(education);
    this.touch();
  }

  removeEducation(index: number): void {
    if (index >= 0 && index < this.props.education.length) {
      this.props.education.splice(index, 1);
      this.touch();
    }
  }

  setAsDefault(): void {
    this.props.isDefault = true;
    this.touch();
  }

  unsetAsDefault(): void {
    this.props.isDefault = false;
    this.touch();
  }

  private touch(): void {
    this.props.updatedAt = new Date();
    this.incrementVersion();
  }
}
