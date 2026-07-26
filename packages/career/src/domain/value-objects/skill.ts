import { ValueObject } from '../base/value-object.js';

type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

interface SkillProps {
  name: string;
  level: SkillLevel;
  yearsOfExperience?: number;
}

export class Skill extends ValueObject<SkillProps> {
  private constructor(props: SkillProps) {
    super(props);
  }

  static create(name: string, level: SkillLevel, yearsOfExperience?: number): Skill {
    const trimmed = name.trim();

    if (trimmed.length === 0) {
      throw new Error('Skill name cannot be empty');
    }

    if (trimmed.length > 100) {
      throw new Error('Skill name is too long');
    }

    if (yearsOfExperience !== undefined && (yearsOfExperience < 0 || yearsOfExperience > 50)) {
      throw new Error('Years of experience must be between 0 and 50');
    }

    return new Skill({
      name: trimmed,
      level,
      yearsOfExperience,
    });
  }

  get name(): string {
    return this.props.name;
  }

  get level(): SkillLevel {
    return this.props.level;
  }

  get yearsOfExperience(): number | undefined {
    return this.props.yearsOfExperience;
  }

  get proficiencyScore(): number {
    const scores: Record<SkillLevel, number> = {
      beginner: 1,
      intermediate: 2,
      advanced: 3,
      expert: 4,
    };
    return scores[this.props.level];
  }

  toString(): string {
    return `${this.props.name} (${this.props.level})`;
  }
}
