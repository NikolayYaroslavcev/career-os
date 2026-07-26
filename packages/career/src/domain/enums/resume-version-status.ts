export const ResumeVersionStatus = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  ARCHIVED: 'archived',
} as const;

export type ResumeVersionStatus = (typeof ResumeVersionStatus)[keyof typeof ResumeVersionStatus];
