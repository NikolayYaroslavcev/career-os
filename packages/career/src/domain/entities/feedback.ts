import { AggregateRoot } from '../base/aggregate-root.js';
import type { FeedbackId, UserId, VacancyId } from '../base/identifier.js';

type FeedbackType = 'positive' | 'negative' | 'neutral';

interface FeedbackProps {
  userId: UserId;
  vacancyId: VacancyId;
  type: FeedbackType;
  rating: number;
  comment?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export class Feedback extends AggregateRoot<FeedbackId> {
  private props: FeedbackProps;

  private constructor(id: FeedbackId, props: FeedbackProps) {
    super(id);
    this.props = props;
  }

  static create(params: {
    id: FeedbackId;
    userId: UserId;
    vacancyId: VacancyId;
    type: FeedbackType;
    rating: number;
    comment?: string;
    tags?: string[];
  }): Feedback {
    if (params.rating < 1 || params.rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    const now = new Date();

    return new Feedback(params.id, {
      userId: params.userId,
      vacancyId: params.vacancyId,
      type: params.type,
      rating: params.rating,
      comment: params.comment?.trim(),
      tags: params.tags ?? [],
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(id: FeedbackId, props: FeedbackProps): Feedback {
    return new Feedback(id, props);
  }

  get userId(): UserId {
    return this.props.userId;
  }

  get vacancyId(): VacancyId {
    return this.props.vacancyId;
  }

  get type(): FeedbackType {
    return this.props.type;
  }

  get rating(): number {
    return this.props.rating;
  }

  get comment(): string | undefined {
    return this.props.comment;
  }

  get tags(): ReadonlyArray<string> {
    return [...this.props.tags];
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  updateRating(rating: number): void {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    this.props.rating = rating;
    this.touch();
  }

  updateComment(comment: string): void {
    this.props.comment = comment.trim();
    this.touch();
  }

  addTag(tag: string): void {
    const trimmed = tag.trim().toLowerCase();

    if (trimmed.length > 0 && !this.props.tags.includes(trimmed)) {
      this.props.tags.push(trimmed);
      this.touch();
    }
  }

  removeTag(tag: string): void {
    const index = this.props.tags.indexOf(tag.trim().toLowerCase());

    if (index !== -1) {
      this.props.tags.splice(index, 1);
      this.touch();
    }
  }

  private touch(): void {
    this.props.updatedAt = new Date();
    this.incrementVersion();
  }
}
