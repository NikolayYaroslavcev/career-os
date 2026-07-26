# EPIC-13: Advanced AI Features

## Status

**Partial.** Career analytics is implemented (`career-intelligence-service.ts`, `packages/analytics`, see ADR-029) and a recommendation engine exists (`recommendation-service.ts`, dashboard `features/recommendations`). Not implemented: interview simulator (`packages/interview` is a two-line stub with no dashboard route despite the `Interview` domain entity existing), salary prediction, and formal skill-gap/career-path suggestions. Two adjacent AI features exist in code but aren't wired into any dashboard route: cover letter generation (`cover-letter-service.ts` + `features/cover-letter`) and resume tailoring (`resume-tailoring-service.ts` + `features/resume-tailoring`) — both are unreachable dead UI until linked from a page (e.g. the application detail view).

## Duration

5-7 days

## Dependencies

EPIC-05 (AI Layer), EPIC-12 (Dashboard)

## Objective

Create advanced AI-powered career features.

## Tasks

### TASK-13-01: Learning Engine
- [ ] Track user preferences
- [ ] Learn from feedback
- [ ] Improve recommendations

### TASK-13-02: Salary Prediction
- [ ] Analyze market data
- [ ] Predict salary ranges
- [ ] Show salary insights

### TASK-13-03: Skill Recommendations
- [ ] Identify skill gaps
- [ ] Recommend learning
- [ ] Track skill growth

### TASK-13-04: Interview Simulator
- [ ] Generate practice questions
- [ ] Provide answer feedback
- [ ] Track performance

### TASK-13-05: Career Path Suggestions
- [ ] Analyze career trajectory
- [ ] Suggest next roles
- [ ] Show growth opportunities

### TASK-13-06: Analytics AI
- [ ] Predict application success
- [ ] Identify patterns
- [ ] Provide insights

## Deliverables

- Learning engine
- Salary prediction
- Skill recommendations
- Interview simulator
- Career path suggestions
- Analytics AI

## Acceptance Criteria

- [ ] Learning improves over time
- [ ] Salary predictions accurate
- [ ] Skill recommendations relevant
- [ ] Interview practice helpful
- [ ] Career paths logical
- [ ] Analytics insights valuable
