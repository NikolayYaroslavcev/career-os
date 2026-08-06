import {
  Resume,
  SearchProfile,
  User,
  TelegramConnection,
  Email,
  createResumeId,
  createSearchProfileId,
  createUserId,
  createTelegramConnectionId,
  createWorkspaceId,
  Skill,
  Technology,
  ExperienceLevel,
} from '@careeros/career';

export const FIXTURE_USER_ID = createUserId('11111111-1111-4111-8111-111111111111');
export const FIXTURE_WORKSPACE_ID = createWorkspaceId('55555555-5555-4555-8555-555555555555');
export const FIXTURE_TELEGRAM_CONNECTION_ID = createTelegramConnectionId('44444444-4444-4444-8444-444444444444');

export function buildFixtureUser(): User {
  const user = User.create({
    id: FIXTURE_USER_ID,
    email: Email.create('fixture.user@careeros.local'),
    firstName: 'Fixture',
    lastName: 'User',
  });
  user.addToWorkspace(FIXTURE_WORKSPACE_ID);
  return user;
}

export function buildFixtureTelegramConnection(telegramChatId: string): TelegramConnection {
  return TelegramConnection.create({
    id: FIXTURE_TELEGRAM_CONNECTION_ID,
    userId: FIXTURE_USER_ID,
    telegramChatId,
    telegramUsername: 'fixture_user',
  });
}

export function buildFixtureResume(): Resume {
  const resume = Resume.create({
    id: createResumeId('22222222-2222-4222-8222-222222222222'),
    userId: FIXTURE_USER_ID,
    title: 'Senior Backend Engineer Resume',
    summary:
      'Backend engineer with 6 years of experience building distributed TypeScript and Node.js services, ' +
      'with a strong focus on API design, PostgreSQL data modeling, and cloud infrastructure.',
    rawText: 'FIXTURE_RAW_RESUME_TEXT: full PDF extraction including project history and side projects.',
  });

  resume.addSkill(Skill.create('API Design', 'expert', 6));
  resume.addSkill(Skill.create('Distributed Systems', 'advanced', 4));
  resume.addSkill(Skill.create('Database Design', 'advanced', 6));

  resume.addTechnology(Technology.create('typescript', 'language'));
  resume.addTechnology(Technology.create('node.js', 'framework'));
  resume.addTechnology(Technology.create('postgresql', 'database'));
  resume.addTechnology(Technology.create('docker', 'tool'));
  resume.addTechnology(Technology.create('aws', 'cloud'));

  resume.addExperience({
    company: 'Acme Corp',
    position: 'Senior Backend Engineer',
    startDate: new Date('2019-03-01'),
    description: 'Built and scaled the core API platform serving 2M+ daily requests.',
    technologies: [Technology.create('typescript', 'language'), Technology.create('postgresql', 'database')],
  });

  resume.setAsDefault();

  return resume;
}

export function buildFixtureSearchProfile(overrides?: {
  desiredPositions?: string[];
  desiredTechnologies?: Technology[];
}): SearchProfile {
  return SearchProfile.create({
    id: createSearchProfileId('33333333-3333-4333-8333-333333333333'),
    userId: FIXTURE_USER_ID,
    name: 'Remote Backend Roles',
    desiredPositions: overrides?.desiredPositions ?? ['Backend Engineer', 'Software Engineer'],
    desiredTechnologies: overrides?.desiredTechnologies ?? [
      Technology.create('typescript', 'language'),
      Technology.create('node.js', 'framework'),
      Technology.create('postgresql', 'database'),
    ],
    experienceLevel: ExperienceLevel.SENIOR,
    isRemoteOnly: true,
  });
}
