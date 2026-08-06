import { describe, expect, it } from 'vitest';
import { isNonVacancyContentShape } from '../non-vacancy-content.js';

describe('non-vacancy-content', () => {
  it('treats resume-like titles as non-vacancy content', () => {
    expect(isNonVacancyContentShape({ title: 'Резюме', description: 'Frontend developer with React and TypeScript' })).toBe(true);
    expect(isNonVacancyContentShape({ title: 'Resume', description: 'Senior backend engineer profile' })).toBe(true);
  });

  it('keeps real vacancies visible', () => {
    expect(isNonVacancyContentShape({ title: 'Senior Frontend Engineer', description: 'React and TypeScript product team role' })).toBe(false);
  });

  it('rejects Cyrillic course/webinar/agency spam titles with no ASCII boundary', () => {
    expect(isNonVacancyContentShape({ title: 'Курс по программированию для начинающих', description: '' })).toBe(true);
    expect(isNonVacancyContentShape({ title: 'Бесплатный вебинар по Java', description: '' })).toBe(true);
    expect(isNonVacancyContentShape({ title: 'Кадровое агентство ищет партнеров', description: '' })).toBe(true);
  });
});
