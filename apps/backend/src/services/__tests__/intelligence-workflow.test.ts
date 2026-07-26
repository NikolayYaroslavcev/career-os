import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Resume, createResumeId, SearchProfile, createSearchProfileId, createUserId, Technology, ExperienceLevel } from '@careeros/career';
import { buildTestWorkflow, type TestWorkflow } from '../../testing/build-test-workflow.js';
import { buildFixtureResume, buildFixtureSearchProfile, FIXTURE_USER_ID } from '../../testing/fixtures.js';
import { NoActiveSearchProfileError, NoResumeFoundError } from '../intelligence-workflow-service.js';

const OTHER_USER_ID = createUserId('99999999-9999-4999-8999-999999999999');

function buildForeignSearchProfile(): SearchProfile {
  return SearchProfile.create({
    id: createSearchProfileId('88888888-8888-4888-8888-888888888888'),
    userId: OTHER_USER_ID,
    name: "Someone Else's Search",
    desiredPositions: ['Staff Engineer'],
    desiredTechnologies: [Technology.create('rust', 'language')],
    experienceLevel: ExperienceLevel.SENIOR,
    isRemoteOnly: false,
  });
}

describe('IntelligenceWorkflowService (Search Profile -> Provider -> AI Matching -> Recommendations)', () => {
  let workflow: TestWorkflow;

  beforeEach(() => {
    workflow = buildTestWorkflow({ jobsToReturn: 4 });
  });

  describe('default (async) mode — the /intelligence/search HTTP path', () => {
    it('returns immediately without calling AI: all persisted vacancies come back, none matched yet, and the rest are enqueued', async () => {
      const resume = buildFixtureResume();
      await workflow.repositories.resume.save(resume);
      const profile = buildFixtureSearchProfile();
      await workflow.repositories.searchProfile.save(profile, {});

      const matchAllSpy = vi.spyOn(workflow.services.aiMatching, 'matchAll');

      const result = await workflow.services.intelligenceWorkflow.run({ userId: FIXTURE_USER_ID });

      expect(matchAllSpy).not.toHaveBeenCalled();
      expect(result.vacancies).toHaveLength(4);
      expect(result.recommendations).toHaveLength(0);
      expect(result.pendingVacancyIds).toHaveLength(4);
      expect(result.skippedVacancyIds).toHaveLength(0);
      expect(result.aiEnabled).toBe(true);

      // No MatchResult exists yet — nothing was computed synchronously.
      const persistedMatches = await workflow.repositories.matchResult.findByUserId(FIXTURE_USER_ID);
      expect(persistedMatches).toHaveLength(0);

      expect(workflow.vacancyAnalysisQueue.enqueued).toHaveLength(4);
      expect(workflow.vacancyAnalysisQueue.enqueued.every((job) => job.searchProfileId === profile.id)).toBe(true);
    });

    it('returns already-cached MatchResults immediately as matched, without re-enqueueing them', async () => {
      const resume = buildFixtureResume();
      await workflow.repositories.resume.save(resume);
      const profile = buildFixtureSearchProfile();
      await workflow.repositories.searchProfile.save(profile, {});

      // First run (sync, as MorningDigestService would) computes and persists MatchResults.
      await workflow.services.intelligenceWorkflow.run({ userId: FIXTURE_USER_ID, awaitAiMatching: true });
      workflow.vacancyAnalysisQueue.enqueued.length = 0;

      const second = await workflow.services.intelligenceWorkflow.run({ userId: FIXTURE_USER_ID });

      expect(second.recommendations).toHaveLength(4);
      expect(second.pendingVacancyIds).toHaveLength(0);
      expect(workflow.vacancyAnalysisQueue.enqueued).toHaveLength(0);
    });

    it('caps AI-worthy candidates via the relevance pre-filter when the provider returns many more vacancies than the AI budget (RemoteOK-scale volume)', async () => {
      workflow = buildTestWorkflow({ jobsToReturn: 91 });

      const resume = buildFixtureResume();
      await workflow.repositories.resume.save(resume);
      const profile = buildFixtureSearchProfile();
      await workflow.repositories.searchProfile.save(profile, {});

      const result = await workflow.services.intelligenceWorkflow.run({ userId: FIXTURE_USER_ID });

      expect(result.vacancies).toHaveLength(91);
      expect(result.pendingVacancyIds).toHaveLength(15);
      expect(result.skippedVacancyIds).toHaveLength(76);
      expect(workflow.vacancyAnalysisQueue.enqueued).toHaveLength(15);
    });

    it('pushes candidates ranked beyond the first batch onto the continuation backlog (EPIC-17 Part 6) instead of discarding them', async () => {
      workflow = buildTestWorkflow({ jobsToReturn: 91 });

      const resume = buildFixtureResume();
      await workflow.repositories.resume.save(resume);
      const profile = buildFixtureSearchProfile();
      await workflow.repositories.searchProfile.save(profile, {});

      await workflow.services.intelligenceWorkflow.run({ userId: FIXTURE_USER_ID });

      // All 91 fixture vacancies score >= the default minScore of 0, so every
      // one of the 76 that didn't make the first Top-15 batch is a genuine
      // "ranked below the cut" candidate (outside_top_n), not a dead-end
      // (low_relevance) — all 76 belong in the backlog for later batches.
      expect(await workflow.aiBatchBacklog.remaining(profile.id)).toBe(76);
    });

    it('records a search run trace (EPIC-17 Part 4) with per-stage counts and a per-vacancy exclusion reason for every non-included vacancy', async () => {
      workflow = buildTestWorkflow({ jobsToReturn: 91 });

      const resume = buildFixtureResume();
      await workflow.repositories.resume.save(resume);
      const profile = buildFixtureSearchProfile();
      await workflow.repositories.searchProfile.save(profile, {});

      await workflow.services.intelligenceWorkflow.run({ userId: FIXTURE_USER_ID });

      const traces = workflow.searchRunTraces.getAll();
      expect(traces).toHaveLength(1);
      const [trace] = traces;
      if (!trace) throw new Error('expected a search run trace');

      expect(trace.searchProfileId).toBe(profile.id);
      expect(trace.awaitedAiMatching).toBe(false);

      const stageNames = trace.stages.map((s) => s.name);
      expect(stageNames).toEqual([
        'Provider Fetch',
        'Normalization',
        'Deduplication',
        'Rule Filtering',
        'AI Selection',
        'Keyword Ranking',
        'Queue',
      ]);

      const queueStage = trace.stages.find((s) => s.name === 'Queue');
      if (!queueStage) throw new Error('expected a Queue stage');
      expect(queueStage.output).toBe(15);
      expect(queueStage.success).toBe(true);

      // 76 outside_top_n exclusions accounts for every vacancy not enqueued.
      expect(trace.exclusions.filter((e) => e.reason === 'outside_top_n')).toHaveLength(76);
      expect(trace.exclusions.filter((e) => e.reason === 'duplicate')).toHaveLength(0);
    });

    it('skips AI and the queue entirely when AI_ENABLED is false, still returning all persisted vacancies', async () => {
      workflow = buildTestWorkflow({ jobsToReturn: 4 }, { aiEnabled: false });

      const resume = buildFixtureResume();
      await workflow.repositories.resume.save(resume);
      const profile = buildFixtureSearchProfile();
      await workflow.repositories.searchProfile.save(profile, {});

      const result = await workflow.services.intelligenceWorkflow.run({ userId: FIXTURE_USER_ID });

      expect(result.aiEnabled).toBe(false);
      expect(result.vacancies).toHaveLength(4);
      expect(result.pendingVacancyIds).toHaveLength(0);
      expect(result.skippedVacancyIds).toHaveLength(4);
      expect(workflow.vacancyAnalysisQueue.enqueued).toHaveLength(0);
    });

    it('getMatchStatus reports vacancies as matched once the worker has processed them, without calling AI itself', async () => {
      const resume = buildFixtureResume();
      await workflow.repositories.resume.save(resume);
      const profile = buildFixtureSearchProfile();
      await workflow.repositories.searchProfile.save(profile, {});

      const searchResult = await workflow.services.intelligenceWorkflow.run({ userId: FIXTURE_USER_ID });
      const vacancyIds = searchResult.vacancies.map((v) => v.id);

      const beforeWorker = await workflow.services.intelligenceWorkflow.getMatchStatus({
        userId: FIXTURE_USER_ID,
        searchProfileId: profile.id,
        vacancyIds,
      });
      expect(beforeWorker.recommendations).toHaveLength(0);
      expect(beforeWorker.pendingVacancyIds).toHaveLength(4);

      const matchAllSpy = vi.spyOn(workflow.services.aiMatching, 'matchAll');
      await workflow.services.intelligenceWorkflow.run({ userId: FIXTURE_USER_ID, awaitAiMatching: true });
      expect(matchAllSpy).toHaveBeenCalledTimes(1);

      const afterWorker = await workflow.services.intelligenceWorkflow.getMatchStatus({
        userId: FIXTURE_USER_ID,
        searchProfileId: profile.id,
        vacancyIds,
      });
      expect(afterWorker.recommendations).toHaveLength(4);
      expect(afterWorker.pendingVacancyIds).toHaveLength(0);
    });
  });

  describe('awaitAiMatching: true — MorningDigestService / demo scripts', () => {
    it('runs the full pipeline end-to-end and returns sorted recommendations', async () => {
      const resume = buildFixtureResume();
      await workflow.repositories.resume.save(resume);

      const profile = buildFixtureSearchProfile();
      await workflow.repositories.searchProfile.save(profile, {});

      const result = await workflow.services.intelligenceWorkflow.run({
        userId: FIXTURE_USER_ID,
        awaitAiMatching: true,
      });

      expect(result.recommendations).toHaveLength(4);
      expect(result.stats.providerSearch.persisted).toBe(4);
      expect(result.stats.aiMatching.evaluated).toBe(4);
      expect(result.stats.recommendationCount).toBe(4);

      for (let i = 1; i < result.recommendations.length; i++) {
        const prev = result.recommendations[i - 1];
        const curr = result.recommendations[i];
        if (!prev || !curr) throw new Error('expected a recommendation');
        expect(prev.score).toBeGreaterThanOrEqual(curr.score);
      }

      // MatchResults must be persisted for future analytics.
      const persistedMatches = await workflow.repositories.matchResult.findByUserId(FIXTURE_USER_ID);
      expect(persistedMatches).toHaveLength(4);
    });

    it('forwards resume.rawText (not resume.summary) to the AI matching relevance pre-filter, so PDF uploads with an empty summary are still scored', async () => {
      const pdfResume = Resume.create({
        id: createResumeId('55555555-5555-4555-8555-555555555555'),
        userId: FIXTURE_USER_ID,
        title: 'Uploaded PDF Resume',
        rawText: 'PDF_UPLOAD_RAW_TEXT: extracted directly from the uploaded PDF, no summary was generated.',
      });
      pdfResume.setAsDefault();
      await workflow.repositories.resume.save(pdfResume);

      const profile = buildFixtureSearchProfile();
      await workflow.repositories.searchProfile.save(profile, {});

      const matchAllSpy = vi.spyOn(workflow.services.aiMatching, 'matchAll');

      await workflow.services.intelligenceWorkflow.run({ userId: FIXTURE_USER_ID, awaitAiMatching: true });

      expect(pdfResume.summary).toBe('');
      expect(matchAllSpy).toHaveBeenCalledTimes(1);
      const [params] = matchAllSpy.mock.calls[0] ?? [];
      expect(params?.resumeText).toBe(pdfResume.rawText);
    });

    it('reuses persisted MatchResults on a second run instead of recomputing (avoids duplicate AI requests)', async () => {
      const resume = buildFixtureResume();
      await workflow.repositories.resume.save(resume);
      const profile = buildFixtureSearchProfile();
      await workflow.repositories.searchProfile.save(profile, {});

      await workflow.services.intelligenceWorkflow.run({ userId: FIXTURE_USER_ID, awaitAiMatching: true });
      const second = await workflow.services.intelligenceWorkflow.run({ userId: FIXTURE_USER_ID, awaitAiMatching: true });

      expect(second.stats.aiMatching.computed).toBe(0);
      expect(second.stats.aiMatching.reused).toBe(4);
    });

    it('creates an Application from the top recommendation, preserving the AI match reference', async () => {
      const resume = buildFixtureResume();
      await workflow.repositories.resume.save(resume);
      const profile = buildFixtureSearchProfile();
      await workflow.repositories.searchProfile.save(profile, {});

      const result = await workflow.services.intelligenceWorkflow.run({
        userId: FIXTURE_USER_ID,
        awaitAiMatching: true,
      });
      const [top] = result.recommendations;
      if (!top) throw new Error('expected a recommendation');

      const application = await workflow.services.applicationCreation.createFromRecommendation({
        userId: FIXTURE_USER_ID,
        recommendation: top,
        resumeId: resume.id,
      });

      expect(application.vacancyId).toBe(top.vacancy.id);
      expect(application.matchResultId).toBe(top.matchResultId);
      expect(application.status).toBe('saved');

      const stored = await workflow.repositories.application.findById(application.id);
      expect(stored?.matchResultId).toBe(top.matchResultId);
    });
  });

  it('throws NoActiveSearchProfileError when the user has no active search profile', async () => {
    const resume = buildFixtureResume();
    await workflow.repositories.resume.save(resume);

    await expect(workflow.services.intelligenceWorkflow.run({ userId: FIXTURE_USER_ID })).rejects.toThrow(
      NoActiveSearchProfileError
    );
  });

  it('throws NoActiveSearchProfileError once the active profile has been disabled', async () => {
    const resume = buildFixtureResume();
    await workflow.repositories.resume.save(resume);
    const profile = buildFixtureSearchProfile();
    await workflow.repositories.searchProfile.save(profile, {});

    await workflow.services.searchProfile.disable(profile.id, FIXTURE_USER_ID);

    await expect(workflow.services.intelligenceWorkflow.run({ userId: FIXTURE_USER_ID })).rejects.toThrow(
      NoActiveSearchProfileError
    );
  });

  it('throws NoResumeFoundError when the user has no resume', async () => {
    const profile = buildFixtureSearchProfile();
    await workflow.repositories.searchProfile.save(profile, {});

    await expect(workflow.services.intelligenceWorkflow.run({ userId: FIXTURE_USER_ID })).rejects.toThrow(
      NoResumeFoundError
    );
  });

  it('rejects a searchProfileId that belongs to a different user, instead of running the search against their profile', async () => {
    const resume = buildFixtureResume();
    await workflow.repositories.resume.save(resume);
    const foreignProfile = buildForeignSearchProfile();
    await workflow.repositories.searchProfile.save(foreignProfile, {});

    // FIXTURE_USER_ID passes OTHER_USER_ID's searchProfileId explicitly (e.g. a
    // guessed/leaked ID) — getOwnedById must return null (not the foreign
    // profile), surfacing the same "no profile" error as if it didn't exist,
    // never the foreign profile's data.
    await expect(
      workflow.services.intelligenceWorkflow.run({ userId: FIXTURE_USER_ID, searchProfileId: foreignProfile.id })
    ).rejects.toThrow(NoActiveSearchProfileError);
  });
});
