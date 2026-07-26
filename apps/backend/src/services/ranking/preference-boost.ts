import type { UserId, VacancyId, UserVacancyInteractionRepository } from '@careeros/career';
import type { Vacancy, SearchProfile } from '@careeros/career';
import { normalizeTechnology } from './technology-normalization.js';

export interface PreferenceBoosts {
  readonly technologyBoosts: Map<string, number>;
  readonly roleBoosts: Map<string, number>;
  readonly remoteBoost: number;
  readonly locationBoosts: Map<string, number>;
  readonly hiddenVacancyIds: Set<string>;
  readonly ignoredRoles: Set<string>;
}

export interface PersonalizationInput {
  readonly userId: UserId;
  readonly vacancy: Vacancy;
  readonly searchProfile: SearchProfile;
  readonly interactionRepository: UserVacancyInteractionRepository;
  readonly lookbackDays?: number;
}

const TECHNOLOGY_VIEW_WEIGHT = 2;
const TECHNOLOGY_SAVE_WEIGHT = 10;
const TECHNOLOGY_APPLY_WEIGHT = 15;
const TECHNOLOGY_HIDE_WEIGHT = -15;
const TECHNOLOGY_IGNORE_WEIGHT = -5;

const ROLE_SAVE_WEIGHT = 5;
const ROLE_APPLY_WEIGHT = 8;
const ROLE_HIDE_WEIGHT = -10;
const ROLE_IGNORE_WEIGHT = -5;

const REMOTE_VIEW_WEIGHT = 1;
const REMOTE_SAVE_WEIGHT = 3;
const REMOTE_APPLY_WEIGHT = 5;

const LOCATION_VIEW_WEIGHT = 1;
const LOCATION_SAVE_WEIGHT = 3;
const LOCATION_APPLY_WEIGHT = 5;

const HIDE_PENALTY = -20;
const IGNORE_ROLE_PENALTY = -10;

export function getPreferenceDecayFactor(interactionDate: Date, now?: Date): number {
  const reference = now ?? new Date();
  const daysSince = (reference.getTime() - interactionDate.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSince <= 7) return 1.0;
  if (daysSince <= 30) return 0.7;
  if (daysSince <= 90) return 0.4;
  return 0.2;
}

function normalizeString(value: string): string {
  return value.toLowerCase().trim();
}

function classifyRoleCategory(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes('frontend') || lower.includes('front-end') || lower.includes('react') || lower.includes('vue') || lower.includes('angular') || lower.includes('web developer') || lower.includes('ui developer')) {
    return 'frontend';
  }
  if (lower.includes('backend') || lower.includes('back-end') || lower.includes('node') || lower.includes('python') || lower.includes('java developer') || lower.includes('golang') || lower.includes('rust')) {
    return 'backend';
  }
  if (lower.includes('fullstack') || lower.includes('full-stack') || lower.includes('full stack')) {
    return 'fullstack';
  }
  if (lower.includes('mobile') || lower.includes('ios') || lower.includes('android') || lower.includes('flutter') || lower.includes('react native')) {
    return 'mobile';
  }
  if (lower.includes('devops') || lower.includes('sre') || lower.includes('platform')) {
    return 'devops';
  }
  if (lower.includes('data') || lower.includes('ml') || lower.includes('machine learning') || lower.includes('ai')) {
    return 'data';
  }
  if (lower.includes('qa') || lower.includes('test')) {
    return 'qa';
  }
  if (lower.includes('design') || lower.includes('ux') || lower.includes('ui designer')) {
    return 'design';
  }
  if (lower.includes('product') || lower.includes('pm')) {
    return 'product';
  }
  return 'other';
}

function addWeightedBoost(
  boosts: Map<string, number>,
  key: string,
  weight: number,
): void {
  const current = boosts.get(key) ?? 0;
  boosts.set(key, current + weight);
}

type VacancyLookup = (id: VacancyId) => Promise<Vacancy | null>;

