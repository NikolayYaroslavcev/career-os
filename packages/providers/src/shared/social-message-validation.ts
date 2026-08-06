import type { SocialMessageCandidate, SocialMessageValidationError } from '../interfaces/social-message-transport.js';

/**
 * Shared `SocialMessageCandidate` validation, used by every
 * `SocialMessageTransport` implementation (HtmlPreviewTransport,
 * BotApiTransport, ...) so transports don't each reimplement the same
 * required-field checks. Deliberately conservative — a transport's job is to
 * produce candidates, not to judge their content, so this only rejects
 * structurally broken candidates (missing identifiers, empty text, invalid
 * dates), never anything that looks like AI-extraction territory.
 */
export function validateSocialMessageCandidate(candidate: SocialMessageCandidate): SocialMessageValidationError | null {
  if (!candidate.sourceId || candidate.sourceId.trim().length === 0) {
    return { field: 'sourceId', message: 'sourceId is required', severity: 'error' };
  }
  if (!candidate.externalMessageId || candidate.externalMessageId.trim().length === 0) {
    return { field: 'externalMessageId', message: 'externalMessageId is required', severity: 'error' };
  }
  if (!candidate.rawText || candidate.rawText.trim().length === 0) {
    return { field: 'rawText', message: 'rawText must not be empty', severity: 'error' };
  }
  if (!(candidate.publishedAt instanceof Date) || Number.isNaN(candidate.publishedAt.getTime())) {
    return { field: 'publishedAt', message: 'publishedAt must be a valid Date', severity: 'error' };
  }
  return null;
}
