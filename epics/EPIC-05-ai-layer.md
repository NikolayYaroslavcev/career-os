# EPIC-05: AI Layer

## Status

**Complete, exceeds original scope.** `packages/ai` implements the `AIProvider` abstraction with OpenAI, Anthropic, Groq, Gemini, and OpenRouter providers, plus a resilience/fallback layer (`packages/ai-orchestrator`, see ADR-025 and ADR-028) that the original spike didn't call for.

## Duration

3-4 days

## Dependencies

EPIC-04 (Backend API)

## Objective

Create pluggable AI provider system with prompt management.

## Tasks

### TASK-05-01: AIProvider Interface
- [ ] Define AIProvider interface
- [ ] Define response types
- [ ] Define options types

### TASK-05-02: OpenAI Provider
- [ ] Implement OpenAI provider
- [ ] Add API key configuration
- [ ] Add error handling
- [ ] Add retry logic

### TASK-05-03: Anthropic Provider
- [ ] Implement Anthropic provider
- [ ] Add API key configuration
- [ ] Add error handling
- [ ] Add retry logic

### TASK-05-04: Prompt Templates
- [ ] Create prompt templates
- [ ] Add versioning
- [ ] Add template variables

### TASK-05-05: Response Validation
- [ ] Validate AI responses
- [ ] Handle malformed responses
- [ ] Add fallback logic

### TASK-05-06: Provider Registry
- [ ] Create provider registry
- [ ] Add provider selection
- [ ] Add fallback provider

### TASK-05-07: AI Testing Utilities
- [ ] Create mock providers
- [ ] Add test fixtures
- [ ] Add integration tests

## Deliverables

- AIProvider interface
- OpenAI provider working
- Anthropic provider working
- Prompt templates
- Response validation
- Provider registry

## Acceptance Criteria

- [ ] Providers can be swapped via config
- [ ] Prompts are versioned
- [ ] Responses are validated
- [ ] Fallback works on failure
- [ ] Tests pass
