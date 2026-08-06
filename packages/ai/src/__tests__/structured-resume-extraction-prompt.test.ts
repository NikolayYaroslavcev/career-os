import { describe, it, expect } from 'vitest';
import { StructuredResumeExtractionPromptBuilder } from '../prompts/structured-resume-extraction.js';

describe('StructuredResumeExtractionPromptBuilder', () => {
  const builder = new StructuredResumeExtractionPromptBuilder();

  it('has correct promptId and version', () => {
    expect(builder.promptId).toBe('structured-resume-extraction');
    expect(builder.currentVersion).toBe('1.2.0');
  });

  it('builds a prompt with system and user parts', () => {
    const result = builder.build({ rawText: 'John Doe, Software Engineer' });

    expect(result.system).toBeTruthy();
    expect(result.user).toBeTruthy();
    expect(result.version).toBeDefined();
    expect(result.version.id).toBe('structured-resume-extraction');
    expect(result.version.version).toBe('1.2.0');
  });

  it('includes rawText in the user prompt', () => {
    const rawText = 'Jane Smith\nSenior Developer\n5 years experience';
    const result = builder.build({ rawText });

    expect(result.user).toContain(rawText);
  });

  it('system prompt instructs JSON output', () => {
    const result = builder.build({ rawText: 'test' });

    expect(result.system).toContain('JSON');
    expect(result.system).toContain('seniorityLevel');
    expect(result.system).toContain('totalYearsOfExperience');
    expect(result.system).toContain('skills');
    expect(result.system).toContain('technologies');
    expect(result.system).toContain('experience');
    expect(result.system).toContain('education');
  });

  it('generates consistent checksums for same input', () => {
    const v1 = builder.getVersion();
    const v2 = builder.getVersion();

    expect(v1.checksum).toBe(v2.checksum);
  });
});
