import { describe, it, expect } from 'vitest';
import {
  analyzeByCountry,
  analyzeByCity,
  analyzeByProvider,
  analyzeByCompanySize,
  analyzeByTechnology,
  analyzeByResumeVersion,
} from '../response-rate-analyzer.js';
import type { DateRange } from '../types.js';

const period: DateRange = { from: new Date('2026-01-01'), to: new Date('2026-02-01'), label: 'test' };

const vacancies = new Map([
  ['v1', { id: 'v1', country: 'Germany', city: 'Berlin', remote: 'remote', salaryMin: null, salaryMax: null, currency: null, experienceLevel: 'senior', source: 'hh', companyId: 'c1', technologies: ['TypeScript', 'React'] }],
  ['v2', { id: 'v2', country: 'Poland', city: 'Warsaw', remote: 'onsite', salaryMin: null, salaryMax: null, currency: null, experienceLevel: 'middle', source: 'linkedin', companyId: 'c2', technologies: ['Python'] }],
]);

const companies = new Map([
  ['c1', { id: 'c1', name: 'Acme', industry: 'fintech', size: 'large' }],
  ['c2', { id: 'c2', name: 'Beta', industry: 'ai', size: 'startup' }],
]);

const matchResults = new Map([
  ['v1', { vacancyId: 'v1', overallScore: 90 }],
  ['v2', { vacancyId: 'v2', overallScore: 50 }],
]);

const applications = [
  { status: 'hr_interview', vacancyId: 'v1' },
  { status: 'rejected', vacancyId: 'v2' },
];

describe('analyzeByCountry', () => {
  it('groups applications by the vacancy country', () => {
    const result = analyzeByCountry(applications, vacancies, matchResults, period);
    expect(result.dimension).toBe('country');
    const germany = result.segments.find((s) => s.label === 'Germany');
    expect(germany?.applications).toBe(1);
    expect(germany?.interviews).toBe(1);
  });
});

describe('analyzeByProvider', () => {
  it('groups applications by vacancy source', () => {
    const result = analyzeByProvider(applications, vacancies, matchResults, period);
    expect(result.segments.map((s) => s.label).sort()).toEqual(['hh', 'linkedin']);
  });
});

describe('analyzeByCompanySize', () => {
  it('groups applications by company size', () => {
    const result = analyzeByCompanySize(applications, vacancies, companies, matchResults, period);
    expect(result.dimension).toBe('company_size');
    expect(result.segments.map((s) => s.label).sort()).toEqual(['large', 'startup']);
  });

  it('falls back to Unknown when the company cannot be resolved', () => {
    const result = analyzeByCompanySize(applications, vacancies, new Map(), matchResults, period);
    expect(result.segments.every((s) => s.label === 'Unknown')).toBe(true);
  });
});

describe('analyzeByTechnology', () => {
  it('counts an application under every technology its vacancy lists', () => {
    const result = analyzeByTechnology(applications, vacancies, matchResults, period);
    expect(result.dimension).toBe('technology');
    const ts = result.segments.find((s) => s.label === 'TypeScript');
    const react = result.segments.find((s) => s.label === 'React');
    expect(ts?.applications).toBe(1);
    expect(react?.applications).toBe(1);
  });
});

describe('analyzeByCity', () => {
  it('groups applications by the vacancy city', () => {
    const result = analyzeByCity(applications, vacancies, matchResults, period);
    expect(result.dimension).toBe('city');
    const berlin = result.segments.find((s) => s.label === 'Berlin');
    expect(berlin?.applications).toBe(1);
    expect(berlin?.interviews).toBe(1);
  });

  it('falls back to Unknown when the vacancy has no city', () => {
    const noCityVacancies = new Map([
      ['v1', { id: 'v1', country: 'Germany', city: null, remote: 'remote', salaryMin: null, salaryMax: null, currency: null, experienceLevel: 'senior', source: 'hh', companyId: 'c1', technologies: [] }],
    ]);
    const result = analyzeByCity([{ status: 'applied', vacancyId: 'v1' }], noCityVacancies, matchResults, period);
    expect(result.segments.map((s) => s.label)).toEqual(['Unknown']);
  });
});

describe('analyzeByResumeVersion', () => {
  it('groups applications by resumeId', () => {
    const resumeApplications = [
      { status: 'hr_interview', vacancyId: 'v1', resumeId: 'resume-a' },
      { status: 'applied', vacancyId: 'v2', resumeId: 'resume-a' },
      { status: 'offer', vacancyId: 'v1', resumeId: 'resume-b' },
    ];
    const result = analyzeByResumeVersion(resumeApplications, matchResults, period);
    expect(result.dimension).toBe('resume_version');
    const a = result.segments.find((s) => s.label === 'resume-a');
    const b = result.segments.find((s) => s.label === 'resume-b');
    expect(a?.applications).toBe(2);
    expect(b?.applications).toBe(1);
    expect(b?.offers).toBe(1);
  });

  it('groups applications with a null resumeId into a distinct Unassigned segment', () => {
    const resumeApplications = [
      { status: 'applied', vacancyId: 'v1', resumeId: null },
      { status: 'hr_interview', vacancyId: 'v2', resumeId: 'resume-a' },
    ];
    const result = analyzeByResumeVersion(resumeApplications, matchResults, period);
    const unassigned = result.segments.find((s) => s.label === 'Unassigned');
    expect(unassigned?.applications).toBe(1);
    const a = result.segments.find((s) => s.label === 'resume-a');
    expect(a?.applications).toBe(1);
  });
});
