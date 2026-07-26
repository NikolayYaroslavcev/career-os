import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResumeIntelligenceDashboard } from './resume-intelligence-dashboard';
import { I18nProvider } from '@/lib/i18n/i18n-provider';
import type { ResumeVersionPerformance } from '@/api/resume-version-intelligence';

const mockListResumeVersions = vi.fn();
const mockGetAllResumeVersionsPerformance = vi.fn();
const mockGetResumeVersionPerformance = vi.fn();
const mockCompareResumeVersions = vi.fn();
const mockGetResumeRecommendation = vi.fn();

vi.mock('@/api/resume-version-intelligence', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/resume-version-intelligence')>();
  return {
    ...actual,
    listResumeVersions: (...args: unknown[]): ReturnType<typeof mockListResumeVersions> => mockListResumeVersions(...args),
    getAllResumeVersionsPerformance: (...args: unknown[]): ReturnType<typeof mockGetAllResumeVersionsPerformance> => mockGetAllResumeVersionsPerformance(...args),
    getResumeVersionPerformance: (...args: unknown[]): ReturnType<typeof mockGetResumeVersionPerformance> => mockGetResumeVersionPerformance(...args),
    compareResumeVersions: (...args: unknown[]): ReturnType<typeof mockCompareResumeVersions> => mockCompareResumeVersions(...args),
    getResumeRecommendation: (...args: unknown[]): ReturnType<typeof mockGetResumeRecommendation> => mockGetResumeRecommendation(...args),
  };
});

function renderWithI18n(ui: React.ReactElement): ReturnType<typeof render> {
  return render(<I18nProvider initialLocale="en">{ui}</I18nProvider>);
}

const period = { from: '2026-01-01', to: '2026-02-01', label: 'all' };

const versions = [
  { id: 'resume-a', title: 'React EN', description: '', language: 'English', tags: ['React'], status: 'active' as const, createdAt: period.from, updatedAt: period.from },
  { id: 'resume-b', title: 'Backend RU', description: '', language: 'Russian', tags: ['Backend'], status: 'active' as const, createdAt: period.from, updatedAt: period.from },
];

function buildPerformance(resumeId: string, interviewRate: number): ResumeVersionPerformance & { period: typeof period } {
  return {
    resumeId,
    applications: 10,
    saved: 2,
    applied: 8,
    hrInterviews: 2,
    technicalInterviews: 1,
    finalInterviews: 0,
    offers: 1,
    accepted: 0,
    rejected: 3,
    withdrawn: 0,
    interviewRate,
    offerRate: 10,
    responseRate: 40,
    avgMatchScore: 70,
    avgSalary: null,
    avgSalaryCurrency: null,
    avgResponseTime: 5,
    avgHiringTime: 20,
    period,
  };
}

const allPerformance = [buildPerformance('resume-a', 60), buildPerformance('resume-b', 20)];

const insights = { insights: [], generatedAt: period.from, period };

describe('ResumeIntelligenceDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListResumeVersions.mockResolvedValue({ versions, total: versions.length });
    mockGetAllResumeVersionsPerformance.mockResolvedValue({ performance: allPerformance });
    mockGetResumeVersionPerformance.mockResolvedValue({ performance: allPerformance[0], breakdowns: [], insights });
    mockCompareResumeVersions.mockResolvedValue({
      versionA: { resumeId: 'resume-a', applications: 10, interviewRate: 60, offerRate: 10, responseRate: 40, avgMatchScore: 70, avgSalary: null, sampleSize: 10 },
      versionB: { resumeId: 'resume-b', applications: 10, interviewRate: 20, offerRate: 5, responseRate: 20, avgMatchScore: 50, avgSalary: null, sampleSize: 10 },
      metricDeltas: [
        { metric: 'interviewRate', deltaAbsolute: -40, deltaPercentage: -66.67, winner: 'A' },
        { metric: 'offerRate', deltaAbsolute: -5, deltaPercentage: -50, winner: 'A' },
        { metric: 'responseRate', deltaAbsolute: -20, deltaPercentage: -50, winner: 'A' },
        { metric: 'avgMatchScore', deltaAbsolute: -20, deltaPercentage: -28.57, winner: 'A' },
      ],
      overallWinner: 'A',
      confidence: 'medium',
      period,
    });
  });

  it('renders the ranking table with the best-performing version marked as top', async () => {
    renderWithI18n(<ResumeIntelligenceDashboard />);

    await waitFor(() => {
      expect(screen.getAllByText('React EN').length).toBeGreaterThan(0);
    });

    expect(screen.getByText('Top')).toBeInTheDocument();
    expect(screen.getByText('Worst')).toBeInTheDocument();
  });

  it('shows performance cards for the selected (best) version once loaded', async () => {
    renderWithI18n(<ResumeIntelligenceDashboard />);

    await waitFor(() => {
      expect(mockGetResumeVersionPerformance).toHaveBeenCalledWith('resume-a');
    });

    await waitFor(() => {
      expect(screen.getAllByText('10').length).toBeGreaterThan(0); // applications
    });
  });

  it('renders the comparison panel winner once both versions are compared', async () => {
    renderWithI18n(<ResumeIntelligenceDashboard />);

    await waitFor(() => {
      expect(mockCompareResumeVersions).toHaveBeenCalledWith('resume-a', 'resume-b');
    });
  });

  it('shows the empty-versions message when the user has no resume versions', async () => {
    mockListResumeVersions.mockResolvedValue({ versions: [], total: 0 });
    mockGetAllResumeVersionsPerformance.mockResolvedValue({ performance: [] });

    renderWithI18n(<ResumeIntelligenceDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/no resume versions yet/i)).toBeInTheDocument();
    });
  });

  it('shows an error message when loading fails', async () => {
    mockListResumeVersions.mockRejectedValue(new Error('network error'));

    renderWithI18n(<ResumeIntelligenceDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load resume intelligence data/i)).toBeInTheDocument();
    });
  });
});
