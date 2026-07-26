import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiagnosticsDashboard } from './diagnostics-dashboard';
import { I18nProvider } from '@/lib/i18n/i18n-provider';
import {
  getProviderDiagnostics,
  getQueueDiagnostics,
  getSearchRunTraces,
  getAiDiagnostics,
  type ProviderDiagnostics,
} from '@/api/diagnostics';

vi.mock('@/api/diagnostics', () => ({
  getProviderDiagnostics: vi.fn(),
  getQueueDiagnostics: vi.fn(),
  getSearchRunTraces: vi.fn(),
  getAiDiagnostics: vi.fn(),
}));

function renderWithI18n(ui: React.ReactElement): ReturnType<typeof render> {
  return render(<I18nProvider initialLocale="en">{ui}</I18nProvider>);
}

const baseQueue = { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
const baseAi = {
  providers: [],
  metrics: {
    cacheReused: 0,
    triageTotal: 0,
    triagePassed: 0,
    triageRejected: 0,
    failed: 0,
    evaluated: 0,
    avgBatchDurationMs: 0,
  },
};

function mockProviders(providers: ProviderDiagnostics[]): void {
  vi.mocked(getProviderDiagnostics).mockResolvedValue({ providers });
  vi.mocked(getQueueDiagnostics).mockResolvedValue({ queue: baseQueue });
  vi.mocked(getSearchRunTraces).mockResolvedValue({ runs: [] });
  vi.mocked(getAiDiagnostics).mockResolvedValue(baseAi);
}

describe('DiagnosticsDashboard provider status rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a READY provider with no extra detail', async () => {
    mockProviders([
      {
        providerId: 'remote_ok',
        registered: true,
        enabled: true,
        configured: true,
        authenticated: 'not_required',
        health: 'healthy',
        status: 'READY',
        bulkSyncStatus: 'SUPPORTED',
      },
    ]);

    renderWithI18n(<DiagnosticsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('remote_ok')).toBeInTheDocument();
    });
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('renders a BLOCKED provider (HH) with its DDoS-Guard reason', async () => {
    mockProviders([
      {
        providerId: 'hh',
        registered: true,
        enabled: true,
        configured: true,
        authenticated: 'not_required',
        health: 'unknown',
        status: 'BLOCKED',
        statusReason: 'DDoS-Guard blocks API requests from current infrastructure.',
        bulkSyncStatus: 'SUPPORTED',
      },
    ]);

    renderWithI18n(<DiagnosticsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('hh')).toBeInTheDocument();
    });
    expect(screen.getByText('Blocked')).toBeInTheDocument();
    expect(
      screen.getByText('DDoS-Guard blocks API requests from current infrastructure.')
    ).toBeInTheDocument();
  });

  it('renders LinkedIn as READY with its browser extension ingestion mode and unsupported bulk sync', async () => {
    mockProviders([
      {
        providerId: 'linkedin',
        registered: true,
        enabled: true,
        configured: true,
        authenticated: 'not_required',
        health: 'unknown',
        status: 'READY',
        ingestionMode: 'Browser Extension ingestion',
        bulkSyncStatus: 'NOT_SUPPORTED_FOR_BULK_SYNC',
      },
    ]);

    renderWithI18n(<DiagnosticsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('linkedin')).toBeInTheDocument();
    });
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByText(/Browser Extension ingestion/)).toBeInTheDocument();
    expect(screen.getByText(/Not supported/)).toBeInTheDocument();
  });

  it('renders an unconfigured ATS provider (Greenhouse) as NEEDS_CONFIGURATION with its required env vars', async () => {
    mockProviders([
      {
        providerId: 'greenhouse',
        registered: false,
        enabled: false,
        configured: false,
        authenticated: 'missing',
        health: 'unknown',
        status: 'NEEDS_CONFIGURATION',
        statusReason: 'GREENHOUSE_BOARD_TOKEN/GREENHOUSE_COMPANY_NAME not set',
        requiredConfig: ['GREENHOUSE_BOARD_TOKEN', 'GREENHOUSE_COMPANY_NAME'],
        bulkSyncStatus: 'SUPPORTED',
      },
    ]);

    renderWithI18n(<DiagnosticsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('greenhouse')).toBeInTheDocument();
    });
    expect(screen.getByText('Needs configuration')).toBeInTheDocument();
    expect(
      screen.getByText(/GREENHOUSE_BOARD_TOKEN, GREENHOUSE_COMPANY_NAME/)
    ).toBeInTheDocument();
  });
});
