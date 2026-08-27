export interface LinkedInFeedPostCandidate {
  postId: string;
  postUrl?: string;
  authorName?: string;
  rawText: string;
  publishedAt?: string;
  links: string[];
}
