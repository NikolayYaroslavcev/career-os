import type {
  UserVacancyInteractionRepository,
  UserVacancyInteractionData,
  InteractionAction,
} from '@careeros/career';
import type { UserId, VacancyId } from '@careeros/career';
import { prisma } from '../client.js';

export class PrismaUserVacancyInteractionRepository implements UserVacancyInteractionRepository {
  async record(input: { userId: UserId; vacancyId: VacancyId; action: InteractionAction }): Promise<void> {
    await prisma.userVacancyInteraction.upsert({
      where: {
        userId_vacancyId_action: {
          userId: input.userId,
          vacancyId: input.vacancyId,
          action: input.action,
        },
      },
      update: {},
      create: {
        userId: input.userId,
        vacancyId: input.vacancyId,
        action: input.action,
      },
    });
  }

  async findByUserId(
    userId: UserId,
    options?: { action?: InteractionAction; since?: Date; limit?: number },
  ): Promise<UserVacancyInteractionData[]> {
    const where: Record<string, unknown> = { userId };
    if (options?.action) where.action = options.action;
    if (options?.since) where.createdAt = { gte: options.since };

    const records = await prisma.userVacancyInteraction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options?.limit ?? 1000,
    });

    return records.map((r) => ({
      id: r.id,
      userId: r.userId as UserId,
      vacancyId: r.vacancyId as VacancyId,
      action: r.action as InteractionAction,
      createdAt: r.createdAt,
    }));
  }

  async findByUserIdAndVacancyId(userId: UserId, vacancyId: VacancyId): Promise<UserVacancyInteractionData[]> {
    const records = await prisma.userVacancyInteraction.findMany({
      where: { userId, vacancyId },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => ({
      id: r.id,
      userId: r.userId as UserId,
      vacancyId: r.vacancyId as VacancyId,
      action: r.action as InteractionAction,
      createdAt: r.createdAt,
    }));
  }

  async countByAction(userId: UserId, action: InteractionAction, options?: { since?: Date }): Promise<number> {
    const where: Record<string, unknown> = { userId, action };
    if (options?.since) where.createdAt = { gte: options.since };

    return prisma.userVacancyInteraction.count({ where });
  }

  async getTechnologiesFromInteractedVacancies(
    userId: UserId,
    action: InteractionAction,
    options?: { since?: Date; limit?: number },
  ): Promise<string[]> {
    const interactions = await this.findByUserId(userId, { action, since: options?.since, limit: options?.limit });

    if (interactions.length === 0) return [];

    const vacancyIds = interactions.map((i) => i.vacancyId);

    const vacancies = await prisma.vacancy.findMany({
      where: { id: { in: vacancyIds as string[] } },
      select: { technologies: true },
    });

    const techSet = new Set<string>();
    for (const v of vacancies) {
      for (const tech of v.technologies) {
        techSet.add(tech.toLowerCase());
      }
    }

    return [...techSet];
  }
}
