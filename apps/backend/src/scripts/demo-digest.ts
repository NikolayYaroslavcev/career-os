import { buildTestWorkflow } from '../testing/build-test-workflow.js';
import { buildFixtureResume, buildFixtureSearchProfile, buildFixtureTelegramConnection, FIXTURE_USER_ID } from '../testing/fixtures.js';

const DEMO_CHAT_ID = 'demo-telegram-chat';

async function main(): Promise<void> {
  console.log('='.repeat(72));
  console.log('CareerOS — Morning AI Digest demo (FEATURE-001)');
  console.log('='.repeat(72));

  const workflow = buildTestWorkflow({ jobsToReturn: 12 });

  const resume = buildFixtureResume();
  await workflow.repositories.resume.save(resume);
  console.log(`\n[1/4] Resume loaded: "${resume.title}"`);

  const searchProfile = buildFixtureSearchProfile();
  await workflow.repositories.searchProfile.save(searchProfile, {});
  console.log(`[2/4] Search profile "${searchProfile.name}" active`);

  await workflow.repositories.telegramConnection.save(buildFixtureTelegramConnection(DEMO_CHAT_ID));
  console.log(`[2b/4] Telegram connection linked (chatId resolved automatically from here on)`);

  console.log('[3/4] Running Scheduler -> Search Profile -> Provider Search -> AI Matching -> Ranking -> Digest Builder -> Telegram...');
  const delivery = await workflow.services.digestScheduler.triggerNow({
    userId: FIXTURE_USER_ID,
  });

  console.log('\n' + '='.repeat(72));
  console.log(delivery.digest.title);
  console.log('='.repeat(72));
  console.log(`Date: ${delivery.digest.generatedAt.toISOString().slice(0, 10)}`);
  console.log(`New vacancies: ${delivery.digest.newVacancyCount}`);
  console.log(delivery.digest.summary);

  console.log('\nTop recommendations:\n');
  delivery.digest.topRecommendations.forEach((item) => {
    console.log(`${item.rank}. ${item.vacancyTitle} — ${item.companyName}`);
    console.log(`   ${item.score}% (${item.recommendation})`);
    if (item.reasons.length > 0) {
      console.log(`   Reasons: ${item.reasons.join(', ')}`);
    }
    if (item.missingSkills.length > 0) {
      console.log(`   Missing: ${item.missingSkills.join(', ')}`);
    }
  });

  console.log('\n[4/4] Delivery preview (Telegram message):\n');
  console.log('-'.repeat(72));
  console.log(delivery.message);
  console.log('-'.repeat(72));

  console.log(`\nTelegram send result: success=${delivery.send.success}${delivery.send.success ? ` messageId=${delivery.send.messageId}` : ` error=${delivery.send.error}`}`);

  console.log('\n' + '='.repeat(72));
  console.log('Duplicate protection check — triggering the same digest again');
  console.log('='.repeat(72));
  const secondDelivery = await workflow.services.digestScheduler.triggerNow({
    userId: FIXTURE_USER_ID,
  });
  console.log(
    `First run recommended ${delivery.stats.includedRecommendations} vacancies; ` +
      `second run (same user, no new vacancies) recommended ${secondDelivery.stats.includedRecommendations} ` +
      `(${secondDelivery.stats.newRecommendations} of ${secondDelivery.stats.eligibleRecommendations} eligible were still unnotified).`
  );

  console.log('\n' + '='.repeat(72));
  console.log('Summary');
  console.log('='.repeat(72));
  console.log(`Workflow duration    : ${delivery.stats.workflow.totalDurationMs}ms`);
  console.log(`Digest generation    : ${delivery.stats.digestDurationMs}ms`);
  console.log(`Recommendations found: ${delivery.stats.totalRecommendations} total, ${delivery.stats.eligibleRecommendations} eligible (Strong Apply/Apply), ${delivery.stats.includedRecommendations} sent`);
  console.log(`Telegram delivery    : success=${delivery.send.success}`);
  console.log('='.repeat(72));

  if (!delivery.send.success) {
    throw new Error('Demo expected the (in-memory) Telegram delivery to succeed');
  }

  console.log('\nDone. Pipeline executed end-to-end: Scheduler -> Search Profile -> Provider Search -> AI Matching -> Ranking -> Digest Builder -> Telegram.');
}

main().catch((error) => {
  console.error('demo:digest failed:', error);
  process.exitCode = 1;
});
