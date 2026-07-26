export interface ComeetLocation {
  readonly name: string;
  readonly country: string | null;
  readonly city: string | null;
  readonly is_remote: boolean;
}

export interface ComeetDetailSection {
  readonly name: string;
  readonly value: string | null;
}

export interface ComeetJob {
  readonly uid: string;
  readonly name: string;
  readonly department: string | null;
  readonly location: ComeetLocation;
  readonly employment_type: string | null;
  readonly workplace_type: string | null;
  readonly time_updated: string;
  readonly company_name: string;
  readonly url_active_page: string;
  readonly position_url: string;
  readonly details?: readonly ComeetDetailSection[];
}

export type ComeetResponse = readonly ComeetJob[];
