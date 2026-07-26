/**
 * Shared technology keyword list for extraction from vacancy text.
 * Consolidates keywords from individual provider fetchers into one place.
 */
export const TECH_KEYWORDS: readonly string[] = [
  'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'golang', 'go', 'rust',
  '1c', '1с', 'php', 'ruby', 'scala', 'kotlin', 'swift', 'dart', 'flutter',
  'react', 'vue', 'vue.js', 'angular', 'node', 'node.js', 'nodejs', 'express', 'django', 'flask', 'spring', 'spring boot', 'laravel',
  'nextjs', 'next.js', 'nuxtjs', 'nuxt.js', 'svelte', 'sveltekit',
  'aws', 'azure', 'gcp', 'google cloud', 'docker', 'kubernetes', 'k8s', 'terraform', 'ansible',
  'postgresql', 'postgres', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'clickhouse', 'kafka', 'cassandra',
  'git', 'ci/cd', 'jenkins', 'gitlab', 'github actions',
  'html', 'css', 'scss', 'less', 'tailwind', 'tailwindcss',
  'sql', 'nosql', 'graphql', 'rest', 'restapi', 'grpc',
  'linux', 'bash', 'powershell',
  'machine learning', 'ml', 'ai', 'artificial intelligence', 'data science', 'pandas', 'pytorch', 'tensorflow',
  'android', 'ios', 'react native', ' xamarin',
  'figma', 'sketch', 'adobe xd',
  'webpack', 'vite', 'esbuild', 'rollup',
  'jest', 'mocha', 'pytest', 'vitest', 'cypress', 'playwright', 'selenium',
  'devops', 'sre', 'microservices', 'serverless', 'lambda',
  'solid', 'oop', 'functional programming',
  'agile', 'scrum', 'kanban',
];

interface TechPattern {
  readonly pattern: RegExp;
  readonly tech: string;
}

interface TechContextRule {
  readonly tech: string;
  readonly contextPatterns: RegExp[];
}

/**
 * Patterns for technologies with special characters that need regex escaping.
 */
