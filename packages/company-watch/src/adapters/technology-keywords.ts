const TECHNOLOGY_PATTERNS = [
  /typescript|javascript|python|java|golang|go|rust|ruby|php|c\+\+|c#|swift|kotlin/i,
  /react|vue|angular|svelte|next\.?js|nuxt/i,
  /node\.?js|deno|bun/i,
  /aws|gcp|azure|docker|kubernetes|k8s/i,
  /postgresql|mysql|mongodb|redis|elasticsearch/i,
];

/** Shared keyword-regex technology extraction, used by every adapter that has no structured metadata field to key off of. */
export function extractTechnologies(description: string): string[] {
  const technologies: string[] = [];
  for (const pattern of TECHNOLOGY_PATTERNS) {
    const matches = description.match(pattern);
    if (matches) {
      technologies.push(...matches.map((m) => m.toLowerCase()));
    }
  }
  return [...new Set(technologies)];
}
