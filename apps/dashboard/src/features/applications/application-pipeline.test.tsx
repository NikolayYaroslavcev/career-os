import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApplicationPipeline } from './application-pipeline';
import { I18nProvider } from '@/lib/i18n/i18n-provider';

vi.mock('next/navigation', () => ({
  useSearchParams: (): URLSearchParams => new URLSearchParams(),
}));

const mockGetPipeline = vi.fn();
const mockUpdateApplicationStatus = vi.fn();
const mockGetApplication = vi.fn();
const mockListFollowUps = vi.fn();

vi.mock('@/api/applications', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/applications')>();
  return {
    ...actual,
    getPipeline: (...args: unknown[]): ReturnType<typeof mockGetPipeline> => mockGetPipeline(...args),
    updateApplicationStatus: (...args: unknown[]): ReturnType<typeof mockUpdateApplicationStatus> => mockUpdateApplicationStatus(...args),
    getApplication: (...args: unknown[]): ReturnType<typeof mockGetApplication> => mockGetApplication(...args),
    listFollowUps: (...args: unknown[]): ReturnType<typeof mockListFollowUps> => mockListFollowUps(...args),
  };
});

const mockGetVacancy = vi.fn();

vi.mock('@/api/sync', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/sync')>();
  return {
    ...actual,
    getVacancyDetail: (...args: unknown[]): ReturnType<typeof mockGetVacancy> => mockGetVacancy(...args),
  };
});

function renderWithI18n(ui: React.ReactElement): ReturnType<typeof render> {
  return render(<I18nProvider initialLocale="en">{ui}</I18nProvider>);
}

const application = {
  id: 'app-1',
  userId: 'user-1',
  vacancyId: 'vacancy-1',
  resumeId: null,
  matchResultId: null,
  recruiterId: null,
  status: 'saved' as const,
  notes: [],
  appliedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('ApplicationPipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetVacancy.mockResolvedValue({
      id: 'vacancy-1',
      title: 'Senior Backend Engineer',
      description: 'desc',
      company: { id: 'c-1', name: 'Acme Corp', website: null },
      location: 'Remote',
      remote: 'REMOTE',
      salaryMin: null,
      salaryMax: null,
      currency: null,
      requirements: [],
      url: null,
      publishedAt: null,
    });
    mockGetApplication.mockResolvedValue(application);
    mockListFollowUps.mockResolvedValue({ followUps: [] });
  });

  it('shows the empty state when there are no applications', async () => {
    mockGetPipeline.mockResolvedValue({ pipeline: [] });

    renderWithI18n(<ApplicationPipeline />);

    await waitFor(() => {
      expect(screen.getByText(/no applications yet/i)).toBeInTheDocument();
    });
  });

  it('renders a Kanban column per status with counts and cards', async () => {
    mockGetPipeline.mockResolvedValue({
      pipeline: [{ status: 'saved', count: 1, applications: [application] }],
    });

    renderWithI18n(<ApplicationPipeline />);

    await waitFor(() => {
      expect(screen.getByText('Senior Backend Engineer')).toBeInTheDocument();
    });

    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(mockGetVacancy).toHaveBeenCalledWith('vacancy-1');
  });

  it('changes an application status via the move-to dropdown', async () => {
    mockGetPipeline.mockResolvedValue({
      pipeline: [{ status: 'saved', count: 1, applications: [application] }],
    });
    mockUpdateApplicationStatus.mockResolvedValue({ ...application, status: 'started' });

    renderWithI18n(<ApplicationPipeline />);

    await waitFor(() => {
      expect(screen.getByText('Senior Backend Engineer')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/move application to another status/i), {
      target: { value: 'started' },
    });

    await waitFor(() => {
      expect(mockUpdateApplicationStatus).toHaveBeenCalledWith('app-1', 'started');
    });
  });

  it('opens the application detail view when a card is clicked', async () => {
    mockGetPipeline.mockResolvedValue({
      pipeline: [{ status: 'saved', count: 1, applications: [application] }],
    });

    renderWithI18n(<ApplicationPipeline />);

    await waitFor(() => {
      expect(screen.getByText('Senior Backend Engineer')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Senior Backend Engineer' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /back to pipeline/i })).toBeInTheDocument();
    });
  });
});
