export const ExperienceLevel = {
  INTERN: 'intern',
  JUNIOR: 'junior',
  MIDDLE: 'middle',
  SENIOR: 'senior',
  LEAD: 'lead',
  PRINCIPAL: 'principal',
  EXECUTIVE: 'executive',
} as const;

export type ExperienceLevel = (typeof ExperienceLevel)[keyof typeof ExperienceLevel];

export const EXPERIENCE_LEVEL_ORDER: Record<ExperienceLevel, number> = {
  [ExperienceLevel.INTERN]: 0,
  [ExperienceLevel.JUNIOR]: 1,
  [ExperienceLevel.MIDDLE]: 2,
  [ExperienceLevel.SENIOR]: 3,
  [ExperienceLevel.LEAD]: 4,
  [ExperienceLevel.PRINCIPAL]: 5,
  [ExperienceLevel.EXECUTIVE]: 6,
};
