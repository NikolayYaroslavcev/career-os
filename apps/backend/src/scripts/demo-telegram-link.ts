import { buildTestWorkflow } from '../testing/build-test-workflow.js';
import { buildFixtureResume, buildFixtureSearchProfile, buildFixtureUser, FIXTURE_USER_ID } from '../testing/fixtures.js';

const DEMO_TELEGRAM_CHAT_ID = '987654321';
const DEMO_TELEGRAM_USERNAME = 'demo_jobseeker';

async function main(): Promise<void> {
  console.log('='.repeat(72));
  console.log('CareerOS — Telegram Account Linking demo (FEATURE-002)');
  console.log('='.repeat(72));

  const workflow = buildTestWorkflow({ jobsToReturn: 8 });

  // 1. Create user
  const user = buildFixtureUser();
  await workflow.repositories.user.save(user);
  console.log(`\n[1/5] User created: ${user.fullName} <${user.email.value}>`);

  const resume = buildFixtureResume();
  await workflow.repositories.resume.save(resume);
  const searchProfile = buildFixtureSearchProfile();
  await workflow.repositories.searchProfile.save(searchProfile, {});

  // 2. Dashboard/API generates a one-time linking code
  const { code, expiresAt } = await workflow.services.telegramLinking.generateLinkingCode(FIXTURE_USER_ID);
  console.log(`[2/5] Linking code generated: ${code} (expires ${expiresAt.toISOString()})`);

  // 3. Simulate the Telegram bot receiving "/start <code>" — this is the exact
  //    entry point registerTelegramLinkingBot() would call for a real /start message.
  console.log(`[3/5] Simulating Telegram bot receiving "/start ${code}" from chat ${DEMO_TELEGRAM_CHAT_ID}...`);
  const commandResult = await workflow.services.telegramLinking.handleLinkCommand({
    code,
    telegramChatId: DEMO_TELEGRAM_CHAT_ID,
    telegramUsername: DEMO_TELEGRAM_USERNAME,
  });
  console.log(`      Bot reply: "${commandResult.message}"`);

  if (!commandResult.success) {
    throw new Error('Demo expected the simulated /start command to link successfully');
  }

  // 4. Verify connection persisted
  const connection = await workflow.repositories.telegramConnection.findByUserId(FIXTURE_USER_ID);
  if (!connection || !connection.isActive) {
    throw new Error('Demo expected an active TelegramConnection after linking');
  }
  console.log(
    `[4/5] TelegramConnection verified: userId=${connection.userId} telegramChatId=${connection.telegramChatId} ` +
      `username=@${connection.telegramUsername} status=${connection.status} verifiedAt=${connection.verifiedAt.toISOString()}`
  );

  // 4b. Reusing the same code again must fail — single-use enforcement.
  const reuse = await workflow.services.telegramLinking.handleLinkCommand({
    code,
    telegramChatId: DEMO_TELEGRAM_CHAT_ID,
  });
  console.log(`      Redeeming the same code again: success=${reuse.success} ("${reuse.message}")`);
  if (reuse.success) {
    throw new Error('Demo expected a reused linking code to be rejected');
  }

  // 5. Send the Morning Digest — no chatId passed manually, it's resolved from TelegramConnection.
  console.log('[5/5] Sending Morning AI Digest through the linked account (chatId resolved automatically)...');
  const delivery = await workflow.services.digestScheduler.triggerNow({ userId: FIXTURE_USER_ID });

  console.log('\n' + '='.repeat(72));
  console.log(delivery.digest.title);
  console.log('='.repeat(72));
  console.log(delivery.digest.summary);
  console.log(`\nDelivered to Telegram chatId=${DEMO_TELEGRAM_CHAT_ID} (resolved via TelegramConnection): success=${delivery.send.success}`);

  const sent = workflow.telegramClient.getSentMessages();
  if (sent.length !== 1 || sent[0]?.chatId !== DEMO_TELEGRAM_CHAT_ID) {
    throw new Error('Demo expected exactly one Telegram message sent to the linked chatId');
  }

  console.log('\n' + '='.repeat(72));
  console.log('Summary');
  console.log('='.repeat(72));
  console.log('Flow executed end-to-end: Create user -> Generate link code -> Simulate /start CODE -> Verify connection -> Send digest via linked account.');
  console.log('='.repeat(72));
}

main().catch((error) => {
  console.error('demo:telegram-link failed:', error);
  process.exitCode = 1;
});
