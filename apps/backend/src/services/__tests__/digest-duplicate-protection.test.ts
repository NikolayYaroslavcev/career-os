import { describe, it, expect, beforeEach } from 'vitest';
import { createUserId } from '@careeros/career';
import { NoopMetricsCollector, NoopLogger } from '@careeros/providers';
import type { TelegramClient } from '@careeros/telegram';
import { buildTestWorkflow, type TestWorkflow } from '../../testing/build-test-workflow.js';
import { buildFixtureResume, buildFixtureSearchProfile, buildFixtureTelegramConnection, FIXTURE_USER_ID } from '../../testing/fixtures.js';
import { InMemoryNotificationHistoryRepository } from '../../testing/in-memory-repositories.js';
import { DigestDeliveryService } from '../digest-delivery-service.js';
import { TelegramDigestFormatter } from '../telegram-digest-formatter.js';

const alwaysFailingTelegramClient: TelegramClient = {
  send: async () => ({ success: false, error: 'simulated delivery failure' }),
};

const CHAT_ID = 'chat-123';

describe('Duplicate notification protection', () => {
  describe('InMemoryNotificationHistoryRepository', () => {
    it('reports every referenceId as unnotified until recordNotified is called', async () => {
      const repository = new InMemoryNotificationHistoryRepository();
      const userId = createUserId('user-1');

      const before = await repository.filterUnnotified(userId, ['a', 'b'], 'telegram');
      expect(before).toEqual(['a', 'b']);

      await repository.recordNotified(userId, ['a'], 'telegram');

      const after = await repository.filterUnnotified(userId, ['a', 'b'], 'telegram');
      expect(after).toEqual(['b']);
    });

    it('scopes history per channel, so a different channel is unaffected', async () => {
      const repository = new InMemoryNotificationHistoryRepository();
      const userId = createUserId('user-1');
      await repository.recordNotified(userId, ['a'], 'telegram');

      const emailHistory = await repository.filterUnnotified(userId, ['a'], 'email');
      expect(emailHistory).toEqual(['a']);
    });

    it('scopes history per user, so another user is unaffected', async () => {
      const repository = new InMemoryNotificationHistoryRepository();
      await repository.recordNotified(createUserId('user-1'), ['a'], 'telegram');

      const otherUserHistory = await repository.filterUnnotified(createUserId('user-2'), ['a'], 'telegram');
      expect(otherUserHistory).toEqual(['a']);
    });
  });

  describe('end-to-end via DigestDeliveryService', () => {
    let workflow: TestWorkflow;

    beforeEach(() => {
      workflow = buildTestWorkflow({ jobsToReturn: 8 });
    });

    it('does not re-notify about the same recommendation on a second run', async () => {
      const resume = buildFixtureResume();
      await workflow.repositories.resume.save(resume);
      const profile = buildFixtureSearchProfile();
      await workflow.repositories.searchProfile.save(profile, {});
      await workflow.repositories.telegramConnection.save(buildFixtureTelegramConnection(CHAT_ID));

      const first = await workflow.services.digestScheduler.triggerNow({ userId: FIXTURE_USER_ID });
      const firstIds = first.digest.topRecommendations.map((item) => item.matchResultId);

      const second = await workflow.services.digestScheduler.triggerNow({ userId: FIXTURE_USER_ID });
      const secondIds = second.digest.topRecommendations.map((item) => item.matchResultId);

      expect(secondIds.some((id) => firstIds.includes(id))).toBe(false);
      expect(second.stats.newRecommendations).toBe(second.stats.eligibleRecommendations - first.stats.includedRecommendations);
    });

    it('does not record history when the Telegram send fails, so a retry can still reach the user', async () => {
      const resume = buildFixtureResume();
      await workflow.repositories.resume.save(resume);
      const profile = buildFixtureSearchProfile();
      await workflow.repositories.searchProfile.save(profile, {});
      await workflow.repositories.telegramConnection.save(buildFixtureTelegramConnection(CHAT_ID));

      const failingDelivery = new DigestDeliveryService(
        workflow.services.morningDigest,
        new TelegramDigestFormatter(),
        alwaysFailingTelegramClient,
        workflow.repositories.telegramConnection,
        workflow.repositories.notificationHistory,
        new NoopMetricsCollector(),
        new NoopLogger()
      );

      const failed = await failingDelivery.deliverNow({ userId: FIXTURE_USER_ID });
      expect(failed.send.success).toBe(false);

      const retried = await workflow.services.digestScheduler.triggerNow({ userId: FIXTURE_USER_ID });

      expect(retried.stats.includedRecommendations).toBe(5);
      expect(retried.digest.topRecommendations.map((item) => item.matchResultId)).toEqual(
        failed.digest.topRecommendations.map((item) => item.matchResultId)
      );
    });

    it('eventually exhausts eligible recommendations across repeated runs', async () => {
      const resume = buildFixtureResume();
      await workflow.repositories.resume.save(resume);
      const profile = buildFixtureSearchProfile();
      await workflow.repositories.searchProfile.save(profile, {});
      await workflow.repositories.telegramConnection.save(buildFixtureTelegramConnection(CHAT_ID));

      const first = await workflow.services.digestScheduler.triggerNow({ userId: FIXTURE_USER_ID });
      const second = await workflow.services.digestScheduler.triggerNow({ userId: FIXTURE_USER_ID });
      const third = await workflow.services.digestScheduler.triggerNow({ userId: FIXTURE_USER_ID });

      expect(first.stats.includedRecommendations).toBe(5);
      expect(second.stats.includedRecommendations).toBe(3);
      expect(third.stats.includedRecommendations).toBe(0);
    });
  });
});
