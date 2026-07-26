import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FollowUpsDashboard } from './follow-ups-dashboard';
import { I18nProvider } from '@/lib/i18n/i18n-provider';
import { listFollowUpBuckets, completeFollowUpById, type FollowUpBuckets, type EnrichedFollowUp } from '@/api/follow-ups';

vi.mock('@/api/follow-ups', () => ({
  listFollowUpBuckets: vi.fn(),
  createFollowUp: vi.fn(),
  rescheduleFollowUp: vi.fn(),
  deleteFollowUp: vi.fn(),
  completeFollowUpById: vi.fn(),
}));

function renderWithI18n(ui: React.ReactElement): ReturnType<typeof render> {
  return render(<I18nProvider initialLocale="en">{ui}</I18nProvider>);
}

function buildItem(overrides: Partial<EnrichedFollowUp> = {}): EnrichedFollowUp {
  return {
    id: 'f-1',
    applicationId: 'a-1',
    type: 'follow_up',
    status: 'pending',
    scheduledAt: new Date().toISOString(),
    message: null,
    vacancyTitle: 'Frontend Developer',
    companyName: 'Google',
    daysSinceApplied: 12,
    ...overrides,
  };
}

const EMPTY: FollowUpBuckets = { overdue: [], today: [], upcoming: [], completed: [] };

describe('FollowUpsDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the empty state when there are no follow-ups at all', async () => {
    vi.mocked(listFollowUpBuckets).mockResolvedValue(EMPTY);

    renderWithI18n(<FollowUpsDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/They're created automatically/)).toBeInTheDocument();
    });
  });

  it('renders an overdue follow-up with the recommended action and days-since-applied', async () => {
    vi.mocked(listFollowUpBuckets).mockResolvedValue({
      ...EMPTY,
      overdue: [buildItem({ id: 'f-overdue', companyName: 'Google', vacancyTitle: 'Frontend Developer', daysSinceApplied: 12 })],
    });

    renderWithI18n(<FollowUpsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Google')).toBeInTheDocument();
    });
    expect(screen.getByText('Frontend Developer')).toBeInTheDocument();
    expect(screen.getByText('Applied 12 days ago')).toBeInTheDocument();
    expect(screen.getByText(/Send a follow-up message/)).toBeInTheDocument();
  });

  it('renders an interview reminder with its own recommended action', async () => {
    vi.mocked(listFollowUpBuckets).mockResolvedValue({
      ...EMPTY,
      today: [buildItem({ id: 'f-interview', type: 'interview', companyName: 'Company X', daysSinceApplied: null })],
    });

    renderWithI18n(<FollowUpsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Company X')).toBeInTheDocument();
    });
    expect(screen.getByText(/Prepare for your interview/)).toBeInTheDocument();
  });

  it('filtering to "Overdue" hides the other sections', async () => {
    vi.mocked(listFollowUpBuckets).mockResolvedValue({
      overdue: [buildItem({ id: 'f-overdue' })],
      today: [buildItem({ id: 'f-today' })],
      upcoming: [],
      completed: [],
    });

    renderWithI18n(<FollowUpsDashboard />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'Overdue' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Overdue/ }));

    expect(screen.getByRole('heading', { name: 'Overdue' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Today' })).not.toBeInTheDocument();
  });

  it('completing a follow-up calls the API and refreshes the list', async () => {
    vi.mocked(listFollowUpBuckets)
      .mockResolvedValueOnce({ ...EMPTY, overdue: [buildItem({ id: 'f-1' })] })
      .mockResolvedValueOnce(EMPTY);
    vi.mocked(completeFollowUpById).mockResolvedValue(buildItem({ id: 'f-1', status: 'completed' }));

    renderWithI18n(<FollowUpsDashboard />);
    await waitFor(() => expect(screen.getByText('Google')).toBeInTheDocument());

    const card = screen.getByText('Google').closest('div.space-y-1\\.5') as HTMLElement;
    fireEvent.click(within(card).getByRole('button', { name: /Complete/ }));

    await waitFor(() => expect(completeFollowUpById).toHaveBeenCalledWith('f-1'));
    await waitFor(() => expect(listFollowUpBuckets).toHaveBeenCalledTimes(2));
  });
});
