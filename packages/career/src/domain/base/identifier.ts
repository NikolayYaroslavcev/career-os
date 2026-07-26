declare const __brand: unique symbol;

type Brand<K, T> = T & { readonly [__brand]: K };

export type UserId = Brand<'UserId', string>;
export type WorkspaceId = Brand<'WorkspaceId', string>;
export type ResumeId = Brand<'ResumeId', string>;
export type VacancyId = Brand<'VacancyId', string>;
export type CompanyId = Brand<'CompanyId', string>;
export type ApplicationId = Brand<'ApplicationId', string>;
export type RecruiterId = Brand<'RecruiterId', string>;
export type CommunicationId = Brand<'CommunicationId', string>;
export type InterviewId = Brand<'InterviewId', string>;
export type FollowUpId = Brand<'FollowUpId', string>;
export type NotificationId = Brand<'NotificationId', string>;
export type FeedbackId = Brand<'FeedbackId', string>;
export type StructuredResumeId = Brand<'StructuredResumeId', string>;
export type SearchProfileId = Brand<'SearchProfileId', string>;
export type TelegramConnectionId = Brand<'TelegramConnectionId', string>;
export type TelegramLinkingTokenId = Brand<'TelegramLinkingTokenId', string>;
export type VacancySourceId = Brand<'VacancySourceId', string>;

export function createUserId(value: string): UserId {
  return value as UserId;
}

export function createWorkspaceId(value: string): WorkspaceId {
  return value as WorkspaceId;
}

export function createResumeId(value: string): ResumeId {
  return value as ResumeId;
}

export function createVacancyId(value: string): VacancyId {
  return value as VacancyId;
}

export function createCompanyId(value: string): CompanyId {
  return value as CompanyId;
}

export function createApplicationId(value: string): ApplicationId {
  return value as ApplicationId;
}

export function createRecruiterId(value: string): RecruiterId {
  return value as RecruiterId;
}

export function createCommunicationId(value: string): CommunicationId {
  return value as CommunicationId;
}

export function createInterviewId(value: string): InterviewId {
  return value as InterviewId;
}

export function createFollowUpId(value: string): FollowUpId {
  return value as FollowUpId;
}

export function createNotificationId(value: string): NotificationId {
  return value as NotificationId;
}

export function createFeedbackId(value: string): FeedbackId {
  return value as FeedbackId;
}

export function createStructuredResumeId(value: string): StructuredResumeId {
  return value as StructuredResumeId;
}

export function createSearchProfileId(value: string): SearchProfileId {
  return value as SearchProfileId;
}

export function createTelegramConnectionId(value: string): TelegramConnectionId {
  return value as TelegramConnectionId;
}

export function createTelegramLinkingTokenId(value: string): TelegramLinkingTokenId {
  return value as TelegramLinkingTokenId;
}

export function createVacancySourceId(value: string): VacancySourceId {
  return value as VacancySourceId;
}
