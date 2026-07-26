import { describe, it, expect } from 'vitest';
import { Recommendation as RecommendationLabel } from '@careeros/ai';
import { TelegramDigestFormatter } from '../telegram-digest-formatter.js';
import type { Digest } from '../digest-builder.js';

function buildDigest(overrides: Partial<Digest> = {}): Digest {
  return {
    title: 'CareerOS Morning Digest',
    generatedAt: new Date('2026-07-15T06:00:00Z'),
    summary: '18 new vacancies found. 2 recommended for you today.',
    newVacancyCount: 18,
    topRecommendations: [
      {
        rank: 1,
        matchResultId: 'm-1',
        vacancyTitle: 'Senior React Engineer',
        companyName: 'Acme Corp',
        score: 94,
        recommendation: RecommendationLabel.STRONG_APPLY,
        reasons: ['React expertise', 'TypeScript'],
        missingSkills: ['GraphQL'],
        vacancyUrl: 'https://example.com/job/1',
      },
    ],
    groups: {
      [RecommendationLabel.STRONG_APPLY]: [],
      [RecommendationLabel.APPLY]: [],
      [RecommendationLabel.MAYBE]: [],
      [RecommendationLabel.SKIP]: [],
    },
    strengths: ['React expertise'],
    missingSkills: ['GraphQL'],
    followUps: [],
    ...overrides,
  };
}

describe('TelegramDigestFormatter', () => {
  it('renders title, date, vacancy count, and each recommendation', () => {
    const formatter = new TelegramDigestFormatter();

    const text = formatter.format(buildDigest());

    expect(text).toContain('CareerOS Morning Digest');
    expect(text).toContain('2026-07-15');
    expect(text).toContain('New vacancies: 18');
    expect(text).toContain('1. 🔥 *Senior React Engineer* — Acme Corp');
    expect(text).toContain('94% match (StrongApply)');
    expect(text).toContain('Reasons: React expertise, TypeScript');
    expect(text).toContain('Missing: GraphQL');
    expect(text).toContain('https://example.com/job/1');
  });

  it('renders a fallback message when there are no recommendations', () => {
    const formatter = new TelegramDigestFormatter();

    const text = formatter.format(buildDigest({ topRecommendations: [] }));

    expect(text).toContain('No new recommendations that clear the bar today');
    expect(text).not.toContain('Top recommendations:');
  });

  it('renders a follow-ups section above recommendations when any are due', () => {
    const formatter = new TelegramDigestFormatter();
    const digest = buildDigest({
      followUps: [
        {
          id: 'f-1',
          applicationId: 'app-1',
          type: undefined,
          vacancyTitle: 'Frontend Engineer',
          companyName: 'Google',
          scheduledAt: new Date('2026-07-15T09:00:00Z'),
          daysSinceApplied: 7,
          recommendedAction: 'Send a follow-up message',
        },
        {
          id: 'f-2',
          applicationId: 'app-2',
          type: 'interview',
          vacancyTitle: 'Backend Engineer',
          companyName: 'Company X',
          scheduledAt: new Date('2026-07-16T09:00:00Z'),
          daysSinceApplied: null,
          recommendedAction: 'Prepare for your interview',
        },
      ],
    });

    const text = formatter.format(digest);

    expect(text).toContain('Today you have 2 follow-ups:');
    expect(text).toContain('1. ⏰ *Google* — Frontend Engineer');
    expect(text).toContain('Applied 7 days ago');
    expect(text).toContain('Recommended: Send a follow-up message');
    expect(text).toContain('2. 📅 Interview reminder — *Company X*');
    expect(text).toContain('Backend Engineer');
  });

  it('omits the follow-ups section entirely when none are due', () => {
    const formatter = new TelegramDigestFormatter();
    const text = formatter.format(buildDigest({ followUps: [] }));

    expect(text).not.toContain('follow-up');
  });

  it('omits the Missing line when there are no missing skills', () => {
    const formatter = new TelegramDigestFormatter();
    const digest = buildDigest({
      topRecommendations: [
        {
          rank: 1,
          matchResultId: 'm-1',
          vacancyTitle: 'Backend Engineer',
          companyName: 'Acme Corp',
          score: 80,
          recommendation: RecommendationLabel.APPLY,
          reasons: ['Node.js'],
          missingSkills: [],
        },
      ],
    });

    const text = formatter.format(digest);

    expect(text).not.toContain('Missing:');
  });
});
