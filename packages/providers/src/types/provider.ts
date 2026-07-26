export type AuthType = 'none' | 'api_key' | 'oauth2' | 'basic' | 'custom';

export type PaginationStrategy =
  | 'cursor'
  | 'page'
  | 'offset'
  | 'timestamp'
  | 'none';

export type SchedulePriority = 'low' | 'normal' | 'high' | 'urgent';

export type VacancySource = string;
