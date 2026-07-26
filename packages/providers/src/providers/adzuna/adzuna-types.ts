export interface AdzunaJobResult {
  readonly __CLASS__: string;
  readonly results: readonly AdzunaJob[];
  readonly count: number;
  readonly mean: number | null;
  readonly median: number | null;
}

export interface AdzunaJob {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly created: string;
  readonly redirect_url: string;
  readonly salary_min: number | null;
  readonly salary_max: number | null;
  readonly salary_is_predicted: number;
  readonly location: AdzunaLocation;
  readonly company: AdzunaCompany;
  readonly category: AdzunaCategory;
  readonly contract_type: string | null;
  readonly contract_time: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
}

export interface AdzunaLocation {
  readonly __CLASS__: string;
  readonly display_name: string;
  readonly area: readonly string[];
}

export interface AdzunaCompany {
  readonly __CLASS__: string;
  readonly display_name: string;
}

export interface AdzunaCategory {
  readonly __CLASS__: string;
  readonly tag: string;
  readonly label: string;
}
