import type { AtsRawJob } from '../interfaces/ats-raw-job.js';
import type {
  TeamtailorIncludedResourcePayload,
  TeamtailorJobResourcePayload,
  TeamtailorJobsListPayload,
  TeamtailorRelationshipRefPayload,
} from '../transport/teamtailor-transport.js';

/**
 * Pure parsing only — no HTTP, no I/O. Mirrors providers' original
 * `TeamtailorFetcher.parseResponse`/`isValidJob` byte-for-byte for the
 * fields both consumers already agreed on (`body`/`pitch`, `created-at`,
 * `careersite-job-url`). Adds real JSON:API `included` relationship
 * resolution for `department`/`role` — company-watch's prior implementation
 * attempted this already (correctly, as a JSON:API pattern) but over the
 * wrong auth/header/URL, so it was never actually exercised against a real
 * board. See ADR-033 addendum "Teamtailor migration".
 *
 * `location` is left `undefined` when absent rather than defaulting to `''`
 * (providers' own convention) — that default lives in the provider wrapper.
 */

/** Matches providers' original `isValidJob` shape check exactly. */
export function isValidTeamtailorJob(item: unknown): item is TeamtailorJobResourcePayload {
  return (
    typeof item === 'object' &&
    item !== null &&
    'id' in item &&
    'attributes' in item &&
    typeof (item as TeamtailorJobResourcePayload).attributes === 'object'
  );
}

function resolveRelationshipName(
  ref: TeamtailorRelationshipRefPayload | undefined,
  included: readonly TeamtailorIncludedResourcePayload[] | undefined,
): string | undefined {
  const id = ref?.data?.id;
  if (!id || !included) return undefined;
  return included.find((resource) => resource.id === id)?.attributes.name;
}

export function parseJob(
  item: TeamtailorJobResourcePayload,
  included?: readonly TeamtailorIncludedResourcePayload[],
): AtsRawJob {
  const attributes = item.attributes;
  const department = resolveRelationshipName(item.relationships?.department, included);
  const role = resolveRelationshipName(item.relationships?.role, included);
  const departments = [department, role].filter((v): v is string => Boolean(v));

  return {
    externalId: item.id,
    title: attributes.title,
    description: attributes.body ?? attributes.pitch ?? '',
    url: item.links?.['careersite-job-url'] ?? '',
    location: attributes.locationName || undefined,
    publishedAt: new Date(attributes['created-at']),
    departments: departments.length > 0 ? departments : undefined,
    rawMetadata: item,
  };
}

/** Matches providers' original `parseResponse` — throws on an invalid payload shape, filters per-item via `isValidTeamtailorJob`. */
export function parseJobsResponse(payload: TeamtailorJobsListPayload): AtsRawJob[] {
  if (!payload || !Array.isArray(payload.data)) {
    throw new Error('Response is not a valid Teamtailor jobs payload');
  }
  return payload.data.filter(isValidTeamtailorJob).map((item) => parseJob(item, payload.included));
}
