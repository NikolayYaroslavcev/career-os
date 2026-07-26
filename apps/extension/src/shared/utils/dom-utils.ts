export function queryText(document: Document, selector: string): string | null {
  const el = document.querySelector(selector);
  return el?.textContent?.trim() ?? null;
}

export function queryAllText(document: Document, selector: string): string[] {
  return Array.from(document.querySelectorAll(selector))
    .map(el => el.textContent?.trim() ?? '')
    .filter(Boolean);
}

export function queryAttribute(document: Document, selector: string, attr: string): string | null {
  const el = document.querySelector(selector);
  return el?.getAttribute(attr)?.trim() ?? null;
}

export function extractJsonLd(document: Document): Record<string, unknown>[] {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  const results: Record<string, unknown>[] = [];
  
  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent ?? '');
      if (Array.isArray(data)) {
        results.push(...data);
      } else if (typeof data === 'object' && data !== null) {
        results.push(data);
      }
    } catch {
      continue;
    }
  }
  
  return results;
}

export function findJobPostingJsonLd(document: Document): Record<string, unknown> | null {
  const jsonLdItems = extractJsonLd(document);
  return jsonLdItems.find(item => item['@type'] === 'JobPosting') as Record<string, unknown> ?? null;
}

export function extractRequirementsFromText(text: string): string[] {
  const lines = text.split('\n');
  const requirements: string[] = [];
  let inRequirements = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    if (/^(requirements|qualifications|must have|required|what you.?ll need)/i.test(trimmed)) {
      inRequirements = true;
      continue;
    }
    
    if (inRequirements && /^(about|benefits|what we offer|nice to have| responsibilities)/i.test(trimmed)) {
      inRequirements = false;
      continue;
    }
    
    if (inRequirements && (trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.startsWith('•') || /^\d+\./.test(trimmed))) {
      requirements.push(trimmed.replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, ''));
    }
  }
  
  return requirements;
}

export function extractTechnologiesFromText(text: string): string[] {
  const techKeywords = [
    'javascript', 'typescript', 'python', 'java', 'go', 'golang', 'rust', 'c\\+\\+',
    'react', 'vue', 'angular', 'svelte', 'next\\.?js', 'nuxt', 'node\\.?js', 'express',
    'django', 'flask', 'fastapi', 'spring', 'rails', 'laravel',
    'aws', 'gcp', 'azure', 'docker', 'kubernetes', 'terraform',
    'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch',
    'graphql', 'rest', 'grpc',
    'html', 'css', 'sass', 'tailwind',
    'git', 'ci/cd', 'jenkins', 'github actions',
  ];
  
  const technologies: string[] = [];
  const lowerText = text.toLowerCase();
  
  for (const keyword of techKeywords) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(lowerText)) {
      technologies.push(keyword.replace(/\\\+/g, '+').replace(/\\\./g, '.'));
    }
  }
  
  return [...new Set(technologies)];
}
