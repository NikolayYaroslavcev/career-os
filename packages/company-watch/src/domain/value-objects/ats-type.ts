export const ATS_TYPES = [
  'GREENHOUSE',
  'LEVER',
  'ASHBY',
  'WORKDAY',
  'TEAMTAILOR',
  'SMARTRECRUITERS',
  'RECRUITEE',
  'PERSONIO',
  'WORKABLE',
  'BAMBOOHR',
  'CUSTOM_HTML',
  'JSON_LD',
] as const;

export type AtsType = (typeof ATS_TYPES)[number];

export function isValidAtsType(value: string): value is AtsType {
  return ATS_TYPES.includes(value as AtsType);
}
