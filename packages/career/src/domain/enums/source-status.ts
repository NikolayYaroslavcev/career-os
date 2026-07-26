export const SourceStatus = {
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  REMOVED: 'REMOVED',
  BROKEN: 'BROKEN',
} as const;

export type SourceStatus = (typeof SourceStatus)[keyof typeof SourceStatus];

export const SOURCE_STATUS_LABELS: Record<SourceStatus, string> = {
  ACTIVE: 'Active',
  EXPIRED: 'Expired',
  REMOVED: 'Removed',
  BROKEN: 'Broken',
};
