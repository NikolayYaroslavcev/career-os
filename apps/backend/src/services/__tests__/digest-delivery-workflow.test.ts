import { describe, it, expect, beforeEach } from 'vitest';
import { buildTestWorkflow, type TestWorkflow } from '../../testing/build-test-workflow.js';
import { buildFixtureResume, buildFixtureSearchProfile, buildFixtureTelegramConnection, FIXTURE_USER_ID } from '../../testing/fixtures.js';
import { NoActiveSearchProfileError } from '../intelligence-workflow-service.js';
import { TelegramNotLinkedError } from '../digest-delivery-service.js';

const CHAT_ID = 'chat-123';

describe('Morning Digest workflow (Scheduler -> Search Profile -> Provider Search -> AI Matching -> Ranking -> Digest Builder -> Telegram)', () => {
  let workflow: TestWorkflow;

  beforeEach(() => {
    workflow = buildTestWorkflow({ jobsToReturn: 8 });
  });

  it('runs the full pipeline end-to-end and delivers a formatted digest to the linked Telegram account', async () => {
    const resume = buildFixtureResume();
    await workflow.repositories.resume.save(resume);
    const profile = buildFixtureSearchProfile();
    await workflow.repositories.searchProfile.save(profile, {});
    await workflow.repositories.telegramConnection.save(buildFixtureTelegramConnection(CHAT_ID));

    const delivery = await workflow.services.digestScheduler.triggerNow({ userId: FIXTURE_USER_ID });

    expect(delivery.send.success).toBe(true);
    expect(delivery.digest.title).toBe('CareerOS Morning Digest');
    expect(delivery.digest.topRecommendations.length).toBeGreaterThan(0);
    expect(delivery.digest.topRecommendations.length).toBeLessThanOrEqual(5);

    const sent = workflow.telegramClient.getSentMessages();
    expect(sent).toHaveLength(1);
    expect(sent[0]?.chatId).toBe(CHAT_ID);
    expect(sent[0]?.text).toBe(delivery.message);
    expect(sent[0]?.text).toContain('CareerOS Morning Digest');
  });

  it('reuses IntelligenceWorkflowService end-to-end instead of duplicating search/matching logic', async () => {
    const resume = buildFixtureResume();
    await workflow.repositories.resume.save(resume);
    const profile = buildFixtureSearchProfile();
    await workflow.repositories.searchProfile.save(profile, {});
    await workflow.repositories.telegramConnection.save(buildFixtureTelegramConnection(CHAT_ID));

    // Mirrors MorningDigestService's own call: awaitAiMatching: true, since the
    // digest (unlike /intelligence/search) needs computed scores synchronously.
    const workflowResult = await workflow.services.intelligenceWorkflow.run({
      userId: FIXTURE_USER_ID,
      awaitAiMatching: true,
    });
    const delivery = await workflow.services.digestScheduler.triggerNow({ userId: FIXTURE_USER_ID });

    expect(delivery.stats.totalRecommendations).toBe(workflowResult.recommendations.length);
  });

  it('propagates NoActiveSearchProfileError from the reused workflow when there is no active profile', async () => {
    const resume = buildFixtureResume();
    await workflow.repositories.resume.save(resume);
    await workflow.repositories.telegramConnection.save(buildFixtureTelegramConnection(CHAT_ID));

    await expect(workflow.services.digestScheduler.triggerNow({ userId: FIXTURE_USER_ID })).rejects.toThrow(
      NoActiveSearchProfileError
    );
  });

  it('caps the digest at the default Top 5 even when more recommendations are eligible', async () => {
    const resume = buildFixtureResume();
    await workflow.repositories.resume.save(resume);
    const profile = buildFixtureSearchProfile();
    await workflow.repositories.searchProfile.save(profile, {});
    await workflow.repositories.telegramConnection.save(buildFixtureTelegramConnection(CHAT_ID));

    const delivery = await workflow.services.digestScheduler.triggerNow({ userId: FIXTURE_USER_ID });

    expect(delivery.stats.eligibleRecommendations).toBe(8);
    expect(delivery.stats.includedRecommendations).toBe(5);
  });

  it('throws TelegramNotLinkedError instead of generating a digest when the user has no Telegram connection', async () => {
    const resume = buildFixtureResume();
    await workflow.repositories.resume.save(resume);
    const profile = buildFixtureSearchProfile();
    await workflow.repositories.searchProfile.save(profile, {});

    await expect(workflow.services.digestScheduler.triggerNow({ userId: FIXTURE_USER_ID })).rejects.toThrow(
      TelegramNotLinkedError
    );
    expect(workflow.telegramClient.getSentMessages()).toHaveLength(0);
  });
});
