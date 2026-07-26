export const ResumeFormat = {
  PDF: 'pdf',
  DOCX: 'docx',
  MARKDOWN: 'markdown',
  JSON: 'json',
} as const;

export type ResumeFormat = (typeof ResumeFormat)[keyof typeof ResumeFormat];

export const RESUME_CONTENT_TYPES: Record<ResumeFormat, string> = {
  [ResumeFormat.PDF]: 'application/pdf',
  [ResumeFormat.DOCX]: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  [ResumeFormat.MARKDOWN]: 'text/markdown',
  [ResumeFormat.JSON]: 'application/json',
};
