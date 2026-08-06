import type { NormalizedVacancy } from '@careeros/providers';

const RESUME_TITLE_PATTERNS = [
  /\bresume\b/i,
  /\bcv\b/i,
  /\blooking\s+for\s+(a\s+)?(job|work|position|role|opportunity)/i,
  /\bseeking\s+(a\s+)?(job|work|position|role|opportunity)/i,
  /\bin\s+search\s+of\b/i,
  /\bopen\s+to\s+work\b/i,
  /\bjob\s+seeker\b/i,
  /\bcandidate\s+profile\b/i,
  /\bfreelancer\b/i,
  /\bmy\s+(portfolio|cv|resume)\b/i,
  /(^|[^а-яё])резюме($|[^а-яё])/i,
  /(^|[^а-яё])ищу\s+(работу|вакансию|позицию)($|[^а-яё])/i,
  /(^|[^а-яё])в\s+поиске\s+работы($|[^а-яё])/i,
  /(^|[^а-яё])открыт[а-яё]*\s+к\s+работе($|[^а-яё])/i,
  /(^|[^а-яё])профиль\s+кандидата($|[^а-яё])/i,
  /(^|[^а-яё])фрилансер($|[^а-яё])/i,
];

const NON_VACANCY_TITLE_PATTERNS = [
  /\bcourse\b/i,
  /\bwebinar\b/i,
  /\bworkshop\b/i,
  /\btraining\b/i,
  /\bbootcamp\b/i,
  /\bmaster\s*class\b/i,
  /\blecture\b/i,
  /\bconference\b/i,
  /\bhackathon\b/i,
  /\bmeetup\b/i,
  /\bevent\b/i,
  /(^|[^а-яё])поступление($|[^а-яё])/i,
  /(^|[^а-яё])курс[аоы]?($|[^а-яё])/i,
  /(^|[^а-яё])вебинар($|[^а-яё])/i,
  /(^|[^а-яё])тренинг($|[^а-яё])/i,
  /(^|[^а-яё])марафон($|[^а-яё])/i,
  /(^|[^а-яё])митап($|[^а-яё])/i,
  /(^|[^а-яё])конференц/i,
];

const AD_PROMO_PATTERNS = [
  /\badvertis(?:ement|ing)\b/i,
  /\brecruiter\s+(self|looking|available)\b/i,
  /\bagency\s+(ad|promo|advertisement)\b/i,
  /\bsponsored\b/i,
  /\bpromo\s*code\b/i,
  /\bdiscount\b/i,
  /\bsale[s]?\b/i,
  /(^|[^а-яё])подбор\s+персонала($|[^а-яё])/i,
  /(^|[^а-яё])кадровое\s+агентство($|[^а-яё])/i,
  /(^|[^а-яё])рекламн/i,
];

export function isNonVacancyContentShape(input: { title?: string | null; description?: string | null }): boolean {
  const title = input.title?.trim() ?? '';
  const description = input.description?.trim() ?? '';

  if (!title && !description) return true;
  if (title.length < 3 && description.length < 20) return true;

  for (const pattern of RESUME_TITLE_PATTERNS) {
    if (pattern.test(title)) return true;
  }

  for (const pattern of NON_VACANCY_TITLE_PATTERNS) {
    if (pattern.test(title)) return true;
  }

  for (const pattern of AD_PROMO_PATTERNS) {
    if (pattern.test(title)) return true;
  }

  return false;
}

export function filterNonVacancyContent(vacancies: readonly NormalizedVacancy[]): NormalizedVacancy[] {
  return vacancies.filter((vacancy) => !isNonVacancyContentShape(vacancy));
}
