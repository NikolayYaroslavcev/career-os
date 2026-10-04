import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '../../.env') });

import {
  prisma,
  PrismaVacancyRepository,
  PrismaVacancySourceRepository,
  PrismaSearchProfileRepository,
  PrismaCompanyRepository,
  PrismaProviderConfigRepository,
  PrismaUserVacancyInteractionRepository,
} from '@careeros/database';
import { createUserId } from '@careeros/career';
import { computePreferenceBoosts } from '../services/ranking/preference-boost.js';
import { VacancyRankingService } from '../services/ranking/vacancy-ranking-service.js';

const SEEKER_USER_ID = 'edcd0a52-ff6d-41b3-b0a2-81df147fbc60';
const SEEKER_WS = '2a63b6e3-a48e-4dcb-a930-16da0d25d956';

async function main(): Promise<void> {
  const vacancyRepo = new PrismaVacancyRepository();
  const vacancySourceRepo = new PrismaVacancySourceRepository();
  const searchProfileRepo = new PrismaSearchProfileRepository();
  const companyRepo = new PrismaCompanyRepository();
  const providerConfigRepo = new PrismaProviderConfigRepository();
  const interactionRepo = new PrismaUserVacancyInteractionRepository();

  const profiles = await searchProfileRepo.findByUserId(createUserId(SEEKER_USER_ID));
  const activeProfile = profiles.find((p) => p.isActive);
  console.log('Active search profile:', activeProfile ? JSON.stringify({
    id: activeProfile.id, isActive: activeProfile.isActive,
    keywords: (activeProfile as unknown as Record<string, unknown>).keywords,
    technologies: (activeProfile as unknown as Record<string, unknown>).technologies,
    remote: (activeProfile as unknown as Record<string, unknown>).remotePreference,
  }, null, 2) : 'NONE');
  if (!activeProfile) return;

  const { vacancies } = await vacancyRepo.findMany({ workspaceId: SEEKER_WS, limit: 200, offset: 0, sortBy: 'newest', sortOrder: 'desc' });
  console.log(`\nCandidate pool (newest 200): ${vacancies.length}`);

  const providerConfigs = await providerConfigRepo.findAll();
  const qualityScores = new Map<string, number>();
  for (const c of providerConfigs) if (c.qualityScore != null) qualityScores.set(c.providerId, c.qualityScore);

  const vacancyProviderTypes = new Map<string, string>();
  for (const v of vacancies) {
    const sources = await vacancySourceRepo.findByVacancyId(v.id);
    const [first] = sources;
    if (first) vacancyProviderTypes.set(v.id.toString(), first.providerId);
  }

  const vacancyLookup = async (id: Parameters<typeof vacancyRepo.findByIdForWorkspace>[0]) =>
    vacancyRepo.findByIdForWorkspace(id, SEEKER_WS);
  const preferenceBoosts = await computePreferenceBoosts(createUserId(SEEKER_USER_ID), interactionRepo, vacancyLookup);
  const interactions = await interactionRepo.findByUserId(createUserId(SEEKER_USER_ID));
  const interactionData = interactions.map((i) => ({ action: i.action, vacancyId: i.vacancyId as string }));

  const rankingService = new VacancyRankingService();
  const ranked = rankingService.rankVacancies(vacancies, activeProfile, qualityScores, vacancyProviderTypes, preferenceBoosts, interactionData);

  const excluded = new Set(interactions.filter((i) => i.action === 'HIDE' || i.action === 'APPLY').map((i) => i.vacancyId as string));
  const visible = ranked.filter(({ vacancy }) => !excluded.has(vacancy.id.toString()));

  console.log(`Visible after exclusions: ${visible.length}`);
  console.log('\n=== TOP 20 recommendations ===');
  const top20 = visible.slice(0, 20);
  for (const { vacancy, result } of top20) {
    const providerId = vacancyProviderTypes.get(vacancy.id.toString()) ?? 'unknown';
    const company = await companyRepo.findById(vacancy.companyId);
    console.log(`score=${result.score} tier=${result.tier} provider=${providerId} title="${vacancy.title}" company="${company?.name}" published=${vacancy.publishedAt?.toISOString()}`);
  }

  const providerCounts: Record<string, number> = {};
  for (const { vacancy } of visible) {
    const p = vacancyProviderTypes.get(vacancy.id.toString()) ?? 'unknown';
    providerCounts[p] = (providerCounts[p] ?? 0) + 1;
  }
  console.log('\nProvider distribution across all visible (ranked) vacancies:', providerCounts);

  const top20ProviderCounts: Record<string, number> = {};
  for (const { vacancy } of top20) {
    const p = vacancyProviderTypes.get(vacancy.id.toString()) ?? 'unknown';
    top20ProviderCounts[p] = (top20ProviderCounts[p] ?? 0) + 1;
  }
  console.log('Provider distribution in TOP 20:', top20ProviderCounts);

  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