export async function computePreferenceBoosts(
  userId: UserId,
  interactionRepository: UserVacancyInteractionRepository,
  vacancyLookup?: VacancyLookup,
  lookbackDays: number = 90,
): Promise<PreferenceBoosts> {
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

  const views = await interactionRepository.findByUserId(userId, { action: 'VIEW', since, limit: 500 });
  const saves = await interactionRepository.findByUserId(userId, { action: 'SAVE', since, limit: 200 });
  const applies = await interactionRepository.findByUserId(userId, { action: 'APPLY', since, limit: 100 });
  const hides = await interactionRepository.findByUserId(userId, { action: 'HIDE', since, limit: 200 });
  const ignores = await interactionRepository.findByUserId(userId, { action: 'IGNORE', since, limit: 200 });

  const technologyBoosts = new Map<string, number>();
  const roleBoosts = new Map<string, number>();
  const locationBoosts = new Map<string, number>();
  let remoteBoost = 0;
  const hiddenVacancyIds = new Set<string>();
  const ignoredRoles = new Set<string>();

  const now = new Date();

  if (vacancyLookup) {
    for (const interaction of views) {
      const vacancy = await vacancyLookup(interaction.vacancyId);
      if (!vacancy) continue;

      const decay = getPreferenceDecayFactor(interaction.createdAt, now);

      for (const tech of vacancy.technologies) {
        const normalized = normalizeTechnology(tech.name);
        addWeightedBoost(technologyBoosts, normalized, Math.round(TECHNOLOGY_VIEW_WEIGHT * decay));
      }

      const roleCategory = classifyRoleCategory(vacancy.title);
      addWeightedBoost(roleBoosts, roleCategory, Math.round(REMOTE_VIEW_WEIGHT * decay));

      if (vacancy.location.workMode === 'remote') {
        remoteBoost += Math.round(REMOTE_VIEW_WEIGHT * decay);
      }
      if (vacancy.location.city) {
        addWeightedBoost(locationBoosts, normalizeString(vacancy.location.city), Math.round(LOCATION_VIEW_WEIGHT * decay));
      }
    }

    for (const interaction of saves) {
      const vacancy = await vacancyLookup(interaction.vacancyId);
      if (!vacancy) continue;

      const decay = getPreferenceDecayFactor(interaction.createdAt, now);

      for (const tech of vacancy.technologies) {
        const normalized = normalizeTechnology(tech.name);
        addWeightedBoost(technologyBoosts, normalized, Math.round(TECHNOLOGY_SAVE_WEIGHT * decay));
      }

      const roleCategory = classifyRoleCategory(vacancy.title);
      addWeightedBoost(roleBoosts, roleCategory, Math.round(ROLE_SAVE_WEIGHT * decay));

      if (vacancy.location.workMode === 'remote') {
        remoteBoost += Math.round(REMOTE_SAVE_WEIGHT * decay);
      }
      if (vacancy.location.city) {
        addWeightedBoost(locationBoosts, normalizeString(vacancy.location.city), Math.round(LOCATION_SAVE_WEIGHT * decay));
      }
    }

    for (const interaction of applies) {
      const vacancy = await vacancyLookup(interaction.vacancyId);
      if (!vacancy) continue;

      const decay = getPreferenceDecayFactor(interaction.createdAt, now);

      for (const tech of vacancy.technologies) {
        const normalized = normalizeTechnology(tech.name);
        addWeightedBoost(technologyBoosts, normalized, Math.round(TECHNOLOGY_APPLY_WEIGHT * decay));
      }

      const roleCategory = classifyRoleCategory(vacancy.title);
      addWeightedBoost(roleBoosts, roleCategory, Math.round(ROLE_APPLY_WEIGHT * decay));

      if (vacancy.location.workMode === 'remote') {
        remoteBoost += Math.round(REMOTE_APPLY_WEIGHT * decay);
      }
      if (vacancy.location.city) {
        addWeightedBoost(locationBoosts, normalizeString(vacancy.location.city), Math.round(LOCATION_APPLY_WEIGHT * decay));
      }
    }

    for (const interaction of hides) {
      const vacancy = await vacancyLookup(interaction.vacancyId);
      if (!vacancy) continue;

      const decay = getPreferenceDecayFactor(interaction.createdAt, now);

      hiddenVacancyIds.add(interaction.vacancyId as string);

      for (const tech of vacancy.technologies) {
        const normalized = normalizeTechnology(tech.name);
        addWeightedBoost(technologyBoosts, normalized, Math.round(TECHNOLOGY_HIDE_WEIGHT * decay));
      }

      const roleCategory = classifyRoleCategory(vacancy.title);
      addWeightedBoost(roleBoosts, roleCategory, Math.round(ROLE_HIDE_WEIGHT * decay));
    }

    for (const interaction of ignores) {
      const vacancy = await vacancyLookup(interaction.vacancyId);
      if (!vacancy) continue;

      const decay = getPreferenceDecayFactor(interaction.createdAt, now);

      ignoredRoles.add(interaction.vacancyId as string);

      for (const tech of vacancy.technologies) {
        const normalized = normalizeTechnology(tech.name);
        addWeightedBoost(technologyBoosts, normalized, Math.round(TECHNOLOGY_IGNORE_WEIGHT * decay));
      }

      const roleCategory = classifyRoleCategory(vacancy.title);
      addWeightedBoost(roleBoosts, roleCategory, Math.round(ROLE_IGNORE_WEIGHT * decay));
    }
  } else {
    for (const interaction of hides) {
      hiddenVacancyIds.add(interaction.vacancyId as string);
    }
    for (const interaction of ignores) {
      ignoredRoles.add(interaction.vacancyId as string);
    }
  }

  return {
    technologyBoosts,
    roleBoosts,
    remoteBoost,
    locationBoosts,
    hiddenVacancyIds,
    ignoredRoles,
  };
}

