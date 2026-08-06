import { buildTestWorkflow } from '../testing/build-test-workflow.js';
import { buildFixtureResume, buildFixtureSearchProfile, FIXTURE_USER_ID } from '../testing/fixtures.js';

async function main(): Promise<void> {
  console.log('='.repeat(72));
  console.log('CareerOS — Career Intelligence Flow demo (EPIC-08)');
  console.log('='.repeat(72));

  const workflow = buildTestWorkflow({ jobsToReturn: 5 });

  const resume = buildFixtureResume();
  await workflow.repositories.resume.save(resume);
  console.log(`\n[1/5] Resume loaded: "${resume.title}" (${resume.technologies.length} technologies)`);

  const searchProfile = buildFixtureSearchProfile();
  await workflow.repositories.searchProfile.save(searchProfile, {});
  console.log(`[2/5] Search profile "${searchProfile.name}" created and active (remote-only: ${searchProfile.isRemoteOnly})`);

  console.log('[3/5] Running fixture search + AI matching (mock provider)...');
  const result = await workflow.services.intelligenceWorkflow.run({
    userId: FIXTURE_USER_ID,
    searchProfileId: searchProfile.id,
    awaitAiMatching: true,
  });

  console.log(`[4/5] Recommendations ready (sorted by score):\n`);
  console.log(
    ' # | Score | Rec.        | Vacancy'.padEnd(1) +
      '\n' +
      '-'.repeat(72)
  );

  result.recommendations.forEach((rec, index) => {
    const rank = String(index + 1).padStart(2, ' ');
    const score = String(rec.score).padStart(3, ' ');
    const recLabel = rec.recommendation.padEnd(11, ' ');
    console.log(` ${rank} | ${score}   | ${recLabel} | ${rec.vacancy.title}`);
    if (rec.strengths.length > 0) {
      console.log(`      strengths: ${rec.strengths.join(', ')}`);
    }
    if (rec.missingSkills.length > 0) {
      console.log(`      missing:   ${rec.missingSkills.join(', ')}`);
    }
  });

  const top = result.recommendations[0];
  if (!top) {
    throw new Error('Demo expected at least one recommendation from fixture data');
  }

  console.log(`\n[5/5] Creating an Application from the top recommendation ("${top.vacancy.title}")...`);
  const application = await workflow.services.applicationCreation.createFromRecommendation({
    userId: FIXTURE_USER_ID,
    recommendation: top,
    resumeId: resume.id,
  });

  console.log('\n' + '='.repeat(72));
  console.log('Summary');
  console.log('='.repeat(72));
  console.log(`Provider search : fetched=${result.stats.providerSearch.fetched} persisted=${result.stats.providerSearch.persisted} reused=${result.stats.providerSearch.reused} (${result.stats.providerSearch.durationMs}ms)`);
  console.log(`AI matching     : evaluated=${result.stats.aiMatching.evaluated} computed=${result.stats.aiMatching.computed} reused=${result.stats.aiMatching.reused} (${result.stats.aiMatching.durationMs}ms)`);
  console.log(`Recommendations : ${result.stats.recommendationCount}`);
  console.log(`Application      : id=${application.id} status=${application.status} matchResultId=${application.matchResultId ?? 'MISSING'}`);
  console.log(`Total duration   : ${result.stats.totalDurationMs}ms`);
  console.log('='.repeat(72));

  if (!application.matchResultId) {
    throw new Error('Regression: Application did not preserve the AI match reference');
  }

  console.log('\nDone. Pipeline executed end-to-end: Resume -> fixture search -> AI Matching -> Recommendations -> Application creation.');
}

main().catch((error) => {
  console.error('demo:intelligence failed:', error);
  process.exitCode = 1;
});
