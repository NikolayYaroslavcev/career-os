export type { UserRepository } from './user-repository.js';
export type { WorkspaceRepository } from './workspace-repository.js';
export type { ResumeRepository, ResumeMetadata, ResumeListCriteria } from './resume-repository.js';
export type { CompanyRepository, SaveCompanyOptions } from './company-repository.js';
export type {
  VacancyRepository,
  SaveVacancyOptions,
  VacancyListCriteria,
  VacancyListResult,
  VacancySortField,
  VacancySortOrder,
  VacancyStats,
} from './vacancy-repository.js';
export type {
  VacancySourceRepository,
  SaveVacancySourceOptions,
} from './vacancy-source-repository.js';
export type { ApplicationRepository, SaveApplicationOptions } from './application-repository.js';
export type { RecruiterRepository } from './recruiter-repository.js';
export type { CommunicationRepository } from './communication-repository.js';
export type { InterviewRepository } from './interview-repository.js';
export type { FollowUpRepository } from './follow-up-repository.js';
export type { NotificationRepository } from './notification-repository.js';
export type { NotificationHistoryRepository } from './notification-history-repository.js';
export type { FeedbackRepository } from './feedback-repository.js';
export type { StructuredResumeRepository } from './structured-resume-repository.js';
export type { SearchProfileRepository, SaveSearchProfileOptions } from './search-profile-repository.js';
export type { TelegramConnectionRepository } from './telegram-connection-repository.js';
export type { TelegramLinkingTokenRepository } from './telegram-linking-token-repository.js';
export type { MergeAuditRepository } from './merge-audit-repository.js';
export type { UserVacancyInteractionRepository, InteractionAction, UserVacancyInteractionData } from './user-vacancy-interaction-repository.js';