export function calculatePersonalizationBoost(
  input: PersonalizationInput,
  boosts: PreferenceBoosts,
): { boost: number; reasons: string[] } {
  const { vacancy } = input;
  const reasons: string[] = [];
  let boost = 0;

  if (boosts.hiddenVacancyIds.has(vacancy.id as string)) {
    return { boost: HIDE_PENALTY, reasons: ['Previously hidden by user'] };
  }

  if (boosts.ignoredRoles.has(vacancy.id as string)) {
    return { boost: IGNORE_ROLE_PENALTY, reasons: ['Previously ignored by user'] };
  }

  const vacancyTechs = vacancy.technologies.map((t) => normalizeTechnology(t.name));
  for (const tech of vacancyTechs) {
    const techBoost = boosts.technologyBoosts.get(tech) ?? 0;
    if (techBoost > 0) {
      boost += Math.min(techBoost, 10);
      reasons.push(`Technology "${tech}" frequently interacted with`);
    } else if (techBoost < 0) {
      boost += Math.max(techBoost, -10);
      reasons.push(`Technology "${tech}" hidden by user`);
    }
  }

  const vacancyRole = classifyRoleCategory(vacancy.title);
  const roleBoost = boosts.roleBoosts.get(vacancyRole) ?? 0;
  if (roleBoost > 0) {
    boost += Math.min(roleBoost, 5);
    reasons.push(`Role "${vacancyRole}" preferred based on history`);
  } else if (roleBoost < 0) {
    boost += Math.max(roleBoost, -5);
    reasons.push(`Role "${vacancyRole}" hidden by user`);
  }

  if (boosts.remoteBoost > 0 && vacancy.location.workMode === 'remote') {
    boost += Math.min(boosts.remoteBoost, 5);
    reasons.push('Remote preference based on interaction history');
  }

  if (vacancy.location.city) {
    const cityBoost = boosts.locationBoosts.get(normalizeString(vacancy.location.city)) ?? 0;
    if (cityBoost > 0) {
      boost += Math.min(cityBoost, 5);
      reasons.push(`Location "${vacancy.location.city}" frequently interacted with`);
    }
  }

  return { boost: Math.max(-20, Math.min(boost, 20)), reasons };
}
