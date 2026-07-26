import type { PromptVersion } from './prompt-version.js';

export interface PromptBuilder<TParams = Record<string, unknown>> {
  readonly promptId: string;
  readonly currentVersion: string;

  build(params: TParams): BuiltPrompt;
  getVersion(): PromptVersion;
}

export interface BuiltPrompt {
  readonly system: string;
  readonly user: string;
  readonly version: PromptVersion;
}
