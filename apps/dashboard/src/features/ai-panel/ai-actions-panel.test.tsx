import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AiActionsPanel } from './ai-actions-panel';
import { I18nProvider } from '@/lib/i18n/i18n-provider';
import { listResumes } from '@/api/resumes';
import { listSearchProfiles } from '@/api/search-profiles';
import { getAIJobs, getTailoringStatus } from '@/api/ai';
import { tailorResumeForApplication } from '@/api/applications';

vi.mock('@/api/resumes', () => ({
  listResumes: vi.fn(),
}));

vi.mock('@/api/search-profiles', () => ({
  listSearchProfiles: vi.fn(),
}));

vi.mock('@/api/ai', () => ({
  analyzeVacancy: vi.fn(),
  tailorResume: vi.fn(),
  getTailoringStatus: vi.fn(),
  generateCoverLetter: vi.fn(),
  getInterviewPrep: vi.fn(),
  getAIJobs: vi.fn(),
}));

vi.mock('@/api/applications', () => ({
  analyzeVacancyForApplication: vi.fn(),
  tailorResumeForApplication: vi.fn(),
  generateCoverLetterForApplication: vi.fn(),
  interviewPrepForApplication: vi.fn(),
}));

function renderWithI18n(ui: React.ReactElement): ReturnType<typeof render> {
  return render(<I18nProvider initialLocale="en">{ui}</I18nProvider>);
}

// Base UI's Select resolves item activation from a pointerdown+pointerup
// pair rather than a bare 'click' event — a plain fireEvent.click opens the
// popup but never registers the selection.
function clickViaPointer(el: HTMLElement): void {
  fireEvent.pointerDown(el, { button: 0, pointerId: 1 });
  fireEvent.pointerUp(el, { button: 0, pointerId: 1 });
  fireEvent.click(el);
}

// The AI action switcher (Analyze/Tailor/Cover Letter/Interview Prep/History)
// is a Select rendered before any tab-specific content, so it's always the
// first combobox in the DOM regardless of which tab is currently active.
async function selectAiAction(name: string): Promise<void> {
  clickViaPointer(screen.getAllByRole('combobox')[0] as HTMLElement);
  clickViaPointer(await screen.findByRole('option', { name }));
}

async function selectResume(name: string): Promise<void> {
  clickViaPointer(screen.getAllByRole('combobox')[1] as HTMLElement);
  clickViaPointer(await screen.findByRole('option', { name }));
}

describe('AiActionsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listResumes).mockResolvedValue({
      resumes: [{ id: 'resume-1', title: 'My Resume' } as never],
    });
    vi.mocked(listSearchProfiles).mockResolvedValue({ searchProfiles: [] });
    vi.mocked(getAIJobs).mockResolvedValue({ jobs: [], total: 0 });
  });

  it('generates a tailored resume for an application and renders the result (ADR-031 async pipeline)', async () => {
    vi.mocked(tailorResumeForApplication).mockResolvedValue({
      jobId: 'resume-1:vacancy-1',
      status: 'queued',
      currentStage: 'QUEUED',
      cached: false,
    });
    vi.mocked(getTailoringStatus).mockResolvedValue({
      jobId: 'resume-1:vacancy-1',
      status: 'completed',
      currentStage: 'COMPLETED',
      cached: false,
      result: {
        tailoredResumeText: 'Tailored resume text',
        skillMatrix: {
          matchedSkills: ['TypeScript'],
          missingSkills: [],
          weakSkills: [],
          strongSkills: [],
          atsKeywordCoverageRatio: 1,
          technologyCoverageRatio: 1,
          responsibilityCoverageRatio: 1,
          experienceCoverageRatio: 1,
        },
        changesApplied: [],
        changesRejected: [],
      },
    });

    renderWithI18n(
      <AiActionsPanel vacancyId="vacancy-1" vacancyTitle="Senior Engineer" applicationId="app-1" />
    );

    await selectAiAction('Tailor Resume');
    await waitFor(() => expect(screen.getAllByRole('combobox')).toHaveLength(2));

    await selectResume('My Resume');
    fireEvent.click(screen.getByRole('button', { name: 'Tailor Resume' }));

    await waitFor(() => {
      expect(screen.getByText('Tailored resume text')).toBeInTheDocument();
    });
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(tailorResumeForApplication).toHaveBeenCalledWith('app-1', 'resume-1', false);
  });

  it('shows an error message when tailoring fails to enqueue', async () => {
    vi.mocked(tailorResumeForApplication).mockRejectedValue(new Error('Tailoring failed'));

    renderWithI18n(
      <AiActionsPanel vacancyId="vacancy-1" vacancyTitle="Senior Engineer" applicationId="app-1" />
    );

    await selectAiAction('Tailor Resume');
    await waitFor(() => expect(screen.getAllByRole('combobox')).toHaveLength(2));

    await selectResume('My Resume');
    fireEvent.click(screen.getByRole('button', { name: 'Tailor Resume' }));

    await waitFor(() => {
      expect(screen.getByText('Tailoring failed')).toBeInTheDocument();
    });
  });

  it('shows a failed state when the async pipeline reports a failure', async () => {
    vi.mocked(tailorResumeForApplication).mockResolvedValue({
      jobId: 'resume-1:vacancy-1',
      status: 'queued',
      currentStage: 'QUEUED',
      cached: false,
    });
    vi.mocked(getTailoringStatus).mockResolvedValue({
      jobId: 'resume-1:vacancy-1',
      status: 'failed',
      currentStage: 'FAILED',
      cached: false,
      error: 'Simulated pipeline failure',
    });

    renderWithI18n(
      <AiActionsPanel vacancyId="vacancy-1" vacancyTitle="Senior Engineer" applicationId="app-1" />
    );

    await selectAiAction('Tailor Resume');
    await waitFor(() => expect(screen.getAllByRole('combobox')).toHaveLength(2));

    await selectResume('My Resume');
    fireEvent.click(screen.getByRole('button', { name: 'Tailor Resume' }));

    await waitFor(() => {
      expect(screen.getByText('Tailoring failed. Please try again.')).toBeInTheDocument();
    });
  });

  it('renders past AI results in the history tab', async () => {
    vi.mocked(getAIJobs).mockResolvedValue({
      jobs: [
        {
          id: 'job-1',
          feature: 'cover_letter',
          status: 'COMPLETED',
          provider: 'openai',
          model: 'gpt',
          totalTokens: 100,
          estimatedCost: 0.01,
          createdAt: '2026-01-01T00:00:00.000Z',
          result: { coverLetter: 'Dear hiring manager', tone: 'formal', keyPoints: [] },
        },
      ],
      total: 1,
    });

    renderWithI18n(<AiActionsPanel vacancyId="vacancy-1" vacancyTitle="Senior Engineer" />);

    await selectAiAction('History');

    const panel = await screen.findByRole('tabpanel');
    await waitFor(() => {
      expect(within(panel).getByText('Cover Letter')).toBeInTheDocument();
      expect(within(panel).getByText('COMPLETED')).toBeInTheDocument();
    });
    expect(getAIJobs).toHaveBeenCalledWith({ vacancyId: 'vacancy-1' });
  });

  it('shows a call-to-action instead of the analyze button when no active search profile exists', async () => {
    vi.mocked(listSearchProfiles).mockResolvedValue({ searchProfiles: [{ id: '1', isActive: false } as never] });

    renderWithI18n(<AiActionsPanel vacancyId="vacancy-1" vacancyTitle="Senior Engineer" />);

    await waitFor(() => {
      expect(
        screen.getByText('Create an active search profile before running AI analysis.')
      ).toBeInTheDocument();
    });
  });
});
