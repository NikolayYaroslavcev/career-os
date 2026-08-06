/**
 * Test data factories for E2E tests.
 * Generates unique, deterministic-ish test data to avoid collisions in parallel runs.
 */

export function uniqueEmail(prefix = 'e2e'): string {
  const ts = Date.now();
  const rand = Math.floor(Math.random() * 1e6);
  return `${prefix}-${ts}-${rand}@example.test`;
}

export function uniqueSuffix(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

export interface TestUser {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export function createUser(overrides?: Partial<TestUser>): TestUser {
  const suffix = uniqueSuffix();
  return {
    firstName: 'E2E',
    lastName: 'Tester',
    email: uniqueEmail(),
    password: 'TestPass!2024',
    ...overrides,
  };
}

export interface TestSearchProfile {
  name: string;
  desiredPositions: string;
  technologies: string;
  experienceLevel: string;
}

export function createSearchProfile(suffix?: string): TestSearchProfile {
  const s = suffix ?? uniqueSuffix();
  return {
    name: `E2E Profile ${s}`,
    desiredPositions: 'Backend Engineer, Platform Engineer',
    technologies: 'TypeScript, Node.js, PostgreSQL',
    experienceLevel: 'senior',
  };
}
