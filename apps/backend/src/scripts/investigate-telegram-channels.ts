// One-off investigation for channels flagged as producing zero visible
// vacancies in an external comparison dataset (Hack Offer). Read-only against
// Telegram — hits each channel's real `t.me/s/<channel>` preview page via the
// same TelegramFetcher path production uses, and reports reachability,
// message volume, and how many messages clear the (IT-relevance) precheck.
// No DB writes; this is the evidence behind a keep/remove decision made by a
// human (or the caller script) afterward, not an automated deletion.
import { TelegramFetcher, isLikelyJobPost, ConsoleLogger, InMemoryMetricsCollector, InMemoryTracer } from '@careeros/providers';

const CHANNELS = ['workitkz', 'jobforqa', 'golangjob', 'rabotafrontend', 'forfrontend'];

async function investigate(channel: string): Promise<void> {
  const fetcher = new TelegramFetcher({
    channels: [channel],
    logger: new ConsoleLogger(),
    metrics: new InMemoryMetricsCollector(),
    tracer: new InMemoryTracer(),
  });

  console.log(`\n=== @${channel} ===`);
  try {
    const messages = await fetcher.fetchRawMessages(channel);
    const real = messages.filter((m) => !m.isServiceMessage);
    const passingPrecheck = real.filter((m) => isLikelyJobPost(m.text, { isServiceMessage: m.isServiceMessage }));

    console.log(`  Reachable: yes`);
    console.log(`  Raw messages in preview window: ${messages.length} (${real.length} non-service)`);
    console.log(`  Pass IT-relevance precheck: ${passingPrecheck.length}/${real.length}`);
    if (real.length > 0) {
      // The `/s/` preview lists messages oldest-first, so the most recent
      // post is the last element, not the first.
      const mostRecent = real[real.length - 1]!;
      console.log(`  Most recent message (${mostRecent.publishedAt.toISOString()}):`);
      console.log(`    ${mostRecent.text.slice(0, 160).replace(/\n/g, ' ')}`);
    }

    const mostRecent = real[real.length - 1];
    const daysSinceLastPost = mostRecent ? (Date.now() - mostRecent.publishedAt.getTime()) / 86_400_000 : Infinity;
    const STALE_THRESHOLD_DAYS = 60;

    const verdict =
      real.length === 0
        ? 'DEAD — channel resolves but preview page has no parseable content'
        : passingPrecheck.length === 0
          ? 'DEAD — active channel but zero messages pass the IT-relevance precheck (off-topic or non-vacancy content)'
          : daysSinceLastPost > STALE_THRESHOLD_DAYS
            ? `DEAD — stale, no new posts in ${Math.round(daysSinceLastPost)} days (last: ${mostRecent!.publishedAt.toISOString().slice(0, 10)})`
            : 'ACTIVE — keep';
    console.log(`  Verdict: ${verdict}`);
  } catch (error) {
    console.log(`  Reachable: NO — ${error instanceof Error ? error.message : String(error)}`);
    console.log(`  Verdict: DEAD — unreachable`);
  }
}

async function main(): Promise<void> {
  console.log('=== Telegram Channel Investigation ===');
  for (const channel of CHANNELS) {
    await investigate(channel);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
