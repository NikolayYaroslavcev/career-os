import { NoopLogger, InMemoryMetricsCollector } from '@careeros/providers';
import { InMemoryTelegramClient } from '@careeros/telegram';
import {
  ApplicationServiceImpl,
  FollowUp,
  createFollowUpId,
  createApplicationId,
  createVacancyId,
  createCompanyId,
  Vacancy,
  Company,
  Location,
  ExperienceLevel,
} from '@careeros/career';
import {
  InMemoryApplicationRepository,
  InMemoryFollowUpRepository,
  InMemoryVacancyRepository,
  InMemoryCompanyRepository,
  InMemoryTelegramConnectionRepository,
} from '../testing/in-memory-repositories.js';
import { buildFixtureTelegramConnection, FIXTURE_USER_ID } from '../testing/fixtures.js';
import { FollowUpReminderService, type FollowUpClaimLock } from '@careeros/notifications';
import { ApplicationCreationService } from '../services/application-creation-service.js';
import { FollowUpService } from '../services/follow-up-service.js';

const DEMO_CHAT_ID = 'demo-telegram-chat';

async function main(): Promise<void> {
  console.log('='.repeat(72));
  console.log('CareerOS — Follow-up Reminder demo (EPIC-08)');
  console.log('='.repeat(72));

  const applicationRepository = new InMemoryApplicationRepository();
  const followUpRepository = new InMemoryFollowUpRepository();
  const vacancyRepository = new InMemoryVacancyRepository();
  const companyRepository = new InMemoryCompanyRepository();
  const telegramConnectionRepository = new InMemoryTelegramConnectionRepository();
  const telegramClient = new InMemoryTelegramClient();
  const metrics = new InMemoryMetricsCollector();
  // Single-process demo — no concurrent sweep to race against, so every claim succeeds.
  const claimLock: FollowUpClaimLock = { checkAndRecord: async () => true };

  const applicationService = new ApplicationServiceImpl(applicationRepository);
  const followUpService = new FollowUpService(followUpRepository, applicationRepository, vacancyRepository, companyRepository);
  const reminderService = new FollowUpReminderService(
    followUpRepository,
    applicationRepository,
    telegramConnectionRepository,
    telegramClient,
    metrics,
    new NoopLogger(),
    claimLock
  );

  const companyId = createCompanyId(crypto.randomUUID());
  await companyRepository.save(Company.create({ id: companyId, name: 'Acme Corp' }), { workspaceId: 'workspace-1' });

  const vacancyId = createVacancyId(crypto.randomUUID());
  await vacancyRepository.save(
    Vacancy.create({
      id: vacancyId,
      title: 'Senior Backend Engineer',
      description: 'Build the core API platform.',
      companyId,
      location: Location.create({ workMode: 'remote' }),
      experienceLevel: ExperienceLevel.SENIOR,
    }),
    { workspaceId: 'workspace-1' }
  );

  await telegramConnectionRepository.save(buildFixtureTelegramConnection(DEMO_CHAT_ID));
  console.log('[1/4] Telegram connection linked');

  const creation = new ApplicationCreationService(applicationService);
  const application = await creation.createFromIds({
    userId: FIXTURE_USER_ID,
    vacancyId,
    workspaceId: 'workspace-1',
  });
  console.log(`[2/4] Application ${application.id} created`);

  const scheduled = await followUpService.schedule(
    application.id,
    FIXTURE_USER_ID,
    new Date(Date.now() + 60_000)
  );
  console.log(`[3/4] Follow-up ${scheduled.id} scheduled with template message:`);
  console.log(`      "${scheduled.message}"`);

  // Fast-forward past the scheduled time — reconstitute so the reminder sweep sees it as due,
  // exactly what the (not-yet-cron-driven) reminder sweep would see once real time passes.
  const dueFollowUp = FollowUp.reconstitute(createFollowUpId(scheduled.id), {
    applicationId: createApplicationId(application.id),
    scheduledAt: new Date(Date.now() - 1000),
    status: 'pending',
    message: scheduled.message,
    createdAt: scheduled.createdAt,
    updatedAt: scheduled.updatedAt,
  });
  await followUpRepository.save(dueFollowUp);

  console.log('[4/4] Running the reminder sweep...');
  const stats = await reminderService.processDue();

  console.log('\n' + '='.repeat(72));
  console.log('Reminder sweep stats');
  console.log('='.repeat(72));
  console.log(stats);

  const sent = telegramClient.getSentMessages();
  console.log('\nTelegram message delivered:');
  console.log('-'.repeat(72));
  console.log(sent[0]?.text ?? '(none sent)');
  console.log('-'.repeat(72));

  if (stats.sent !== 1) {
    throw new Error('Demo expected exactly one reminder to be delivered');
  }

  console.log('\nDone. Pipeline executed end-to-end: Schedule -> Due sweep -> Telegram -> Marked sent.');
}

main().catch((error) => {
  console.error('demo:follow-up-reminder failed:', error);
  process.exitCode = 1;
});
