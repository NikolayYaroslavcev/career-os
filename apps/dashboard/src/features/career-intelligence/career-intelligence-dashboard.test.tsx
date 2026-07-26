import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CareerIntelligenceDashboard } from './career-intelligence-dashboard';
import { I18nProvider } from '@/lib/i18n/i18n-provider';

const mockGetOverview = vi.fn();
const mockGetFunnel = vi.fn();
const mockGetCareerHealth = vi.fn();
const mockGetInsights = vi.fn();
const mockRefreshInsights = vi.fn();

vi.mock('@/api/career-intelligence', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/career-intelligence')>();
  return {
    ...actual,
    getOverview: (...args: unknown[]): ReturnType<typeof mockGetOverview> => mockGetOverview(...args),
    getFunnel: (...args: unknown[]): ReturnType<typeof mockGetFunnel> => mockGetFunnel(...args),
    getCareerHealth: (...args: unknown[]): ReturnType<typeof mockGetCareerHealth> => mockGetCareerHealth(...args),
    getInsights: (...args: unknown[]): ReturnType<typeof mockGetInsights> => mockGetInsights(...args),
    refreshInsights: (...args: unknown[]): ReturnType<typeof mockRefreshInsights> => mockRefreshInsights(...args),
  };
});

function renderWithI18n(ui: React.ReactElement): ReturnType<typeof render> {
  return render(<I18nProvider initialLocale="en">{ui}</I18nProvider>);
}

const period = { from: '2026-01-01', to: '2026-02-01', label: 'all' };

const overview = {
  applicationsSent: 5,
  applicationsSaved: 2,
  hrInterviews: 1,
  technicalInterviews: 1,
  finalInterviews: 0,
  offers: 1,
  acceptedOffers: 0,
  rejectedOffers: 0,
  withdrawnApplications: 0,
  expiredApplications: 0,
  currentActive: 2,
  avgMatchScore: 72,
  avgSalary: null,
  avgResponseTime: 5,
  avgHiringTime: 20,
  period,
};

const funnel = {
  stages: [
    { name: 'Found', status: 'all', count: 10, percentage: 100, dropOff: 0, dropOffPercentage: 0 },
    { name: 'Applied', status: 'applied', count: 5, percentage: 50, dropOff: 5, dropOffPercentage: 50 },
  ],
  totalFound: 10,
  totalApplied: 5,
  totalOffers: 1,
  overallConversion: 10,
  period,
};

const health = {
  overall: 68,
  confidence: 'medium' as const,
  components: [
    { name: 'Activity Level', score: 80, weight: 0.2, description: 'x' },
    { name: 'Interview Rate', score: 60, weight: 0.25, description: 'x' },
  ],
  trend: 'improving' as const,
  trendDelta: 5,
  period,
};

const insights = {
  insights: [
    {
      id: 'insight-1',
      type: 'positive' as const,
      category: 'performance',
      title: 'Germany performs best for country',
      description: 'Germany has a higher interview rate.',
      metric: 'interviewRate',
      value: 60,
      change: 40,
      priority: 'high' as const,
    },
  ],
  generatedAt: '2026-01-15T00:00:00.000Z',
  period,
};

describe('CareerIntelligenceDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOverview.mockResolvedValue(overview);
    mockGetFunnel.mockResolvedValue(funnel);
    mockGetCareerHealth.mockResolvedValue(health);
    mockGetInsights.mockResolvedValue(insights);
  });

  it('renders the health score, overview metrics, and insights once loaded', async () => {
    renderWithI18n(<CareerIntelligenceDashboard />);

    await waitFor(() => {
      expect(screen.getByText('68')).toBeInTheDocument();
    });

    expect(screen.getByText('5')).toBeInTheDocument(); // applicationsSent
    expect(screen.getByText('Germany performs best for country')).toBeInTheDocument();
  });

  it('shows the empty-insights message when there are no insights', async () => {
    mockGetInsights.mockResolvedValue({ insights: [], generatedAt: period.from, period });

    renderWithI18n(<CareerIntelligenceDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/no insights yet/i)).toBeInTheDocument();
    });
  });

  it('refreshes insights when the refresh button is clicked', async () => {
    mockRefreshInsights.mockResolvedValue({
      insights: [{ ...insights.insights[0], title: 'Refreshed insight' }],
      generatedAt: period.from,
      period,
    });

    renderWithI18n(<CareerIntelligenceDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Germany performs best for country')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));

    await waitFor(() => {
      expect(mockRefreshInsights).toHaveBeenCalled();
      expect(screen.getByText('Refreshed insight')).toBeInTheDocument();
    });
  });

  it('shows an error message when loading fails', async () => {
    mockGetOverview.mockRejectedValue(new Error('network error'));

    renderWithI18n(<CareerIntelligenceDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load career intelligence data/i)).toBeInTheDocument();
    });
  });
});
