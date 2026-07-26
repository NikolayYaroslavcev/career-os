import type { ProviderDetector } from '../providers/base-provider.js';
import { LinkedInDetector } from '../providers/linkedin/detector.js';
import { HHDetector } from '../providers/hh/detector.js';
import { GreenhouseDetector } from '../providers/greenhouse/detector.js';
import { LeverDetector } from '../providers/lever/detector.js';
import { AshbyDetector } from '../providers/ashby/detector.js';
import { WorkdayDetector } from '../providers/workday/detector.js';
import { TeamtailorDetector } from '../providers/teamtailor/detector.js';
import { SmartRecruitersDetector } from '../providers/smartrecruiters/detector.js';
import { RecruiteeDetector } from '../providers/recruitee/detector.js';
import { GenericJsonLdDetector } from '../providers/generic/jsonld.js';

const registry: ProviderDetector[] = [
  new LinkedInDetector(),
  new HHDetector(),
  new GreenhouseDetector(),
  new LeverDetector(),
  new AshbyDetector(),
  new WorkdayDetector(),
  new TeamtailorDetector(),
  new SmartRecruitersDetector(),
  new RecruiteeDetector(),
  new GenericJsonLdDetector(),
];

function detectProvider(url: string): ProviderDetector | null {
  for (const detector of registry) {
    if (detector.id !== 'generic' && detector.matches(url)) {
      return detector;
    }
  }
  for (const detector of registry) {
    if (detector.id === 'generic' && detector.matches(url)) {
      return detector;
    }
  }
  return null;
}

function init(): void {
  const url = window.location.href;
  const detector = detectProvider(url);

  if (!detector) return;

  const vacancy = detector.extract(document, url);
  if (vacancy) {
    chrome.runtime.sendMessage({
      type: 'EXTRACT_VACANCY_COMPLETE',
      payload: vacancy,
    });

    import('./panel-injector.js').then(({ injectPanel }) => {
      injectPanel(vacancy, {
        saved: false,
        companyWatched: false,
      });
    });
  }

  const applyEvent = detector.detectApply(document, url);
  if (applyEvent) {
    chrome.runtime.sendMessage({
      type: 'APPLY_DETECTED',
      payload: applyEvent,
    });
  }

  if (detector.getApplyButtonSelector()) {
    observeApplyButton(detector, url);
  }
}

function observeApplyButton(detector: ProviderDetector, url: string): void {
  const selector = detector.getApplyButtonSelector();
  if (!selector) return;

  const observer = new MutationObserver(() => {
    const applyButton = document.querySelector(selector);
    if (applyButton) {
      applyButton.addEventListener('click', () => {
        chrome.runtime.sendMessage({
          type: 'APPLY_DETECTED',
          payload: {
            provider: detector.id,
            url,
            timestamp: new Date().toISOString(),
            method: 'click',
          },
        });
      }, { once: true });
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
