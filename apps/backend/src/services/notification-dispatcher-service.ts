import type { MatchResultRepository } from '@careeros/ai';
import type { VacancyRepository, ApplicationRepository } from '@careeros/career';
import { createUserId, createVacancyId } from '@careeros/career';
import type { TelegramClient } from '@careeros/telegram';

export interface NotificationEvent {
  readonly type: 'high_score_job' | 'interview_approaching' | 'application_deadline';
  readonly userId: string;
  readonly chatId: string;
  readonly title: string;
  readonly body: string;
  readonly metadata?: Record<string, unknown>;
}

export class NotificationDispatcherService {
  constructor(
    private readonly matchResultRepository: MatchResultRepository,
    private readonly vacancyRepository: VacancyRepository,
    private readonly applicationRepository: ApplicationRepository,
    private readonly telegramClient: TelegramClient,
  ) {}

  async checkHighScoreJobs(userId: string, chatId: string, threshold = 80): Promise<NotificationEvent[]> {
    const matchResults = await this.matchResultRepository.findByUserId(userId);
    const recentResults = matchResults.filter((mr) => {
      const age = Date.now() - mr.generatedAt.getTime();
      return age < 24 * 60 * 60 * 1000;
    });

    const highScoreResults = recentResults.filter(
      (mr) => mr.overallScore >= threshold,
    );

    const events: NotificationEvent[] = [];

    for (const result of highScoreResults) {
      const vacancy = await this.vacancyRepository.findById(createVacancyId(result.vacancyId));
      if (!vacancy) continue;

      events.push({
        type: 'high_score_job',
        userId,
        chatId,
        title: `New high-match job: ${vacancy.title}`,
        body: `Score: ${result.overallScore}/100 — ${result.summary}`,
        metadata: {
          vacancyId: vacancy.id.toString(),
          matchResultId: result.id.toString(),
          score: result.overallScore,
        },
      });
    }

    return events;
  }

  async checkInterviewApproaching(userId: string, chatId: string): Promise<NotificationEvent[]> {
    const brandedUserId = createUserId(userId);
    const applications = await this.applicationRepository.findByUserId(brandedUserId);
    const events: NotificationEvent[] = [];

    for (const app of applications) {
      const vacancy = await this.vacancyRepository.findById(app.vacancyId);
      events.push({
        type: 'interview_approaching',
        userId,
        chatId,
        title: `Application update: ${vacancy?.title ?? 'Unknown'}`,
        body: `Status: ${app.status}`,
        metadata: {
          applicationId: app.id.toString(),
          status: app.status,
        },
      });
    }

    return events;
  }

  async dispatch(event: NotificationEvent): Promise<void> {
    try {
      await this.telegramClient.send(event.chatId, `${event.title}\n\n${event.body}`);
    } catch (error) {
      console.error(`Failed to dispatch notification: ${error}`);
    }
  }

  async dispatchAll(events: NotificationEvent[]): Promise<void> {
    for (const event of events) {
      await this.dispatch(event);
    }
  }
}
