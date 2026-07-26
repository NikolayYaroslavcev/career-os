import { AggregateRoot } from '../base/aggregate-root.js';
import type { RecruiterId, CompanyId } from '../base/identifier.js';
import { Email } from '../value-objects/email.js';

interface RecruiterProps {
  name: string;
  email?: Email;
  phone?: string;
  linkedinUrl?: string;
  notes?: string;
  companyId?: CompanyId;
  createdAt: Date;
  updatedAt: Date;
}

export class Recruiter extends AggregateRoot<RecruiterId> {
  private props: RecruiterProps;

  private constructor(id: RecruiterId, props: RecruiterProps) {
    super(id);
    this.props = props;
  }

  static create(params: {
    id: RecruiterId;
    name: string;
    email?: Email;
    phone?: string;
    linkedinUrl?: string;
    notes?: string;
    companyId?: CompanyId;
  }): Recruiter {
    const name = params.name.trim();

    if (name.length === 0) {
      throw new Error('Recruiter name cannot be empty');
    }

    const now = new Date();

    return new Recruiter(params.id, {
      name,
      email: params.email,
      phone: params.phone?.trim(),
      linkedinUrl: params.linkedinUrl?.trim(),
      notes: params.notes?.trim(),
      companyId: params.companyId,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(id: RecruiterId, props: RecruiterProps): Recruiter {
    return new Recruiter(id, props);
  }

  get name(): string {
    return this.props.name;
  }

  get email(): Email | undefined {
    return this.props.email;
  }

  get phone(): string | undefined {
    return this.props.phone;
  }

  get linkedinUrl(): string | undefined {
    return this.props.linkedinUrl;
  }

  get notes(): string | undefined {
    return this.props.notes;
  }

  get companyId(): CompanyId | undefined {
    return this.props.companyId;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  updateContactInfo(params: {
    name?: string;
    email?: Email;
    phone?: string;
    linkedinUrl?: string;
    notes?: string;
    companyId?: CompanyId;
  }): void {
    if (params.name !== undefined) {
      const trimmed = params.name.trim();
      if (trimmed.length === 0) {
        throw new Error('Recruiter name cannot be empty');
      }
      this.props.name = trimmed;
    }
    if (params.email !== undefined) this.props.email = params.email;
    if (params.phone !== undefined) this.props.phone = params.phone.trim();
    if (params.linkedinUrl !== undefined) this.props.linkedinUrl = params.linkedinUrl.trim();
    if (params.notes !== undefined) this.props.notes = params.notes.trim();
    if (params.companyId !== undefined) this.props.companyId = params.companyId;
    this.touch();
  }

  private touch(): void {
    this.props.updatedAt = new Date();
    this.incrementVersion();
  }
}
