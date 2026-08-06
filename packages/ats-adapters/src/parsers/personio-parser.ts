import type { AtsRawJob } from '../interfaces/ats-raw-job.js';
import type { PersonioAdapterConfig } from '../interfaces/ats-config.js';
import { buildJobUrl } from '../transport/personio-transport.js';

/**
 * Pure parsing only — no HTTP, no I/O.
 *
 * No XML library is used here: this codebase has no XML dependency anywhere
 * (the one other XML-fed provider, We Work Remotely's RSS feed, parses via
 * plain regex — see `packages/providers/src/providers/weworkremotely/
 * weworkremotely-fetcher.ts`), so this follows the same established pattern
 * rather than introducing a new dependency for one feed. Personio's feed
 * schema is flat and stable (officially documented, not scraped), which is
 * exactly the shape regex extraction tolerates well.
 */
export interface PersonioDescriptionSection {
  readonly name: string;
  readonly value: string;
}

export interface PersonioPositionPayload {
  readonly id: string;
  readonly name: string;
  readonly office?: string;
  readonly additionalOffices: readonly string[];
  readonly subcompany?: string;
  readonly department?: string;
  readonly recruitingCategory?: string;
  readonly descriptions: readonly PersonioDescriptionSection[];
  readonly employmentType?: string;
  readonly seniority?: string;
  readonly schedule?: string;
  readonly yearsOfExperience?: string;
  readonly keywords?: string;
  readonly occupation?: string;
  readonly occupationCategory?: string;
  readonly createdAt?: string;
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, '&');
}

function extractTag(xml: string, tag: string): string | undefined {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  if (!match?.[1]) return undefined;
  const value = decodeXmlEntities(match[1]).trim();
  return value.length > 0 ? value : undefined;
}

function extractAllTags(xml: string, tag: string): string[] {
  const matches = xml.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g'));
  return Array.from(matches, (m) => decodeXmlEntities(m[1] ?? '').trim()).filter(Boolean);
}

function extractDescriptions(xml: string): PersonioDescriptionSection[] {
  const blockMatch = xml.match(/<jobDescriptions>([\s\S]*?)<\/jobDescriptions>/);
  if (!blockMatch?.[1]) return [];

  const sections: PersonioDescriptionSection[] = [];
  const sectionMatches = blockMatch[1].matchAll(/<jobDescription>([\s\S]*?)<\/jobDescription>/g);
  for (const section of sectionMatches) {
    const block = section[1] ?? '';
    const name = extractTag(block, 'name');
    const value = extractTag(block, 'value');
    if (name && value) sections.push({ name, value });
  }
  return sections;
}

/** Splits the `<workzag-jobs>` feed into individual `<position>` XML blocks. */
export function splitPositions(xml: string): string[] {
  return Array.from(xml.matchAll(/<position>([\s\S]*?)<\/position>/g), (m) => m[1] ?? '');
}

export function isValidPersonioPosition(block: string): boolean {
  return /<id>[\s\S]*?<\/id>/.test(block) && /<name>[\s\S]*?<\/name>/.test(block);
}

export function parsePosition(block: string): PersonioPositionPayload | null {
  const id = extractTag(block, 'id');
  const name = extractTag(block, 'name');
  if (!id || !name) return null;

  const additionalOfficesBlock = block.match(/<additionalOffices>([\s\S]*?)<\/additionalOffices>/);

  return {
    id,
    name,
    office: extractTag(block, 'office'),
    additionalOffices: additionalOfficesBlock ? extractAllTags(additionalOfficesBlock[1] ?? '', 'office') : [],
    subcompany: extractTag(block, 'subcompany'),
    department: extractTag(block, 'department'),
    recruitingCategory: extractTag(block, 'recruitingCategory'),
    descriptions: extractDescriptions(block),
    employmentType: extractTag(block, 'employmentType'),
    seniority: extractTag(block, 'seniority'),
    schedule: extractTag(block, 'schedule'),
    yearsOfExperience: extractTag(block, 'yearsOfExperience'),
    keywords: extractTag(block, 'keywords'),
    occupation: extractTag(block, 'occupation'),
    occupationCategory: extractTag(block, 'occupationCategory'),
    createdAt: extractTag(block, 'createdAt'),
  };
}

function joinDescription(descriptions: readonly PersonioDescriptionSection[]): string {
  return descriptions.map((s) => `<h3>${s.name}</h3>\n${s.value}`).join('\n');
}

function joinLocation(position: PersonioPositionPayload): string | undefined {
  const parts = [position.office, ...position.additionalOffices].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : undefined;
}

export function toAtsRawJob(config: PersonioAdapterConfig, position: PersonioPositionPayload): AtsRawJob {
  return {
    externalId: position.id,
    title: position.name,
    description: joinDescription(position.descriptions),
    url: buildJobUrl(config, position.id),
    location: joinLocation(position),
    publishedAt: position.createdAt ? new Date(position.createdAt) : undefined,
    departments: position.department ? [position.department] : undefined,
    rawMetadata: position,
  };
}

/** Parses every position in the feed, skipping malformed blocks (missing id/name) rather than throwing. */
export function parseFeed(config: PersonioAdapterConfig, xml: string): AtsRawJob[] {
  return splitPositions(xml)
    .filter(isValidPersonioPosition)
    .map(parsePosition)
    .filter((p): p is PersonioPositionPayload => p !== null)
    .map((position) => toAtsRawJob(config, position));
}
