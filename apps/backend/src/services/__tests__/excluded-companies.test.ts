import { describe, it, expect } from 'vitest';
import { isExcludedCompanyName, filterExcludedCompanies } from '../excluded-companies.js';
import type { NormalizedVacancy } from '@careeros/providers';

function vacancyWithCompany(companyName: string): NormalizedVacancy {
  return {
    id: 'v-1',
    source: 'working_nomads',
    sourceId: 'v-1',
    title: 'Senior React Full-stack Developer',
    description: 'A great job',
    companyName,
    location: { raw: 'Remote', workMode: 'remote' },
    technologies: [],
    publishedAt: new Date(),
    fetchedAt: new Date(),
  } as unknown as NormalizedVacancy;
}

describe('isExcludedCompanyName', () => {
  it('excludes Proxify', () => {
    expect(isExcludedCompanyName('Proxify')).toBe(true);
  });

  it('excludes Lemon.io regardless of case', () => {
    expect(isExcludedCompanyName('Lemon.io')).toBe(true);
    expect(isExcludedCompanyName('LEMON.IO')).toBe(true);
    expect(isExcludedCompanyName('  lemon.io  ')).toBe(true);
  });

  it('does not exclude unrelated companies', () => {
    expect(isExcludedCompanyName('Reddit')).toBe(false);
    expect(isExcludedCompanyName('Lemon')).toBe(false);
  });

  it('handles null/undefined/empty safely', () => {
    expect(isExcludedCompanyName(null)).toBe(false);
    expect(isExcludedCompanyName(undefined)).toBe(false);
    expect(isExcludedCompanyName('')).toBe(false);
  });
});

describe('filterExcludedCompanies', () => {
  it('drops vacancies from excluded companies while keeping others', () => {
    const vacancies = [
      vacancyWithCompany('Lemon.io'),
      vacancyWithCompany('Proxify'),
      vacancyWithCompany('Reddit'),
    ];

    const result = filterExcludedCompanies(vacancies);

    expect(result).toHaveLength(1);
    expect(result[0]?.companyName).toBe('Reddit');
  });
});
