import { describe, it, expect } from 'vitest';
import { HHMapper } from '../hh-mapper.js';
import type { RawJob } from '../../../interfaces/raw-job.js';

describe('HHMapper', () => {
  const mapper = new HHMapper();

  describe('map', () => {
    it('should map a basic raw job to mapped job', () => {
      const raw: RawJob = {
        sourceId: '98765432',
        title: 'Frontend Developer (React)',
        description: '<p>Разработка UI на React.</p>',
        companyName: 'Tech Company LLC',
        location: 'Москва',
        technologies: ['react', 'typescript'],
        url: 'https://hh.ru/vacancy/98765432',
        publishedAt: new Date('2026-07-15'),
        remote: false,
        fetchedAt: new Date(),
      };

      const result = mapper.map(raw);

      expect(result.sourceId).toBe('98765432');
      expect(result.title).toBe('Frontend Developer (React)');
      expect(result.description).toBe('Разработка UI на React.');
      expect(result.companyName).toBe('Tech Company LLC');
      expect(result.url).toBe('https://hh.ru/vacancy/98765432');
      expect(result.remote).toBe(false);
    });

    it('should strip highlighttext tags from snippet-derived description', () => {
      const raw: RawJob = {
        sourceId: '1',
        title: 'Developer',
        description: 'Опыт работы с <highlighttext>React</highlighttext> от 2 лет.',
        companyName: 'Company',
        location: 'Москва',
        technologies: [],
        url: 'https://hh.ru/vacancy/1',
        publishedAt: new Date(),
        fetchedAt: new Date(),
      };

      const result = mapper.map(raw);

      expect(result.description).toBe('Опыт работы с React от 2 лет.');
    });

    it('should parse a Russian city, country location', () => {
      const raw: RawJob = {
        sourceId: '1',
        title: 'Developer',
        description: 'desc',
        companyName: 'Company',
        location: 'Москва, Россия',
        technologies: [],
        url: 'https://hh.ru/vacancy/1',
        publishedAt: new Date(),
        fetchedAt: new Date(),
      };

      const result = mapper.map(raw);

      expect(result.location.raw).toBe('Москва, Россия');
      expect(result.location.city).toBe('Москва');
      expect(result.location.country).toBe('Россия');
    });

    it('should default missing location to "Не указано"', () => {
      const raw: RawJob = {
        sourceId: '1',
        title: 'Developer',
        description: 'desc',
        companyName: 'Company',
        location: '',
        technologies: [],
        url: 'https://hh.ru/vacancy/1',
        publishedAt: new Date(),
        fetchedAt: new Date(),
      };

      const result = mapper.map(raw);

      expect(result.location.raw).toBe('Не указано');
    });

    it('should infer experience level from a Russian title', () => {
      const raw: RawJob = {
        sourceId: '1',
        title: 'Младший разработчик',
        description: 'desc',
        companyName: 'Company',
        location: 'Москва',
        technologies: [],
        url: 'https://hh.ru/vacancy/1',
        publishedAt: new Date(),
        fetchedAt: new Date(),
      };

      const result = mapper.map(raw);

      expect(result.experienceLevel).toBe('junior');
    });

    it('should infer employment type from a Russian description', () => {
      const raw: RawJob = {
        sourceId: '1',
        title: 'Developer',
        description: 'Полная занятость, офис.',
        companyName: 'Company',
        location: 'Москва',
        technologies: [],
        url: 'https://hh.ru/vacancy/1',
        publishedAt: new Date(),
        fetchedAt: new Date(),
      };

      const result = mapper.map(raw);

      expect(result.employmentType).toBe('full_time');
    });

    it('should deduplicate technologies', () => {
      const raw: RawJob = {
        sourceId: '1',
        title: 'Developer',
        description: 'desc',
        companyName: 'Company',
        location: 'Москва',
        technologies: ['react', 'React', 'typescript'],
        url: 'https://hh.ru/vacancy/1',
        publishedAt: new Date(),
        fetchedAt: new Date(),
      };

      const result = mapper.map(raw);

      expect(result.technologies).toEqual(['react', 'typescript']);
    });

    it('should map salary information', () => {
      const raw: RawJob = {
        sourceId: '1',
        title: 'Developer',
        description: 'desc',
        companyName: 'Company',
        location: 'Москва',
        technologies: [],
        url: 'https://hh.ru/vacancy/1',
        publishedAt: new Date(),
        fetchedAt: new Date(),
        salary: {
          from: 200000,
          to: 300000,
          currency: 'RUR',
          period: 'monthly',
        },
      };

      const result = mapper.map(raw);

      expect(result.salary).toEqual({
        min: 200000,
        max: 300000,
        currency: 'RUR',
        period: 'monthly',
      });
    });
  });
});
