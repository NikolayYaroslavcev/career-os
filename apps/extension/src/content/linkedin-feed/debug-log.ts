const PREFIX = '[LinkedInFeed]';

export function logDetectedPost(candidate: unknown): void {
  console.debug(PREFIX, 'detected post', candidate);
}

export function logDiagnostic(reason: string, detail: unknown): void {
  console.debug(PREFIX, 'diagnostic', reason, detail);
}

export function logIngestSucceeded(postId: string, data: unknown): void {
  console.debug(PREFIX, 'ingested', postId, data);
}

export function logIngestFailed(postId: string, reason: string): void {
  console.debug(PREFIX, 'ingest failed', postId, reason);
}
