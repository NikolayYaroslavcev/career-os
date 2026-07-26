import { createHash } from 'node:crypto';
import type { AIRequest } from '../domain/ai-types.js';

export function computePromptHash(request: AIRequest): string {
  const payload = JSON.stringify({
    prompt: request.prompt,
    promptId: request.promptId,
    promptVersion: request.promptVersion,
    model: request.model,
    temperature: request.temperature,
    maxTokens: request.maxTokens,
    systemPrompt: request.systemPrompt,
  });

  return createHash('sha256').update(payload).digest('hex');
}
