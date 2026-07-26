import { describe, it, expect } from 'vitest';
import { Technology } from './technology.js';

describe('Technology', () => {
  it('should create a technology', () => {
    const tech = Technology.create('TypeScript', 'language');
    expect(tech.name).toBe('TypeScript');
    expect(tech.category).toBe('language');
  });

  it('should create with version', () => {
    const tech = Technology.create('React', 'framework', '19.0.0');
    expect(tech.version).toBe('19.0.0');
  });

  it('should trim name', () => {
    const tech = Technology.create('  Node.js  ', 'tool');
    expect(tech.name).toBe('Node.js');
  });

  it('should throw on empty name', () => {
    expect(() => Technology.create('', 'language')).toThrow('Technology name cannot be empty');
  });

  it('should throw on too long name', () => {
    const longName = 'A'.repeat(101);
    expect(() => Technology.create(longName, 'language')).toThrow('Technology name is too long');
  });

  it('should implement equals correctly', () => {
    const tech1 = Technology.create('TypeScript', 'language');
    const tech2 = Technology.create('TypeScript', 'language');
    const tech3 = Technology.create('JavaScript', 'language');

    expect(tech1.equals(tech2)).toBe(true);
    expect(tech1.equals(tech3)).toBe(false);
  });

  it('should convert to string with version', () => {
    const tech = Technology.create('React', 'framework', '19.0.0');
    expect(tech.toString()).toBe('React 19.0.0');
  });

  it('should convert to string without version', () => {
    const tech = Technology.create('PostgreSQL', 'database');
    expect(tech.toString()).toBe('PostgreSQL');
  });
});
