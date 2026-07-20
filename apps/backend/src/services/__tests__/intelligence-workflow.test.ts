import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Resume, createResumeId } from '@careeros/career';
import { buildTestWorkflow, type TestWorkflow } from '../../testing/build-test-workflow.js';
import { buildFixtureResume, buildFixtureSearchProfile, FIXTURE_USER_ID } from '../../testing/fixtures.js';
import { NoActiveSearchProfileError, NoResumeFoundError } from '../intelligence-workflow-service.js';

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
        expect(result.recommendations[i - 1]!.score).toBeGreaterThanOrEqual(result.recommendations[i]!.score);
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
      const params = matchAllSpy.mock.calls[0]![0];
      expect(params.resumeText).toBe(pdfResume.rawText);
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
      const top = result.recommendations[0]!;

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

    await workflow.services.searchProfile.disable(profile.id);

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
});
