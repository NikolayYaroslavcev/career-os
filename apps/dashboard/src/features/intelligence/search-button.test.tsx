import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchButton } from './search-button';
import { I18nProvider } from '@/lib/i18n/i18n-provider';
import { runSearch, pollMatchStatus } from '@/api/intelligence';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: (): { push: typeof mockPush } => ({
    push: mockPush,
  }),
}));

vi.mock('@/api/intelligence', () => ({
  runSearch: vi.fn(),
  pollMatchStatus: vi.fn(),
}));

vi.mock('@/api/applications', () => ({
  createApplication: vi.fn(),
}));

const mockListSearchProfiles = vi.fn();

vi.mock('@/api/search-profiles', () => ({
  listSearchProfiles: (...args: unknown[]): ReturnType<typeof mockListSearchProfiles> => mockListSearchProfiles(...args),
}));

function renderWithI18n(ui: React.ReactElement): ReturnType<typeof render> {
  return render(<I18nProvider initialLocale="en">{ui}</I18nProvider>);
}

describe('SearchButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockListSearchProfiles.mockResolvedValue({ searchProfiles: [] });
    vi.mocked(pollMatchStatus).mockResolvedValue({ vacancies: [] });
  });

  it('renders empty state when no active profile exists', async () => {
    renderWithI18n(<SearchButton />);

    await waitFor(() => {
      expect(
        screen.getByText('Create your search profile to start AI job matching')
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(
        /A search profile tells the AI what kind of job you are looking for/
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /create search profile/i })
    ).toBeInTheDocument();
  });

  it('renders search button when active profile exists', async () => {
    mockListSearchProfiles.mockResolvedValue({
      searchProfiles: [
        {
          id: '1',
          name: 'Test Profile',
          isActive: true,
          desiredPositions: ['Developer'],
          desiredTechnologies: ['TypeScript'],
          experienceLevel: 'senior',
          desiredSalary: null,
          desiredLocations: [],
          isRemoteOnly: false,
          userId: 'user-1',
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        },
      ],
    });

    renderWithI18n(<SearchButton />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'AI Job Matching' })).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /run ai matching/i })).toBeInTheDocument();
  });

  it('displays AI summary, warnings, and a sort control after a search resolves with recommendations', async () => {
    mockListSearchProfiles.mockResolvedValue({
      searchProfiles: [
        {
          id: '1',
          name: 'Test Profile',
          isActive: true,
          desiredPositions: ['Developer'],
          desiredTechnologies: ['TypeScript'],
          experienceLevel: 'senior',
          desiredSalary: null,
          desiredLocations: [],
          isRemoteOnly: false,
          userId: 'user-1',
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        },
      ],
    });

    const vacancy = {
      id: 'v1',
      title: 'Backend Engineer',
      companyId: 'c1',
      source: 'hh',
      sourceUrl: null,
      location: 'Remote',
      remote: 'REMOTE',
      salaryMin: null,
      salaryMax: null,
      currency: null,
      publishedAt: null,
    };

    vi.mocked(runSearch).mockResolvedValue({
      searchProfileId: 'profile-1',
      vacancies: [
        {
          status: 'matched',
          vacancy,
          recommendation: {
            matchResultId: 'match-1',
            vacancy,
            score: 0.82,
            confidence: '0.8',
            recommendation: 'strong_match',
            summary: 'Great backend role with strong tech overlap.',
            strengths: ['typescript'],
            weaknesses: ['no cloud experience'],
            requiredSkills: ['typescript', 'aws'],
            missingSkills: ['aws'],
            seniorityEstimation: 'Senior',
            remotePolicy: 'Fully remote',
            salaryObservations: null,
            reasoning: 'Strong overlap.',
            generatedAt: '2026-07-20T00:00:00.000Z',
            matchingAlgorithmVersion: '1.0.0',
          },
        },
      ],
      stats: { totalVacancies: 1, matchedVacancies: 1, pendingVacancies: 0, averageScore: 0.82 },
      aiEnabled: true,
    });

    renderWithI18n(<SearchButton />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /run ai matching/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /run ai matching/i }));

    await waitFor(() => {
      expect(screen.getByText('Great backend role with strong tech overlap.')).toBeInTheDocument();
    });

    expect(screen.getByText('Possible concerns')).toBeInTheDocument();
    expect(screen.getByText('no cloud experience')).toBeInTheDocument();
    expect(screen.getByText('AI Match Score (high to low)')).toBeInTheDocument();
  });

  it('shows vacancies immediately with a pending badge, then displays the score once polling reports a match', async () => {
    mockListSearchProfiles.mockResolvedValue({
      searchProfiles: [
        {
          id: '1',
          name: 'Test Profile',
          isActive: true,
          desiredPositions: ['Developer'],
          desiredTechnologies: ['TypeScript'],
          experienceLevel: 'senior',
          desiredSalary: null,
          desiredLocations: [],
          isRemoteOnly: false,
          userId: 'user-1',
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        },
      ],
    });

    const vacancy = {
      id: 'v2',
      title: 'Frontend Engineer',
      companyId: 'c2',
      source: 'hh',
      sourceUrl: null,
      location: 'Remote',
      remote: 'REMOTE',
      salaryMin: null,
      salaryMax: null,
      currency: null,
      publishedAt: null,
    };

    vi.mocked(runSearch).mockResolvedValue({
      searchProfileId: 'profile-1',
      vacancies: [{ status: 'pending', vacancy, recommendation: null }],
      stats: { totalVacancies: 1, matchedVacancies: 0, pendingVacancies: 1, averageScore: 0 },
      aiEnabled: true,
    });

    renderWithI18n(<SearchButton />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /run ai matching/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /run ai matching/i }));

    await waitFor(() => {
      expect(screen.getByText('Frontend Engineer')).toBeInTheDocument();
    });
    expect(screen.getByText('AI analysis in progress')).toBeInTheDocument();

    vi.mocked(pollMatchStatus).mockResolvedValue({
      vacancies: [
        {
          vacancyId: 'v2',
          status: 'matched',
          recommendation: {
            matchResultId: 'match-2',
            vacancy,
            score: 0.65,
            confidence: '0.7',
            recommendation: 'good_match',
            summary: 'Solid frontend fit.',
            strengths: [],
            weaknesses: [],
            requiredSkills: [],
            missingSkills: [],
            seniorityEstimation: 'Middle',
            remotePolicy: 'Remote',
            salaryObservations: null,
            reasoning: '',
            generatedAt: '2026-07-20T00:00:00.000Z',
            matchingAlgorithmVersion: '1.0.0',
          },
        },
      ],
    });

    await waitFor(
      () => {
        expect(pollMatchStatus).toHaveBeenCalledWith('profile-1', ['v2']);
      },
      { timeout: 6000 }
    );

    await waitFor(() => {
      expect(screen.queryByText('AI analysis in progress')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Solid frontend fit.')).toBeInTheDocument();
  }, 10000);

  it('updates the summary stats panel as polling resolves pending vacancies into matches', async () => {
    mockListSearchProfiles.mockResolvedValue({
      searchProfiles: [
        {
          id: '1',
          name: 'Test Profile',
          isActive: true,
          desiredPositions: ['Developer'],
          desiredTechnologies: ['TypeScript'],
          experienceLevel: 'senior',
          desiredSalary: null,
          desiredLocations: [],
          isRemoteOnly: false,
          userId: 'user-1',
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        },
      ],
    });

    const vacancy = {
      id: 'v4',
      title: 'Stats Panel Engineer',
      companyId: 'c4',
      source: 'hh',
      sourceUrl: null,
      location: 'Remote',
      remote: 'REMOTE',
      salaryMin: null,
      salaryMax: null,
      currency: null,
      publishedAt: null,
    };

    vi.mocked(runSearch).mockResolvedValue({
      searchProfileId: 'profile-1',
      vacancies: [{ status: 'pending', vacancy, recommendation: null }],
      stats: { totalVacancies: 1, matchedVacancies: 0, pendingVacancies: 1, averageScore: 0 },
      aiEnabled: true,
    });

    renderWithI18n(<SearchButton />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /run ai matching/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /run ai matching/i }));

    await waitFor(() => {
      expect(screen.getByText('Stats Panel Engineer')).toBeInTheDocument();
    });
    // Initial snapshot from runSearch: 1 pending, 0 matched.
    expect(screen.getByText('Pending').previousSibling?.textContent).toBe('1');
    expect(screen.getByText('Matched').previousSibling?.textContent).toBe('0');

    vi.mocked(pollMatchStatus).mockResolvedValue({
      vacancies: [
        {
          vacancyId: 'v4',
          status: 'matched',
          recommendation: {
            matchResultId: 'match-4',
            vacancy,
            score: 0.5,
            confidence: '0.7',
            recommendation: 'good_match',
            summary: 'Decent fit.',
            strengths: [],
            weaknesses: [],
            requiredSkills: [],
            missingSkills: [],
            seniorityEstimation: 'Middle',
            remotePolicy: 'Remote',
            salaryObservations: null,
            reasoning: '',
            generatedAt: '2026-07-20T00:00:00.000Z',
            matchingAlgorithmVersion: '1.0.0',
          },
        },
      ],
    });

    await waitFor(
      () => {
        expect(screen.getByText('Decent fit.')).toBeInTheDocument();
      },
      { timeout: 6000 }
    );

    // Once polling resolves the pending vacancy, the summary panel must
    // reflect it — not stay frozen at the initial runSearch() snapshot.
    expect(screen.getByText('Pending').previousSibling?.textContent).toBe('0');
    expect(screen.getByText('Matched').previousSibling?.textContent).toBe('1');
    expect(screen.getByText('Avg Score').previousSibling?.textContent).toBe('50%');
  }, 10000);

  it('restores the last search results after the component remounts (e.g. navigating away and back)', async () => {
    mockListSearchProfiles.mockResolvedValue({
      searchProfiles: [
        {
          id: '1',
          name: 'Test Profile',
          isActive: true,
          desiredPositions: ['Developer'],
          desiredTechnologies: ['TypeScript'],
          experienceLevel: 'senior',
          desiredSalary: null,
          desiredLocations: [],
          isRemoteOnly: false,
          userId: 'user-1',
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        },
      ],
    });

    const vacancy = {
      id: 'v3',
      title: 'Platform Engineer',
      companyId: 'c3',
      source: 'hh',
      sourceUrl: null,
      location: 'Remote',
      remote: 'REMOTE',
      salaryMin: null,
      salaryMax: null,
      currency: null,
      publishedAt: null,
    };

    vi.mocked(runSearch).mockResolvedValue({
      searchProfileId: 'profile-1',
      vacancies: [
        {
          status: 'matched',
          vacancy,
          recommendation: {
            matchResultId: 'match-3',
            vacancy,
            score: 0.9,
            confidence: '0.9',
            recommendation: 'strong_match',
            summary: 'Excellent platform fit.',
            strengths: [],
            weaknesses: [],
            requiredSkills: [],
            missingSkills: [],
            seniorityEstimation: 'Senior',
            remotePolicy: 'Fully remote',
            salaryObservations: null,
            reasoning: '',
            generatedAt: '2026-07-20T00:00:00.000Z',
            matchingAlgorithmVersion: '1.0.0',
          },
        },
      ],
      stats: { totalVacancies: 1, matchedVacancies: 1, pendingVacancies: 0, averageScore: 0.9 },
      aiEnabled: true,
    });

    const { unmount } = renderWithI18n(<SearchButton />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /run ai matching/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /run ai matching/i }));

    await waitFor(() => {
      expect(screen.getByText('Excellent platform fit.')).toBeInTheDocument();
    });

    unmount();

    renderWithI18n(<SearchButton />);

    await waitFor(() => {
      expect(screen.getByText('Excellent platform fit.')).toBeInTheDocument();
    });
    expect(runSearch).toHaveBeenCalledTimes(1);
  });

  it('navigates to search profiles page when Create Search Profile clicked', async () => {
    renderWithI18n(<SearchButton />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /create search profile/i })
      ).toBeInTheDocument();
    });

    screen.getByRole('button', { name: /create search profile/i }).click();

    expect(mockPush).toHaveBeenCalledWith('/app/search-profiles');
  });
});
