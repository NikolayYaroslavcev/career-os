import { describe, it, expect } from 'vitest';
import { Location } from './location.js';

describe('Location', () => {
  it('should create a remote location', () => {
    const location = Location.create({ workMode: 'remote' });
    expect(location.workMode).toBe('remote');
    expect(location.isRemote).toBe(true);
  });

  it('should create a location with city and country', () => {
    const location = Location.create({
      city: 'Kyiv',
      country: 'Ukraine',
      workMode: 'hybrid',
    });
    expect(location.city).toBe('Kyiv');
    expect(location.country).toBe('Ukraine');
    expect(location.workMode).toBe('hybrid');
  });

  it('should handle relocation possibility', () => {
    const withRelocation = Location.create({
      city: 'Berlin',
      country: 'Germany',
      workMode: 'onsite',
      isRelocationPossible: true,
    });
    expect(withRelocation.isRelocationPossible).toBe(true);
    expect(withRelocation.hasGeographicRestriction).toBe(false);

    const withoutRelocation = Location.create({
      city: 'Berlin',
      country: 'Germany',
      workMode: 'onsite',
      isRelocationPossible: false,
    });
    expect(withoutRelocation.hasGeographicRestriction).toBe(true);
  });

  it('should trim city and country', () => {
    const location = Location.create({
      city: '  Kyiv  ',
      country: '  Ukraine  ',
      workMode: 'remote',
    });
    expect(location.city).toBe('Kyiv');
    expect(location.country).toBe('Ukraine');
  });

  it('should default relocation to false', () => {
    const location = Location.create({ workMode: 'onsite' });
    expect(location.isRelocationPossible).toBe(false);
  });

  it('should convert to string', () => {
    const remote = Location.create({ workMode: 'remote' });
    expect(remote.toString()).toBe('Unspecified (remote)');

    const hybrid = Location.create({
      city: 'Kyiv',
      country: 'Ukraine',
      workMode: 'hybrid',
    });
    expect(hybrid.toString()).toBe('Kyiv, Ukraine (hybrid)');
  });
});
