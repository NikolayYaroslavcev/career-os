import { describe, it, expect, beforeEach } from 'vitest';
import { AIModeManager } from '../modes/ai-mode-manager.js';

describe('AIModeManager', () => {
  let manager: AIModeManager;

  beforeEach(() => {
    manager = new AIModeManager('manual');
  });

  describe('getMode / setMode', () => {
    it('should return the initial mode', () => {
      expect(manager.getMode()).toBe('manual');
    });

    it('should update the mode', () => {
      manager.setMode('automatic');
      expect(manager.getMode()).toBe('automatic');
    });
  });

  describe('canExecute - manual mode', () => {
    it('should allow explicit user actions', async () => {
      const result = await manager.canExecute('analyze_vacancy');
      expect(result.allowed).toBe(true);
    });

    it('should allow tailor_resume', async () => {
      const result = await manager.canExecute('tailor_resume');
      expect(result.allowed).toBe(true);
    });

    it('should allow cover_letter', async () => {
      const result = await manager.canExecute('cover_letter');
      expect(result.allowed).toBe(true);
    });

    it('should allow interview_prep', async () => {
      const result = await manager.canExecute('interview_prep');
      expect(result.allowed).toBe(true);
    });

    it('should allow salary_analysis', async () => {
      const result = await manager.canExecute('salary_analysis');
      expect(result.allowed).toBe(true);
    });

    it('should allow company_analysis', async () => {
      const result = await manager.canExecute('company_analysis');
      expect(result.allowed).toBe(true);
    });

    it('should allow resume_improvement', async () => {
      const result = await manager.canExecute('resume_improvement');
      expect(result.allowed).toBe(true);
    });

    it('should allow career_advice', async () => {
      const result = await manager.canExecute('career_advice');
      expect(result.allowed).toBe(true);
    });
  });

  describe('canExecute - smart mode', () => {
    beforeEach(() => {
      manager.setMode('smart');
    });

    it('should allow explicit user actions', async () => {
      const result = await manager.canExecute('tailor_resume');
      expect(result.allowed).toBe(true);
    });

    it('should allow high-priority vacancy analysis', async () => {
      const result = await manager.canExecute('analyze_vacancy', { isHighPriority: true });
      expect(result.allowed).toBe(true);
    });

    it('should allow watched company vacancy analysis', async () => {
      const result = await manager.canExecute('analyze_vacancy', { isWatchedCompany: true });
      expect(result.allowed).toBe(true);
    });

    it('should deny low-priority vacancy analysis', async () => {
      const result = await manager.canExecute('analyze_vacancy', { isHighPriority: false });
      expect(result.allowed).toBe(false);
    });
  });

  describe('canExecute - automatic mode', () => {
    beforeEach(() => {
      manager.setMode('automatic');
    });

    it('should allow new vacancy analysis', async () => {
      const result = await manager.canExecute('analyze_vacancy', { isNewVacancy: true });
      expect(result.allowed).toBe(true);
    });

    it('should allow changed vacancy analysis', async () => {
      const result = await manager.canExecute('analyze_vacancy', { isChangedVacancy: true });
      expect(result.allowed).toBe(true);
    });

    it('should deny duplicate vacancy analysis', async () => {
      const result = await manager.canExecute('analyze_vacancy', {});
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('skipping duplicate');
    });

    it('should allow all other features', async () => {
      const result = await manager.canExecute('tailor_resume');
      expect(result.allowed).toBe(true);
    });
  });
});
