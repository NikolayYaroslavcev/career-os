import { createHash } from 'node:crypto';

export interface PromptVersion {
  readonly id: string;
  readonly version: string;
  readonly checksum: string;
}

export function createPromptVersion(id: string, version: string, content: string): PromptVersion {
  const checksum = createHash('sha256').update(content).digest('hex').slice(0, 16);
  return { id, version, checksum };
}

export function verifyPromptChecksum(version: PromptVersion, content: string): boolean {
  const expected = createHash('sha256').update(content).digest('hex').slice(0, 16);
  return version.checksum === expected;
}
