export interface SmartRecruitersPosting {
  readonly id: string;
  readonly name: string;
  readonly ref: string;
  readonly department: SmartRecruitersRef | null;
  readonly occupationArea: SmartRecruitersRef | null;
  readonly industry: SmartRecruitersRef | null;
  readonly city: string;
  readonly country: string;
  readonly location: SmartRecruitersLocation | null;
  readonly experienceLevel: SmartRecruitersRef | null;
  readonly employmentType: SmartRecruitersRef | null;
  readonly salary: SmartRecruitersSalary | null;
  readonly description: string;
  readonly releasedDate: string;
  readonly applyUrl: string;
  readonly language: string;
}

export interface SmartRecruitersRef {
  readonly id: string;
  readonly name: string;
}

export interface SmartRecruitersLocation {
  readonly city: string;
  readonly region: string;
  readonly country: string;
  readonly latitude: number | null;
  readonly longitude: number | null;
}

export interface SmartRecruitersSalary {
  readonly min: number | null;
  readonly max: number | null;
  readonly currency: string;
  readonly unit: string;
}

export interface SmartRecruitersResponse {
  readonly offset: number;
  readonly limit: number;
  readonly totalFound: number;
  readonly content: readonly SmartRecruitersPosting[];
}
