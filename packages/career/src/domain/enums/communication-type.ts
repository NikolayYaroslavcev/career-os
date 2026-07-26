export const CommunicationType = {
  EMAIL: 'email',
  PHONE: 'phone',
  LINKEDIN: 'linkedin',
  TELEGRAM: 'telegram',
  OTHER: 'other',
} as const;

export type CommunicationType = (typeof CommunicationType)[keyof typeof CommunicationType];

export const CommunicationDirection = {
  INBOUND: 'inbound',
  OUTBOUND: 'outbound',
} as const;

export type CommunicationDirection = (typeof CommunicationDirection)[keyof typeof CommunicationDirection];
