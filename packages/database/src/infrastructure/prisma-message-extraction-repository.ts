import type { MessageExtraction, MessageExtractionRepository } from '@careeros/ai';
import { prisma } from '../client.js';
import { MessageExtractionMapper } from '../mappers/message-extraction-mapper.js';

export class PrismaMessageExtractionRepository implements MessageExtractionRepository {
  /** Always inserts a new row — MessageExtraction is append-only history (see schema.prisma comment on the model). */
  async save(extraction: MessageExtraction): Promise<MessageExtraction> {
    const data = MessageExtractionMapper.toPersistence(extraction);
    const record = await prisma.messageExtraction.create({ data });
    return MessageExtractionMapper.toDomain(record);
  }

  async findById(id: string): Promise<MessageExtraction | null> {
    const record = await prisma.messageExtraction.findUnique({ where: { id } });
    return record ? MessageExtractionMapper.toDomain(record) : null;
  }

  async findByMessageId(messageId: string): Promise<readonly MessageExtraction[]> {
    const records = await prisma.messageExtraction.findMany({
      where: { messageId },
      orderBy: { createdAt: 'desc' },
    });
    return records.map(MessageExtractionMapper.toDomain);
  }

  async findLatestByMessageId(messageId: string): Promise<MessageExtraction | null> {
    const record = await prisma.messageExtraction.findFirst({
      where: { messageId },
      orderBy: { createdAt: 'desc' },
    });
    return record ? MessageExtractionMapper.toDomain(record) : null;
  }

  async findByContentHashAndPrompt(
    contentHash: string,
    provider: string,
    model: string,
    promptChecksum: string,
  ): Promise<MessageExtraction | null> {
    const record = await prisma.messageExtraction.findFirst({
      where: { contentHash, provider, model, promptChecksum },
      orderBy: { createdAt: 'desc' },
    });
    return record ? MessageExtractionMapper.toDomain(record) : null;
  }
}
