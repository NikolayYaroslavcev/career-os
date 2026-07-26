import type { ContentVacancy, VacancyStatus } from '@careeros/extension-shared';

const PANEL_ID = 'careeros-panel-root';

export function injectPanel(vacancy: ContentVacancy, status: VacancyStatus): void {
  if (document.getElementById(PANEL_ID)) return;

  const container = document.createElement('div');
  container.id = PANEL_ID;
  container.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    color: #111827;
  `;

  const shadow = container.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = getPanelStyles();
  shadow.appendChild(style);

  const panelHost = document.createElement('div');
  panelHost.id = 'careeros-panel';
  shadow.appendChild(panelHost);

  document.body.appendChild(container);

  renderPanel(panelHost, vacancy, status);
}

interface AiActionState {
  action: 'analyze' | 'tailor' | 'cover-letter' | 'interview-prep';
  loading: boolean;
  summary?: string;
  vacancyId?: string;
  error?: string;
}

const AI_ACTION_LABELS: Record<AiActionState['action'], string> = {
  analyze: 'Analysis',
  tailor: 'Tailored resume',
  'cover-letter': 'Cover letter',
  'interview-prep': 'Interview prep',
};

function summarizeAiResult(action: AiActionState['action'], result: unknown): string {
  const r = (result ?? {}) as Record<string, unknown>;
  switch (action) {
    case 'analyze':
      return typeof r.recommendation === 'string'
        ? `${r.recommendation} (${typeof r.overallScore === 'number' ? r.overallScore : '?'}/100)`
        : 'Analysis ready';
    case 'cover-letter':
      return Array.isArray(r.keyPoints) && typeof r.keyPoints[0] === 'string' ? r.keyPoints[0] : 'Cover letter ready';
    case 'interview-prep':
      return Array.isArray(r.questions) ? `${r.questions.length} questions prepared` : 'Interview prep ready';
    default:
      return 'Tailored resume ready';
  }
}

let cachedDashboardUrl: string | null = null;

async function getDashboardUrl(): Promise<string> {
  if (cachedDashboardUrl) return cachedDashboardUrl;
  const response = await new Promise<{ ok: boolean; data?: { backend?: { dashboardUrl?: string } } }>((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, resolve);
  });
  cachedDashboardUrl = response?.data?.backend?.dashboardUrl ?? 'http://localhost:3001';
  return cachedDashboardUrl;
}

function renderPanel(host: HTMLElement, vacancy: ContentVacancy, status: VacancyStatus): void {
  let collapsed = false;
  let saving = false;
  let analyzing = false;
  let aiState: AiActionState | null = null;

  const update = () => {
    host.innerHTML = '';

    if (collapsed) {
      const collapsedBtn = document.createElement('div');
      collapsedBtn.className = 'careeros-collapsed';
      collapsedBtn.innerHTML = `
        <div class="careeros-collapsed-icon">C</div>
      `;
      collapsedBtn.addEventListener('click', () => {
        collapsed = false;
        update();
      });
      host.appendChild(collapsedBtn);
      return;
    }

    const panel = document.createElement('div');
    panel.className = 'careeros-panel';

    panel.innerHTML = `
      <div class="careeros-header">
        <div class="careeros-logo">CareerOS</div>
        <button class="careeros-close" title="Collapse">&times;</button>
      </div>
      <div class="careeros-body">
        <div class="careeros-vacancy-info">
          <div class="careeros-title">${escapeHtml(vacancy.title)}</div>
          <div class="careeros-company">${escapeHtml(vacancy.company)}</div>
          ${vacancy.location ? `<div class="careeros-location">${escapeHtml(vacancy.location)}</div>` : ''}
          ${vacancy.salary ? `<div class="careeros-salary">${formatSalary(vacancy.salary)}</div>` : ''}
        </div>
        <div class="careeros-status-row">
          <span class="careeros-badge ${status.saved ? 'careeros-badge-saved' : 'careeros-badge-unsaved'}">
            ${status.saved ? 'Saved' : 'Not saved'}
          </span>
          ${status.companyWatched ? '<span class="careeros-badge careeros-badge-watched">Watching</span>' : ''}
          ${status.matchPercentage !== undefined ? `<span class="careeros-badge careeros-badge-match">${status.matchPercentage}% match</span>` : ''}
        </div>
        <div class="careeros-actions">
          <button class="careeros-btn careeros-btn-primary" ${saving ? 'disabled' : ''} data-action="save">
            ${saving ? 'Saving...' : status.saved ? 'Saved' : 'Save to CareerOS'}
          </button>
          <button class="careeros-btn careeros-btn-secondary" ${analyzing ? 'disabled' : ''} data-action="analyze">
            ${analyzing ? 'Analyzing...' : 'Analyze'}
          </button>
          <button class="careeros-btn careeros-btn-secondary" ${aiState?.loading ? 'disabled' : ''} data-action="tailor">
            ${aiState?.loading && aiState.action === 'tailor' ? 'Tailoring...' : 'Tailor Resume'}
          </button>
          <button class="careeros-btn careeros-btn-secondary" ${aiState?.loading ? 'disabled' : ''} data-action="cover-letter">
            ${aiState?.loading && aiState.action === 'cover-letter' ? 'Generating...' : 'Cover Letter'}
          </button>
          <button class="careeros-btn careeros-btn-secondary" ${aiState?.loading ? 'disabled' : ''} data-action="interview-prep">
            ${aiState?.loading && aiState.action === 'interview-prep' ? 'Generating...' : 'Interview Prep'}
          </button>
          <a class="careeros-btn careeros-btn-link" href="#" target="_blank" data-action="open-careeros">Open CareerOS</a>
        </div>
        ${aiState && !aiState.loading ? renderAiResult(aiState) : ''}
      </div>
    `;

    const closeBtn = panel.querySelector('.careeros-close');
    closeBtn?.addEventListener('click', () => {
      collapsed = true;
      update();
    });

    panel.querySelector('[data-action="save"]')?.addEventListener('click', async () => {
      if (saving || status.saved) return;
      saving = true;
      update();
      try {
        chrome.runtime.sendMessage({ type: 'SAVE_VACANCY', payload: vacancy }, (response) => {
          if (response?.ok) {
            status.saved = true;
            status.vacancyId = response.data?.id;
          }
          saving = false;
          update();
        });
      } catch {
        saving = false;
        update();
      }
    });

    const runAiAction = (action: AiActionState['action'], messageType: string) => {
      if (aiState?.loading) return;
      if (action === 'analyze') analyzing = true;
      aiState = { action, loading: true };
      update();
      chrome.runtime.sendMessage({ type: messageType, payload: vacancy }, (response) => {
        analyzing = false;
        if (response?.ok) {
          aiState = {
            action,
            loading: false,
            summary: summarizeAiResult(action, response.data?.result),
            vacancyId: response.data?.vacancyId,
          };
        } else {
          aiState = { action, loading: false, error: response?.error ?? 'Action failed' };
        }
        update();
      });
    };

    panel.querySelector('[data-action="analyze"]')?.addEventListener('click', () => runAiAction('analyze', 'ANALYZE_VACANCY'));
    panel.querySelector('[data-action="tailor"]')?.addEventListener('click', () => runAiAction('tailor', 'TAILOR_RESUME'));
    panel.querySelector('[data-action="cover-letter"]')?.addEventListener('click', () => runAiAction('cover-letter', 'COVER_LETTER'));
    panel.querySelector('[data-action="interview-prep"]')?.addEventListener('click', () => runAiAction('interview-prep', 'INTERVIEW_PREP'));

    const openLink = panel.querySelector('[data-action="open-careeros"]');
    if (openLink instanceof HTMLAnchorElement) {
      getDashboardUrl().then((url) => {
        openLink.href = url;
      });
    }

    const viewResultLink = panel.querySelector('[data-action="view-ai-result"]');
    if (viewResultLink instanceof HTMLAnchorElement && aiState?.vacancyId) {
      const vacancyId = aiState.vacancyId;
      getDashboardUrl().then((url) => {
        viewResultLink.href = `${url}/app/search/${vacancyId}`;
      });
    }

    host.appendChild(panel);
  };

  update();
}

function renderAiResult(state: AiActionState): string {
  if (state.error) {
    return `<div class="careeros-ai-result careeros-ai-result-error">${escapeHtml(state.error)}</div>`;
  }
  return `
    <div class="careeros-ai-result">
      <div class="careeros-ai-result-label">${escapeHtml(AI_ACTION_LABELS[state.action])}</div>
      <div class="careeros-ai-result-summary">${escapeHtml(state.summary ?? '')}</div>
      ${state.vacancyId ? '<a class="careeros-ai-result-link" href="#" data-action="view-ai-result" target="_blank">View full result in CareerOS</a>' : ''}
    </div>
  `;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatSalary(salary: ContentVacancy['salary']): string {
  if (!salary) return '';
  const parts: string[] = [];
  if (salary.min) parts.push(salary.min.toLocaleString());
  if (salary.max) parts.push(salary.max.toLocaleString());
  if (parts.length === 0) return '';
  const range = parts.length > 1 ? `${parts[0]} - ${parts[1]}` : parts[0];
  return `${range} ${salary.currency}/${salary.period}`;
}

function getPanelStyles(): string {
  return `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    .careeros-collapsed {
      width: 40px;
      height: 40px;
      background: #2563eb;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }

    .careeros-collapsed:hover {
      transform: scale(1.05);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }

    .careeros-collapsed-icon {
      color: white;
      font-weight: 700;
      font-size: 18px;
    }

    .careeros-panel {
      width: 320px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.05);
      overflow: hidden;
      animation: careeros-slide-in 0.2s ease-out;
    }

    @keyframes careeros-slide-in {
      from {
        opacity: 0;
        transform: translateY(-8px) scale(0.98);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .careeros-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid #e5e7eb;
      background: #f9fafb;
    }

    .careeros-logo {
      font-weight: 700;
      font-size: 15px;
      color: #2563eb;
    }

    .careeros-close {
      width: 24px;
      height: 24px;
      border: none;
      background: none;
      font-size: 18px;
      cursor: pointer;
      color: #6b7280;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s;
    }

    .careeros-close:hover {
      background: #e5e7eb;
      color: #111827;
    }

    .careeros-body {
      padding: 16px;
    }

    .careeros-vacancy-info {
      margin-bottom: 12px;
    }

    .careeros-title {
      font-weight: 600;
      font-size: 14px;
      margin-bottom: 2px;
      color: #111827;
    }

    .careeros-company {
      font-size: 13px;
      color: #6b7280;
    }

    .careeros-location {
      font-size: 12px;
      color: #9ca3af;
      margin-top: 2px;
    }

    .careeros-salary {
      font-size: 12px;
      color: #16a34a;
      margin-top: 2px;
      font-weight: 500;
    }

    .careeros-status-row {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }

    .careeros-badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
    }

    .careeros-badge-saved {
      background: #dcfce7;
      color: #166534;
    }

    .careeros-badge-unsaved {
      background: #f3f4f6;
      color: #6b7280;
    }

    .careeros-badge-watched {
      background: #dbeafe;
      color: #1e40af;
    }

    .careeros-badge-match {
      background: #fef3c7;
      color: #92400e;
    }

    .careeros-actions {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .careeros-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s, opacity 0.15s;
      text-decoration: none;
    }

    .careeros-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .careeros-btn-primary {
      background: #2563eb;
      color: white;
      border: none;
    }

    .careeros-btn-primary:hover:not(:disabled) {
      background: #1d4ed8;
    }

    .careeros-btn-secondary {
      background: #f3f4f6;
      color: #374151;
      border: 1px solid #e5e7eb;
    }

    .careeros-btn-secondary:hover:not(:disabled) {
      background: #e5e7eb;
    }

    .careeros-btn-link {
      background: none;
      color: #2563eb;
      border: none;
      padding: 4px 0;
    }

    .careeros-btn-link:hover {
      text-decoration: underline;
    }

    .careeros-ai-result {
      margin-top: 10px;
      padding: 10px;
      border-radius: 8px;
      background: #f0f9ff;
      border: 1px solid #bae6fd;
    }

    .careeros-ai-result-error {
      background: #fef2f2;
      border-color: #fecaca;
      color: #991b1b;
      font-size: 12px;
    }

    .careeros-ai-result-label {
      font-weight: 600;
      font-size: 12px;
      color: #0369a1;
      margin-bottom: 2px;
    }

    .careeros-ai-result-summary {
      font-size: 12px;
      color: #374151;
    }

    .careeros-ai-result-link {
      display: inline-block;
      margin-top: 4px;
      font-size: 12px;
      color: #2563eb;
      text-decoration: none;
    }

    .careeros-ai-result-link:hover {
      text-decoration: underline;
    }
  `;
}
