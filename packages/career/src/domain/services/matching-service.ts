import type { Resume } from '../entities/resume.js';
import type { Vacancy } from '../entities/vacancy.js';
import type { SearchProfile } from '../entities/search-profile.js';

export interface MatchResult {
  score: number;
  reasons: string[];
  missingSkills: string[];
  strengths: string[];
  weaknesses: string[];
}

export interface MatchingService {
  matchResumeToVacancy(resume: Resume, vacancy: Vacancy): Promise<MatchResult>;
  matchProfileToVacancy(profile: SearchProfile, vacancy: Vacancy): Promise<MatchResult>;
  rankVacancies(
    resume: Resume,
    vacancies: Vacancy[]
  ): Promise<Array<{ vacancy: Vacancy; score: number }>>;
}
