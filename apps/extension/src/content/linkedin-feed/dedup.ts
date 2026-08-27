export class SeenPostTracker {
  private readonly seen = new Set<string>();

  hasSeen(postId: string): boolean {
    return this.seen.has(postId);
  }

  markSeen(postId: string): void {
    this.seen.add(postId);
  }

  size(): number {
    return this.seen.size;
  }
}
