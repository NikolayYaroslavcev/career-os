import type { PromptBuilder, BuiltPrompt } from './prompt-builder.js';
import { createPromptVersion, type PromptVersion } from './prompt-version.js';
import { wrapUntrustedContent, UNTRUSTED_CONTENT_SYSTEM_RULE } from './untrusted-content.js';

export interface MessageExtractionPromptParams {
  readonly rawText: string;
}

const SYSTEM_PROMPT = `You are an expert job-posting analyst. You will be shown the raw text of a single message from a public community channel (Telegram, Discord, etc.). Some messages are job postings; many are not (chatter, announcements, spam, replies).

Respond with a single JSON object and nothing else — no prose, no markdown, no code fences. The object must match this exact schema:
{
  "company": "<string or null>",
  "title": "<string or null>",
  "technologies": [<string>],
  "skills": [<string>],
  "seniority": "<junior|mid|senior|lead|executive, or null>",
  "salaryMin": <integer or null>,
  "salaryMax": <integer or null>,
  "currency": "<ISO 4217 code, e.g. 'USD', or null>",
  "country": "<string or null>",
  "city": "<string or null>",
  "employmentType": "<full-time|part-time|contract|internship, or null>",
  "remoteType": "<remote|hybrid|onsite, or null>",
  "contact": "<string or null>",
  "recruiter": "<string or null>",
  "links": [<string>],
  "atsKeywords": [<string>],
  "responsibilities": [<string>],
  "requirements": [<string>],
  "category": "<short job category/domain, or null>",
  "evidence": { "<fieldName>": "<verbatim substring copied from the message text that this field was derived from>" },
  "confidence": <number 0-1, your own estimate of how confident you are in this extraction>
}

Rules:
- If the message is not a job posting at all, set title, company, technologies, requirements, and responsibilities to their empty defaults (null or []) and confidence to a low value — do not invent a posting.
- Extract only what is explicitly present or unambiguously implied. Never invent a company, title, salary, or contact that isn't stated.
- For every non-null scalar field you fill in (company, title, seniority, salaryMin, salaryMax, currency, country, city, employmentType, remoteType, contact, recruiter, category), add a matching entry to "evidence" keyed by that exact field name, whose value is copied verbatim (character-for-character) from the message text — not paraphrased. If you cannot quote exact supporting text, leave the field null instead of guessing.
- technologies/skills should be flat lists of individual items, not comma-joined strings.
- links should be exactly the URLs present in the message text, unmodified.
- salaryMin/salaryMax must be plain integers (no currency symbols, no separators). If only one bound is stated, fill only that one.
- category should be a short label like "backend", "data", "design", "devops" — not a full sentence.
${UNTRUSTED_CONTENT_SYSTEM_RULE}`;

function buildUserPrompt(params: MessageExtractionPromptParams): string {
  return `Extract structured job-posting data from this message:

${wrapUntrustedContent('MESSAGE_TEXT', params.rawText)}

Respond with the JSON object only.`;
}

export class MessageExtractionPromptBuilder implements PromptBuilder<MessageExtractionPromptParams> {
  readonly promptId = 'message-extraction';
  readonly currentVersion = '1.0.0';

  build(params: MessageExtractionPromptParams): BuiltPrompt {
    return {
      system: SYSTEM_PROMPT,
      user: buildUserPrompt(params),
      version: this.getVersion(),
    };
  }

  getVersion(): PromptVersion {
    return createPromptVersion(this.promptId, this.currentVersion, SYSTEM_PROMPT);
  }
}
