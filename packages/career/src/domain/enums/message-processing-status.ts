export const MessageProcessingStatus = {
  PENDING: 'PENDING',
  SKIPPED_PRECHECK: 'SKIPPED_PRECHECK',
  EXTRACTING: 'EXTRACTING',
  EXTRACTED: 'EXTRACTED',
  LOW_CONFIDENCE: 'LOW_CONFIDENCE',
  SPAM: 'SPAM',
  FAILED: 'FAILED',
} as const;

export type MessageProcessingStatus = (typeof MessageProcessingStatus)[keyof typeof MessageProcessingStatus];
