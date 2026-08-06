import { AggregateRoot } from '../base/aggregate-root.js';
import type { ResumeId, StructuredResumeId } from '../base/identifier.js';

export interface StructuredResumeExperience {
  readonly company: string;
  readonly position: string;
  readonly startDate: Date;
  readonly endDate?: Date;
  readonly description: string;
  /**
   * Individual achievement/responsibility lines, extracted separately from
   * `description` (ADR-031) so the resume-tailoring pipeline can trace each
   * generated bullet back to a specific source line instead of only a
   * job-level blob. Empty when extracted before this field existed.
   */
  readonly bullets: readonly string[];
  readonly technologies: readonly string[];
}

export interface StructuredResumeEducation {
  readonly institution: string;
  readonly degree: string;
  readonly field: string;
  readonly startDate: Date;
  readonly endDate?: Date;
}

export type ExtractionStatus = 'pending' | 'completed' | 'failed';

export interface StructuredResumeProps {
  resumeId: ResumeId;
  sourceHash: string;
  extractionVersion: string;
  extractionModel?: string;
  extractionStatus: ExtractionStatus;
  failureReason?: string;
  extractedAt?: Date;
  summary?: string;
  seniorityLevel?: string;
  totalYearsOfExperience?: number;
  skills: readonly string[];
  technologies: readonly string[];
  experience: readonly StructuredResumeExperience[];
  education: readonly StructuredResumeEducation[];
  /** ADR-031 — empty on rows extracted before this field existed. */
  certifications: readonly string[];
  /** ADR-031 — empty on rows extracted before this field existed. */
  languages: readonly string[];
  createdAt: Date;
  updatedAt: Date;
}

export class StructuredResume extends AggregateRoot<StructuredResumeId> {
  private props: StructuredResumeProps;

  private constructor(id: StructuredResumeId, props: StructuredResumeProps) {
    super(id);
    this.props = props;
  }

  static create(params: {
    id: StructuredResumeId;
    resumeId: ResumeId;
    sourceHash: string;
    extractionVersion: string;
    extractionModel?: string;
  }): StructuredResume {
    const now = new Date();
    return new StructuredResume(params.id, {
      resumeId: params.resumeId,
      sourceHash: params.sourceHash,
      extractionVersion: params.extractionVersion,
      extractionModel: params.extractionModel,
      extractionStatus: 'pending',
      skills: [],
      technologies: [],
      experience: [],
      education: [],
      certifications: [],
      languages: [],
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(id: StructuredResumeId, props: StructuredResumeProps): StructuredResume {
    return new StructuredResume(id, props);
  }

  get resumeId(): ResumeId {
    return this.props.resumeId;
  }

  get sourceHash(): string {
    return this.props.sourceHash;
  }

  get extractionVersion(): string {
    return this.props.extractionVersion;
  }

  get extractionModel(): string | undefined {
    return this.props.extractionModel;
  }

  get extractionStatus(): ExtractionStatus {
    return this.props.extractionStatus;
  }

  get failureReason(): string | undefined {
    return this.props.failureReason;
  }

  get extractedAt(): Date | undefined {
    return this.props.extractedAt;
  }

  get summary(): string | undefined {
    return this.props.summary;
  }

  get seniorityLevel(): string | undefined {
    return this.props.seniorityLevel;
  }

  get totalYearsOfExperience(): number | undefined {
    return this.props.totalYearsOfExperience;
  }

  get skills(): readonly string[] {
    return this.props.skills;
  }

  get technologies(): readonly string[] {
    return this.props.technologies;
  }

  get experience(): readonly StructuredResumeExperience[] {
    return this.props.experience;
  }

  get education(): readonly StructuredResumeEducation[] {
    return this.props.education;
  }

  get certifications(): readonly string[] {
    return this.props.certifications;
  }

  get languages(): readonly string[] {
    return this.props.languages;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  isFreshFor(currentRawTextHash: string, currentExtractionVersion: string): boolean {
    return (
      this.props.extractionStatus === 'completed' &&
      this.props.sourceHash === currentRawTextHash &&
      this.props.extractionVersion === currentExtractionVersion
    );
  }

  markCompleted(data: {
    summary: string;
    seniorityLevel: string;
    totalYearsOfExperience: number;
    skills: readonly string[];
    technologies: readonly string[];
    experience: readonly StructuredResumeExperience[];
    education: readonly StructuredResumeEducation[];
    certifications?: readonly string[];
    languages?: readonly string[];
    extractionModel?: string;
  }): void {
    this.props.extractionStatus = 'completed';
    this.props.summary = data.summary;
    this.props.seniorityLevel = data.seniorityLevel;
    this.props.totalYearsOfExperience = data.totalYearsOfExperience;
    this.props.skills = data.skills;
    this.props.technologies = data.technologies;
    this.props.experience = data.experience;
    this.props.education = data.education;
    this.props.certifications = data.certifications ?? [];
    this.props.languages = data.languages ?? [];
    this.props.extractedAt = new Date();
    if (data.extractionModel) {
      this.props.extractionModel = data.extractionModel;
    }
    this.props.updatedAt = new Date();
    this.incrementVersion();
  }

  markFailed(reason: string): void {
    this.props.extractionStatus = 'failed';
    this.props.failureReason = reason;
    this.props.updatedAt = new Date();
    this.incrementVersion();
  }
}
