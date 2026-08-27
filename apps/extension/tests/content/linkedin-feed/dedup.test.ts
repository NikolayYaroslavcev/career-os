import { describe, it, expect } from 'vitest';
import { SeenPostTracker } from '../../../src/content/linkedin-feed/dedup.js';

describe('SeenPostTracker', () => {
  it('reports a postId as unseen until it is marked seen', () => {
    const tracker = new SeenPostTracker();
    expect(tracker.hasSeen('urn:li:activity:1')).toBe(false);

    tracker.markSeen('urn:li:activity:1');

    expect(tracker.hasSeen('urn:li:activity:1')).toBe(true);
  });

  it('does not re-detect the same postId across repeated scans', () => {
    const tracker = new SeenPostTracker();
    const seenEvents: string[] = [];

    for (const postId of ['a', 'a', 'a', 'b']) {
      if (tracker.hasSeen(postId)) continue;
      tracker.markSeen(postId);
      seenEvents.push(postId);
    }

    expect(seenEvents).toEqual(['a', 'b']);
  });

  it('tracks distinct ids independently and reports the total count', () => {
    const tracker = new SeenPostTracker();
    tracker.markSeen('a');
    tracker.markSeen('b');
    tracker.markSeen('a');

    expect(tracker.size()).toBe(2);
  });
});
