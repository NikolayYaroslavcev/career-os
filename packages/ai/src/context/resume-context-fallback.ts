/**
 * Prepares a compact, AI-ready view of a resume without touching the stored
 * `rawText` (which stays intact for re-parsing, display, and future
 * features). Long resumes (multi-page Senior/Lead CVs) can't just be sent
 * to the model as-is or cut off at a fixed prefix: a naive prefix truncate
 * silently drops whatever comes after the cut point, which for a long CV is
 * very often the Skills or Education section rather than filler. Instead
 * this splits the resume into recognized sections (experience, skills,
 * summary, projects, education) and allocates the token budget across them
 * by relevance, so the parts an AI suggestion actually depends on
 * (experience + skills) survive even when the resume as a whole does not
 * fit.
 *
 * Used as the `fallbackContextBuilder` for ResumeContextProviderImpl by
 * every consumer (apps/backend, apps/worker) — lives in packages/ai
 * (alongside ResumeContextProviderImpl itself) rather than being duplicated
 * per-app, since this is substantial logic, not a tiny per-app factory.
 */

export type ResumeSectionName = 'header' | 'summary' | 'experience' | 'skills' | 'projects' | 'education';

const SECTION_HEADER_KEYWORDS: ReadonlyArray<{ section: ResumeSectionName; keywords: readonly string[] }> = [
  {
    section: 'experience',
    keywords: [
      'experience',
      'work experience',
      'professional experience',
      'employment history',
      'опыт работы',
      'опыт',
    ],
  },
  {
    section: 'skills',
    keywords: [
      'skills',
      'technical skills',
      'key skills',
      'technologies',
      'tech stack',
      'навыки',
      'ключевые навыки',
      'технологии',
      'стек технологий',
    ],
  },
  {
    section: 'summary',
    keywords: ['summary', 'profile', 'about me', 'objective', 'о себе', 'резюме', 'цель', 'обо мне'],
  },
  {
    section: 'projects',
    keywords: ['projects', 'key projects', 'проекты', 'ключевые проекты'],
  },
  {
    section: 'education',
    keywords: ['education', 'образование'],
  },
];

// Relative share of the token budget each section is worth when the resume
// has to be compacted. Experience and skills carry the signal an AI
// suggestion actually needs (positions, seniority, technologies); education
// and free-form headers are the first to be cut down.
const SECTION_TOKEN_WEIGHT: Record<ResumeSectionName, number> = {
  experience: 0.5,
  skills: 0.25,
  summary: 0.1,
  projects: 0.1,
  header: 0.1,
  education: 0.05,
};

interface ParsedSection {
  readonly name: ResumeSectionName;
  readonly lines: string[];
}

/**
 * Rough, dependency-free token estimate that weighs scripts differently:
 * Cyrillic/CJK/Hangul characters tokenize much less efficiently under
 * llama's BPE vocab (often close to 1 token per 1-1.5 chars) than Latin
 * text (~4 chars/token), so treating all characters the same badly
 * underestimates token count for non-English resumes.
 */
export function estimateTokens(text: string): number {
  let denseChars = 0;
  let plainChars = 0;

  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    const isDenseScript =
      (code >= 0x0400 && code <= 0x04ff) || // Cyrillic
      (code >= 0x4e00 && code <= 0x9fff) || // CJK unified ideographs
      (code >= 0x3040 && code <= 0x30ff) || // Hiragana/Katakana
      (code >= 0xac00 && code <= 0xd7a3); // Hangul syllables

    if (isDenseScript) {
      denseChars++;
    } else {
      plainChars++;
    }
  }

  return Math.ceil(denseChars / 1.5) + Math.ceil(plainChars / 4);
}

function detectSectionHeader(line: string): ResumeSectionName | null {
  const normalized = line.trim().toLowerCase().replace(/[:.]+$/, '');
  if (normalized.length === 0 || normalized.length > 40) return null;

  for (const { section, keywords } of SECTION_HEADER_KEYWORDS) {
    if (keywords.some((kw) => normalized === kw || normalized.startsWith(`${kw} `))) {
      return section;
    }
  }
  return null;
}

function splitIntoSections(text: string): ParsedSection[] {
  const sections: ParsedSection[] = [{ name: 'header', lines: [] }];

  for (const line of text.split(/\r?\n/)) {
    const header = detectSectionHeader(line);
    if (header) {
      sections.push({ name: header, lines: [] });
    } else {
      const lastSection = sections[sections.length - 1];
      if (lastSection) {
        lastSection.lines.push(line);
      }
    }
  }

  return sections.filter((section) => section.lines.some((line) => line.trim().length > 0));
}

function fitToTokenBudget(text: string, maxTokens: number): string {
  let cut = text;
  while (cut.length > 0 && estimateTokens(cut) > maxTokens) {
    cut = cut.slice(0, Math.floor(cut.length * 0.9));
  }
  return cut.trimEnd();
}

function capitalize(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function collapseBlankLines(text: string): string {
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Builds a compact resume context for the AI suggestion prompt. Never
 * mutates or reads back stored resume state — `rawText` is passed in and
 * the caller remains the source of truth for the full document.
 */
export function buildCompactResumeContext(rawText: string, maxTokens: number, maxChars: number): string {
  const cleaned = collapseBlankLines(rawText);

  if (estimateTokens(cleaned) <= maxTokens && cleaned.length <= maxChars) {
    return cleaned;
  }

  const sections = splitIntoSections(cleaned);

  // No recognizable structure (e.g. a single unstructured paragraph) — fall
  // back to a plain token-aware truncate rather than forcing a section
  // model onto text that doesn't have one.
  if (sections.length <= 1) {
    const capped = cleaned.length > maxChars ? cleaned.slice(0, maxChars) : cleaned;
    const fitted = fitToTokenBudget(capped, maxTokens);
    return `${fitted}\n\n[resume truncated for length]`;
  }

  const ordered = [...sections].sort(
    (a, b) => SECTION_TOKEN_WEIGHT[b.name] - SECTION_TOKEN_WEIGHT[a.name]
  );

  let remainingTokens = maxTokens;
  let remainingWeight = sections.reduce((sum, s) => sum + SECTION_TOKEN_WEIGHT[s.name], 0);
  const parts: string[] = [];

  for (const section of ordered) {
    const weight = SECTION_TOKEN_WEIGHT[section.name];
    const share = remainingWeight > 0 ? remainingTokens * (weight / remainingWeight) : 0;
    const sectionText = section.lines.join('\n').trim();
    const sectionTokens = estimateTokens(sectionText);
    const allocated = Math.max(1, Math.round(share));

    const fitted = sectionTokens <= allocated ? sectionText : fitToTokenBudget(sectionText, allocated);
    if (fitted.length > 0) {
      const label = section.name === 'header' ? '' : `## ${capitalize(section.name)}\n`;
      parts.push(`${label}${fitted}`);
    }

    remainingTokens = Math.max(0, remainingTokens - estimateTokens(fitted));
    remainingWeight -= weight;
  }

  const combined = parts.join('\n\n').trim();
  const finalText = combined.length > maxChars ? combined.slice(0, maxChars) : combined;

  return `${finalText}\n\n[resume condensed for length; experience and skills prioritized]`;
}