const SPECIAL_TECH_PATTERNS: readonly TechPattern[] = [
  { pattern: /\bc\+\+/gi, tech: 'c++' },
  { pattern: /\bc#/gi, tech: 'c#' },
  { pattern: /\bnode\.js\b/gi, tech: 'node.js' },
  { pattern: /\bvue\.js\b/gi, tech: 'vue.js' },
  { pattern: /\bnext\.js\b/gi, tech: 'next.js' },
  { pattern: /\bnuxt\.js\b/gi, tech: 'nuxt.js' },
  { pattern: /\breact\s+native\b/gi, tech: 'react native' },
  { pattern: /\bspring\s+boot\b/gi, tech: 'spring boot' },
  { pattern: /\bgithub\s+actions\b/gi, tech: 'github actions' },
  { pattern: /\bgoogle\s+cloud\b/gi, tech: 'google cloud' },
  { pattern: /\bci\/cd\b/gi, tech: 'ci/cd' },
  { pattern: /\bk8s\b/gi, tech: 'k8s' },
  { pattern: /\b1c\b/gi, tech: '1c' },
  { pattern: /\b1с\b/g, tech: '1с' },
  { pattern: /\brestapi\b/gi, tech: 'restapi' },
  { pattern: /\bnosql\b/gi, tech: 'nosql' },
  { pattern: /\bfunctional\s+programming\b/gi, tech: 'functional programming' },
  { pattern: /\badobe\s+xd\b/gi, tech: 'adobe xd' },
  { pattern: /\bmachine\s+learning\b/gi, tech: 'machine learning' },
  { pattern: /\bartificial\s+intelligence\b/gi, tech: 'artificial intelligence' },
  { pattern: /\bdata\s+science\b/gi, tech: 'data science' },
  { pattern: /\btailwindcss\b/gi, tech: 'tailwindcss' },
  { pattern: /\bsveltekit\b/gi, tech: 'sveltekit' },
  { pattern: /\bnextjs\b/gi, tech: 'nextjs' },
  { pattern: /\bnuxtjs\b/gi, tech: 'nuxtjs' },
  { pattern: /\bnodejs\b/gi, tech: 'nodejs' },
  { pattern: /\bxamarin\b/gi, tech: 'xamarin' },
];

/**
 * Technologies that require surrounding context to avoid false positives.
 * These are short or ambiguous keywords that appear as substrings in common words.
 */
const CONTEXT_REQUIRED_RULES: readonly TechContextRule[] = [
  {
    tech: 'ai',
    contextPatterns: [
      /\bai\s+(engineer|developer|architect|specialist|researcher|team|lead|project|system|infrastructure|ops|stack|driven|based|powered|enabled|tool|platform|model|models|training|data|security|product|ml|deeplearning|nlp|vision|robotics|ethics|strategy|transformation|adoption)/i,
      /\b(artificial\s+intelligence)\b/i,
      /\bai\/ml\b/i,
      /\bml\/ai\b/i,
      /\bai\/dl\b/i,
      /\bdeep\s*learning\b/i,
      /\bnlp\b/i,
      /\bcomputer\s+vision\b/i,
      /\bgenai\b/i,
      /\bllms?\b/i,
    ],
  },
  {
    tech: 'ml',
    contextPatterns: [
      /\bml\s+(engineer|developer|architect|specialist|researcher|team|lead|project|system|infrastructure|ops|stack|driven|based|powered|enabled|tool|platform|model|models|training|data|pipeline|framework|algorithms)/i,
      /\b(machine\s+learning)\b/i,
      /\bai\/ml\b/i,
      /\bml\/ai\b/i,
      /\bdl\/ml\b/i,
      /\bdeep\s*learning\b/i,
      /\bpytorch\b/i,
      /\btensorflow\b/i,
    ],
  },
  {
    tech: 'go',
    contextPatterns: [
      /\bgo\s+(developer|engineer|backend|programmer|expert|language|microservices|services|compiler)/i,
      /\bgolang\b/i,
      /\bgo\/rust\b/i,
      /\brust\/go\b/i,
    ],
  },
  {
    tech: 'rest',
    contextPatterns: [
      /\brest\s*(api|apis|ful|service|services|endpoint|endpoints|controller|controllers|architecture|interface|interfaces|http|client|server)/i,
      /\brestful\b/i,
      /\brest\/graphql\b/i,
      /\bgraphql\/rest\b/i,
    ],
  },
];

/**
 * Standard technologies that can be matched with simple word boundaries.
 */
const STANDARD_KEYWORDS: readonly string[] = TECH_KEYWORDS.filter(
  (tech) =>
    !SPECIAL_TECH_PATTERNS.some((p) => p.tech === tech) &&
    !CONTEXT_REQUIRED_RULES.some((r) => r.tech === tech),
);

/**
 * Build a regex pattern that matches a keyword with word boundaries.
 * Handles hyphenated and multi-word keywords.
 */
function buildWordBoundaryPattern(keyword: string): RegExp {
  const escaped = keyword.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const withSpaces = escaped.replace(/\\ /g, '\\s+');
  return new RegExp(`\\b${withSpaces}\\b`, 'gi');
}

/**
 * Extract technology names from text by keyword scanning.
 * Returns unique, lowercased, trimmed technology names.
 *
 * Uses word-boundary matching to prevent false positives from substrings.
 * Short ambiguous keywords (AI, ML, GO, REST) require surrounding context.
 */
export function extractTechnologiesFromText(text: string): string[] {
  if (!text) return [];

  const found = new Set<string>();

  // 1. Check special patterns first (C++, C#, Node.js, React Native, etc.)
  for (const { pattern, tech } of SPECIAL_TECH_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      found.add(tech);
    }
  }

  // 2. Check context-required technologies (AI, ML, GO, REST)
  for (const { tech, contextPatterns } of CONTEXT_REQUIRED_RULES) {
    for (const contextPattern of contextPatterns) {
      contextPattern.lastIndex = 0;
      if (contextPattern.test(text)) {
        found.add(tech);
        break;
      }
    }
  }

  // 3. Check standard keywords with word boundaries
  for (const keyword of STANDARD_KEYWORDS) {
    const pattern = buildWordBoundaryPattern(keyword);
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      found.add(keyword);
    }
  }

  return [...found];
}
