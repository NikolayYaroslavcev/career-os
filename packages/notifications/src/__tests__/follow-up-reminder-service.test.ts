import { describe, it, expect, beforeEach } from 'vitest';
import {
  Application,
  FollowUp,
  FollowUpStatus,
  TelegramConnection,
  createFollowUpId,
  createApplicationId,
  createUserId,
  createVacancyId,
  createTelegramConnectionId,
  type ApplicationRepository,
  type FollowUpRepository,
} from '@careeros/career';
import { InMemoryTelegramClient } from '@careeros/telegram';
import { NoopLogger, InMemoryMetricsCollector } from '@careeros/providers';
import { FollowUpReminderService, type TelegramDestinationResolver, type FollowUpClaimLock } from '../follow-up-reminder-service.js';

class FakeApplicationRepository implements Pick<ApplicationRepository, 'findById'> {
  private readonly records = new Map<string, Application>();

  add(application: Application): void {
    this.records.set(application.id, application);
  }

  async findById(id: string): Promise<Application | null> {
    return this.records.get(id) ?? null;
  }
}

class FakeFollowUpRepository implements Pick<FollowUpRepository, 'findDue' | 'save' | 'findById'> {
  private readonly records = new Map<string, FollowUp>();

  async save(followUp: FollowUp): Promise<void> {
    this.records.set(followUp.id, followUp);
  }

  async findById(id: string): Promise<FollowUp | null> {
    return this.records.get(id) ?? null;
  }

  async findDue(before: Date): Promise<FollowUp[]> {
    return [...this.records.values()].filter((followUp) => followUp.isDue && followUp.scheduledAt <= before);
  }
}

class FakeTelegramConnectionRepository implements TelegramDestinationResolver {
  private readonly records = new Map<string, TelegramConnection>();

  add(connection: TelegramConnection): void {
    this.records.set(connection.userId, connection);
  }

  async findByUserId(userId: string): Promise<TelegramConnection | null> {
    return this.records.get(userId) ?? null;
  }
}

/** Grants every claim by default — tests that care about the race the real lock closes opt into denial explicitly. */
class FakeClaimLock implements FollowUpClaimLock {
  private readonly claimed = new Set<string>();
  alwaysDeny = false;

  async checkAndRecord(id: string): Promise<boolean> {
    if (this.alwaysDeny || this.claimed.has(id)) return false;
    this.claimed.add(id);
    return true;
  }
}

const USER_ID = createUserId('11111111-1111-4111-8111-111111111111');
const VACANCY_ID = createVacancyId('22222222-2222-4222-8222-222222222222');

function buildApplication(): Application {
  return Application.create({
    id: createApplicationId(crypto.randomUUID()),
    userId: USER_ID,
    vacancyId: VACANCY_ID,
  });
}

function buildDueFollowUp(applicationId: string, message?: string): FollowUp {
  return FollowUp.reconstitute(createFollowUpId(crypto.randomUUID()), {
    applicationId: createApplicationId(applicationId),
    scheduledAt: new Date(Date.now() - 1000),
    status: FollowUpStatus.PENDING,
    message,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('FollowUpReminderService', () => {
  let applicationRepository: FakeApplicationRepository;
  let followUpRepository: FakeFollowUpRepository;
  let telegramConnectionRepository: FakeTelegramConnectionRepository;
  let telegramClient: InMemoryTelegramClient;
  let claimLock: FakeClaimLock;
  let service: FollowUpReminderService;

  beforeEach(() => {
    applicationRepository = new FakeApplicationRepository();
    followUpRepository = new FakeFollowUpRepository();
    telegramConnectionRepository = new FakeTelegramConnectionRepository();
    telegramClient = new InMemoryTelegramClient();
    claimLock = new FakeClaimLock();
    service = new FollowUpReminderService(
      followUpRepository as unknown as FollowUpRepository,
      applicationRepository as unknown as ApplicationRepository,
      telegramConnectionRepository,
      telegramClient,
      new InMemoryMetricsCollector(),
      new NoopLogger(),
      claimLock
    );
  });

  it('delivers due follow-ups over Telegram and marks them sent', async () => {
    const application = buildApplication();
    applicationRepository.add(application);
    telegramConnectionRepository.add(
      TelegramConnection.create({
        id: createTelegramConnectionId(crypto.randomUUID()),
        userId: USER_ID,
        telegramChatId: 'chat-1',
      })
    );
    const followUp = buildDueFollowUp(application.id, 'Ping the recruiter');
    await followUpRepository.save(followUp);

    const stats = await service.processDue();

    expect(stats).toEqual({ due: 1, sent: 1, skipped: 0, failed: 0 });
    const sent = telegramClient.getSentMessages();
    expect(sent).toHaveLength(1);
    expect(sent[0]?.chatId).toBe('chat-1');
    expect(sent[0]?.text).toContain('Ping the recruiter');

    const reloaded = await followUpRepository.findById(followUp.id);
    expect(reloaded?.status).toBe('sent');
  });

  it('skips follow-ups for users without an active Telegram connection', async () => {
    const application = buildApplication();
    applicationRepository.add(application);
    await followUpRepository.save(buildDueFollowUp(application.id));

    const stats = await service.processDue();

    expect(stats).toEqual({ due: 1, sent: 0, skipped: 1, failed: 0 });
    expect(telegramClient.getSentMessages()).toHaveLength(0);
  });

  it('leaves not-yet-due follow-ups untouched', async () => {
    const application = buildApplication();
    applicationRepository.add(application);
    telegramConnectionRepository.add(
      TelegramConnection.create({
        id: createTelegramConnectionId(crypto.randomUUID()),
        userId: USER_ID,
        telegramChatId: 'chat-1',
      })
    );
    const notDue = FollowUp.reconstitute(createFollowUpId(crypto.randomUUID()), {
      applicationId: createApplicationId(application.id),
      scheduledAt: new Date(Date.now() + 86_400_000),
      status: FollowUpStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await followUpRepository.save(notDue);

    const stats = await service.processDue();

    expect(stats).toEqual({ due: 0, sent: 0, skipped: 0, failed: 0 });
  });

  it('skips (rather than delivers) a due follow-up whose claim another concurrent sweep already holds', async () => {
    const application = buildApplication();
    applicationRepository.add(application);
    telegramConnectionRepository.add(
      TelegramConnection.create({
        id: createTelegramConnectionId(crypto.randomUUID()),
        userId: USER_ID,
        telegramChatId: 'chat-1',
      })
    );
    await followUpRepository.save(buildDueFollowUp(application.id));
    claimLock.alwaysDeny = true;

    const stats = await service.processDue();

    expect(stats).toEqual({ due: 1, sent: 0, skipped: 1, failed: 0 });
    expect(telegramClient.getSentMessages()).toHaveLength(0);
  });

  it('falls back to the default template when no message was scheduled', async () => {
    const application = buildApplication();
    applicationRepository.add(application);
    telegramConnectionRepository.add(
      TelegramConnection.create({
        id: createTelegramConnectionId(crypto.randomUUID()),
        userId: USER_ID,
        telegramChatId: 'chat-1',
      })
    );
    await followUpRepository.save(buildDueFollowUp(application.id));

    await service.processDue();

    const sent = telegramClient.getSentMessages();
    expect(sent[0]?.text).toContain('follow up on my application');
  });
});
