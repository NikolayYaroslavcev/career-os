import type { LinkedInFeedPostCandidate } from '@careeros/extension-shared';
import { extractFeedPostCandidate, extractPostId } from './extract.js';
import { SeenPostTracker } from './dedup.js';
import { logDetectedPost, logDiagnostic, logIngestFailed, logIngestSucceeded } from './debug-log.js';

const POST_CONTAINER_SELECTOR = [
  '[data-urn^="urn:li:activity:"]',
  '[data-urn^="urn:li:share:"]',
  '[data-urn^="urn:li:ugcPost:"]',
  'div.feed-shared-update-v2',
  '[id^="expanded"]', // current SDUI feed markup — see extract.ts's EXPANDED_ID_PATTERN
].join(', ');

const SCAN_DEBOUNCE_MS = 400;

const tracker = new SeenPostTracker();
let scanTimer: ReturnType<typeof setTimeout> | null = null;

function isOutermostMatch(candidate: Element, allMatches: Element[]): boolean {
  return !allMatches.some(other => other !== candidate && other.contains(candidate));
}

function getScanRoot(): ParentNode {
  return document.querySelector('.scaffold-finite-scroll__content')
    ?? document.querySelector('main')
    ?? document.body;
}

function scan(): void {
  const matches = Array.from(getScanRoot().querySelectorAll<HTMLElement>(POST_CONTAINER_SELECTOR));
  const containers = matches.filter(candidate => isOutermostMatch(candidate, matches));

  for (const container of containers) {
    const postId = extractPostId(container);

    if (!postId) {
      logDiagnostic('missing-post-id', { outerHtml: container.outerHTML.slice(0, 500) });
      continue;
    }

    if (tracker.hasSeen(postId)) continue;
    tracker.markSeen(postId);

    const candidate = extractFeedPostCandidate(container);
    if (candidate) {
      logDetectedPost(candidate);
      void ingestCandidate(candidate);
    }
  }
}

/**
 * Fire-and-forget: a failed ingest is logged (see debug-log.ts) and dropped,
 * never retried here — see message-router.ts's handleLinkedInFeedPost doc
 * comment for why this deliberately doesn't feed OfflineQueue.
 */
function ingestCandidate(candidate: LinkedInFeedPostCandidate): Promise<void> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: 'LINKEDIN_FEED_POST_DETECTED', payload: candidate },
      (response: { ok: boolean; data?: unknown; error?: string } | undefined) => {
        if (chrome.runtime.lastError) {
          logIngestFailed(candidate.postId, chrome.runtime.lastError.message ?? 'unknown runtime error');
        } else if (!response?.ok) {
          logIngestFailed(candidate.postId, response?.error ?? 'unknown error');
        } else {
          logIngestSucceeded(candidate.postId, response.data);
        }
        resolve();
      }
    );
  });
}

function scheduleScan(): void {
  if (scanTimer !== null) return;
  scanTimer = setTimeout(() => {
    scanTimer = null;
    scan();
  }, SCAN_DEBOUNCE_MS);
}

function startObserving(): void {
  scan();

  const observer = new MutationObserver(() => {
    scheduleScan();
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

if (/^https:\/\/www\.linkedin\.com\/feed\/?(?:[/?#]|$)/.test(window.location.href)) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserving);
  } else {
    startObserving();
  }
}
