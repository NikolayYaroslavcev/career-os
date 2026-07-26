import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResumeSearchProfileSuggestion } from './resume-search-profile-suggestion';
import { I18nProvider } from '@/lib/i18n/i18n-provider';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: (): { push: typeof mockPush } => ({
    push: mockPush,
  }),
}));

const mockGetSearchProfileSuggestion = vi.fn();
vi.mock('@/api/resumes', () => ({
  getSearchProfileSuggestion: (...args: unknown[]): ReturnType<typeof mockGetSearchProfileSuggestion> => mockGetSearchProfileSuggestion(...args),
}));

const mockCreateSearchProfile = vi.fn();
vi.mock('@/api/search-profiles', () => ({
  createSearchProfile: (...args: unknown[]): ReturnType<typeof mockCreateSearchProfile> => mockCreateSearchProfile(...args),
}));

function renderWithI18n(ui: React.ReactElement): ReturnType<typeof render> {
  return render(<I18nProvider initialLocale="en">{ui}</I18nProvider>);
}

describe('ResumeSearchProfileSuggestion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches suggestions on mount and pre-fills the confirmation form without auto-saving', async () => {
    mockGetSearchProfileSuggestion.mockResolvedValue({
      desiredPositions: ['Backend Engineer'],
      technologies: ['typescript', 'postgresql'],
      experienceLevel: 'senior',
      remotePreference: 'remote',
      confidence: 0.8,
      reasoning: 'Derived from resume text.',
    });

    renderWithI18n(
      <ResumeSearchProfileSuggestion resumeId="resume-1" onCreated={vi.fn()} onDismiss={vi.fn()} />
    );

    await waitFor(() => {
      expect(mockGetSearchProfileSuggestion).toHaveBeenCalledWith('resume-1');
    });

    await waitFor(() => {
      expect(screen.getAllByDisplayValue('Backend Engineer')).toHaveLength(2);
    });

    expect(screen.getByDisplayValue('typescript, postgresql')).toBeInTheDocument();
    expect(mockCreateSearchProfile).not.toHaveBeenCalled();
  });

  it('creates the search profile from the suggested defaults', async () => {
    mockGetSearchProfileSuggestion.mockResolvedValue({
      desiredPositions: ['Backend Engineer'],
      technologies: ['typescript'],
      experienceLevel: 'senior',
      remotePreference: 'remote',
      confidence: 0.8,
      reasoning: 'Derived from resume text.',
    });
    mockCreateSearchProfile.mockResolvedValue({ id: 'profile-1' });
    const onCreated = vi.fn();

    renderWithI18n(
      <ResumeSearchProfileSuggestion resumeId="resume-1" onCreated={onCreated} onDismiss={vi.fn()} />
    );

    await screen.findAllByDisplayValue('Backend Engineer');

    fireEvent.click(screen.getByRole('button', { name: /create profile/i }));

    await waitFor(() => {
      expect(mockCreateSearchProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Backend Engineer',
          desiredPositions: ['Backend Engineer'],
          desiredTechnologies: ['typescript'],
          experienceLevel: 'senior',
          isRemoteOnly: true,
        })
      );
    });

    expect(onCreated).toHaveBeenCalled();
  });

  it('shows an error and a manual-creation fallback when the suggestion request fails', async () => {
    mockGetSearchProfileSuggestion.mockRejectedValue(new Error('AI provider unavailable'));

    renderWithI18n(
      <ResumeSearchProfileSuggestion resumeId="resume-1" onCreated={vi.fn()} onDismiss={vi.fn()} />
    );

    await waitFor(() => {
      expect(screen.getByText('AI provider unavailable')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /create search profile manually/i })).toBeInTheDocument();
    expect(mockCreateSearchProfile).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /create search profile manually/i }));
    expect(mockPush).toHaveBeenCalledWith('/app/search-profiles');
  });
});
