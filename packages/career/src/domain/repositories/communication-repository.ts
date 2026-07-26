import type { CommunicationId, ApplicationId } from '../base/identifier.js';
import type { Communication } from '../entities/communication.js';

export interface CommunicationRepository {
  findById(id: CommunicationId): Promise<Communication | null>;
  findByApplicationId(applicationId: ApplicationId): Promise<Communication[]>;
  save(communication: Communication): Promise<void>;
  delete(id: CommunicationId): Promise<void>;
}
