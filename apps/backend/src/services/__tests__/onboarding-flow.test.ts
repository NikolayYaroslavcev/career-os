import { describe, it, expect, beforeEach } from 'vitest';
import { Resume, createResumeId } from '@careeros/career';
import { buildTestWorkflow, type TestWorkflow } from '../../testing/build-test-workflow.js';
import { FIXTURE_USER_ID } from '../../testing/fixtures.js';

/**
 * MVP onboarding flow: Upload Resume -> AI-generated Search Profile
 * suggestions -> user confirms/edits -> Search Profile is created ->
 * Intelligence Search runs against it.
 */
describe('Onboarding flow (Upload CV -> suggestions -> create Search Profile -> intelligence search)', () => {
  let workflow: TestWorkflow;

  beforeEach(() => {
    workflow = buildTestWorkflow({ jobsToReturn: 3 });
  });

  it('walks the full onboarding pipeline end-to-end', async () => {
    // 1. Upload Resume (rawText already extracted, as ResumeService.upload would do).
    const resume = Resume.create({
      id: createResumeId('66666666-6666-4666-8666-666666666666'),
      userId: FIXTURE_USER_ID,
      title: 'Senior Backend Engineer Resume',
      rawText:
        'Senior Backend Engineer with 7 years of experience building services in TypeScript, Node.js, ' +
        'and PostgreSQL. Comfortable working fully remote.',
    });
    resume.setAsDefault();
    await workflow.repositories.resume.save(resume);

    // 2. Suggestions appear, generated from the resume's rawText via the AI provider.
    const suggestion = await workflow.services.searchProfileSuggestion.suggest({
      userId: FIXTURE_USER_ID,
      resumeId: resume.id,
    });

    expect(suggestion.desiredPositions.length).toBeGreaterThan(0);
    expect(suggestion.technologies).toEqual(
      expect.arrayContaining(['typescript', 'node.js', 'postgresql'])
    );
    expect(suggestion.experienceLevel).toBe('senior');
    expect(suggestion.remotePreference).toBe('remote');

    // 3. User reviews/edits the suggestion, then confirms -> Search Profile is created.
    const profile = await workflow.services.searchProfile.create({
      userId: FIXTURE_USER_ID,
      workspaceId: 'workspace-1',
      name: 'Suggested from resume',
      desiredPositions: [...suggestion.desiredPositions],
      desiredTechnologies: [...suggestion.technologies],
      experienceLevel: suggestion.experienceLevel,
      isRemoteOnly: suggestion.remotePreference === 'remote',
    });

    expect(profile.isActive).toBe(true);
    expect(await workflow.services.searchProfile.getActiveForUser(FIXTURE_USER_ID)).not.toBeNull();

    // 4. Intelligence search runs against the newly created (AI-assisted) Search
    // Profile. It returns immediately with the persisted vacancies — AI matching
    // is enqueued to the background worker, not awaited here.
    const result = await workflow.services.intelligenceWorkflow.run({ userId: FIXTURE_USER_ID });

    expect(result.vacancies).toHaveLength(3);
    expect(result.pendingVacancyIds).toHaveLength(3);
    expect(result.stats.providerSearch.persisted).toBe(3);
  });

  it('does not persist a Search Profile from a suggestion alone (requires explicit user confirmation)', async () => {
    const resume = Resume.create({
      id: createResumeId('77777777-7777-4777-8777-777777777777'),
      userId: FIXTURE_USER_ID,
      title: 'Frontend Engineer Resume',
      rawText: 'Frontend engineer skilled in React and TypeScript, hybrid work preferred.',
    });
    resume.setAsDefault();
    await workflow.repositories.resume.save(resume);

    await workflow.services.searchProfileSuggestion.suggest({
      userId: FIXTURE_USER_ID,
      resumeId: resume.id,
    });

    const profiles = await workflow.services.searchProfile.listByUser(FIXTURE_USER_ID);
    expect(profiles).toHaveLength(0);
  });
});
