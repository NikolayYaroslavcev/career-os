import { Recruiter, createRecruiterId, createCompanyId, Email } from '@careeros/career';
import type { RecruiterRepository } from '@careeros/career';

export interface CreateRecruiterInput {
  readonly workspaceId: string;
  readonly name: string;
  readonly email?: string;
  readonly phone?: string;
  readonly linkedinUrl?: string;
  readonly notes?: string;
  readonly companyId?: string;
}

export interface UpdateRecruiterInput {
  readonly name?: string;
  readonly email?: string;
  readonly phone?: string;
  readonly linkedinUrl?: string;
  readonly notes?: string;
  readonly companyId?: string;
}

export class RecruiterNotFoundError extends Error {
  constructor(id: string) {
    super(`Recruiter '${id}' not found`);
    this.name = 'RecruiterNotFoundError';
  }
}

export class RecruiterService {
  constructor(private readonly repository: RecruiterRepository) {}

  async create(input: CreateRecruiterInput): Promise<Recruiter> {
    const recruiter = Recruiter.create({
      id: createRecruiterId(crypto.randomUUID()),
      name: input.name,
      email: input.email ? Email.create(input.email) : undefined,
      phone: input.phone,
      linkedinUrl: input.linkedinUrl,
      notes: input.notes,
      companyId: input.companyId ? createCompanyId(input.companyId) : undefined,
    });

    await this.repository.save(recruiter, { workspaceId: input.workspaceId });
    return recruiter;
  }

  async update(id: string, workspaceId: string, input: UpdateRecruiterInput): Promise<Recruiter> {
    const recruiter = await this.getOwned(id, workspaceId);

    recruiter.updateContactInfo({
      name: input.name,
      email: input.email !== undefined ? Email.create(input.email) : undefined,
      phone: input.phone,
      linkedinUrl: input.linkedinUrl,
      notes: input.notes,
      companyId: input.companyId !== undefined ? createCompanyId(input.companyId) : undefined,
    });

    await this.repository.save(recruiter, {});
    return recruiter;
  }

  async delete(id: string, workspaceId: string): Promise<void> {
    await this.getOwned(id, workspaceId);
    await this.repository.delete(createRecruiterId(id));
  }

  async getOwnedById(id: string, workspaceId: string): Promise<Recruiter | null> {
    return this.repository.findByIdForWorkspace(createRecruiterId(id), workspaceId);
  }

  async listByWorkspace(workspaceId: string): Promise<Recruiter[]> {
    return this.repository.findByWorkspaceId(workspaceId);
  }

  /** Fetches a recruiter and verifies it belongs to workspaceId. Throws (not found — never
   * reveals whether the id belongs to another workspace) if missing or owned elsewhere. */
  private async getOwned(id: string, workspaceId: string): Promise<Recruiter> {
    const recruiter = await this.repository.findByIdForWorkspace(createRecruiterId(id), workspaceId);
    if (!recruiter) {
      throw new RecruiterNotFoundError(id);
    }
    return recruiter;
  }
}
