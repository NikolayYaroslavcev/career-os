import { describe, it, expect } from 'vitest';
import { Skill } from './skill.js';

describe('Skill', () => {
  it('should create a skill with level', () => {
    const skill = Skill.create('TypeScript', 'advanced');
    expect(skill.name).toBe('TypeScript');
    expect(skill.level).toBe('advanced');
  });

  it('should create a skill with experience', () => {
    const skill = Skill.create('React', 'expert', 5);
    expect(skill.yearsOfExperience).toBe(5);
  });

  it('should trim skill name', () => {
    const skill = Skill.create('  TypeScript  ', 'intermediate');
    expect(skill.name).toBe('TypeScript');
  });

  it('should calculate proficiency score', () => {
    expect(Skill.create('JS', 'beginner').proficiencyScore).toBe(1);
    expect(Skill.create('JS', 'intermediate').proficiencyScore).toBe(2);
    expect(Skill.create('JS', 'advanced').proficiencyScore).toBe(3);
    expect(Skill.create('JS', 'expert').proficiencyScore).toBe(4);
  });

  it('should throw on empty name', () => {
    expect(() => Skill.create('', 'advanced')).toThrow('Skill name cannot be empty');
  });

  it('should throw on too long name', () => {
    const longName = 'A'.repeat(101);
    expect(() => Skill.create(longName, 'advanced')).toThrow('Skill name is too long');
  });

  it('should throw on negative experience', () => {
    expect(() => Skill.create('JS', 'advanced', -1)).toThrow('Years of experience must be between 0 and 50');
  });

  it('should throw on experience over 50', () => {
    expect(() => Skill.create('JS', 'advanced', 51)).toThrow('Years of experience must be between 0 and 50');
  });

  it('should implement equals correctly', () => {
    const skill1 = Skill.create('TypeScript', 'advanced');
    const skill2 = Skill.create('TypeScript', 'advanced');
    const skill3 = Skill.create('TypeScript', 'beginner');

    expect(skill1.equals(skill2)).toBe(true);
    expect(skill1.equals(skill3)).toBe(false);
  });

  it('should convert to string', () => {
    const skill = Skill.create('React', 'expert');
    expect(skill.toString()).toBe('React (expert)');
  });
});
