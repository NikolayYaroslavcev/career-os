export type { AtsAdapter } from './interfaces/ats-adapter.js';
export type { AtsRawJob, AtsRawJobSalary } from './interfaces/ats-raw-job.js';
export type {
  GreenhouseAdapterConfig,
  LeverAdapterConfig,
  SmartRecruitersAdapterConfig,
  RecruiteeAdapterConfig,
  ComeetAdapterConfig,
  AshbyAdapterConfig,
  WorkdayAdapterConfig,
  TeamtailorAdapterConfig,
  PersonioAdapterConfig,
  WorkableAdapterConfig,
} from './interfaces/ats-config.js';
export { AtsHttpError } from './errors.js';

export { GreenhouseAdapter } from './adapters/greenhouse-adapter.js';
export {
  fetchJobsPage,
  fetchSingleJob,
  pingBoard,
} from './transport/greenhouse-transport.js';
export type {
  GreenhouseJobsPayload,
  GreenhouseRawJobPayload,
  GreenhouseMetadataFieldPayload,
  GreenhousePayRangePayload,
} from './transport/greenhouse-transport.js';
export { parseJob, parseJobsResponse, isValidGreenhouseJob } from './parsers/greenhouse-parser.js';

export { LeverAdapter } from './adapters/lever-adapter.js';
export {
  fetchPostingsPage as fetchLeverPostingsPage,
  fetchAllPostings as fetchAllLeverPostings,
  fetchSinglePosting as fetchSingleLeverPosting,
  pingPostingsPage as pingLeverPostingsPage,
  pingAllPostings as pingAllLeverPostings,
} from './transport/lever-transport.js';
export type {
  LeverPostingPayload,
  LeverCategoriesPayload,
  LeverSalaryRangePayload,
  LeverListPayload,
} from './transport/lever-transport.js';
export {
  parseJob as parseLeverJob,
  parseJobsResponse as parseLeverJobsResponse,
  isValidLeverPosting,
} from './parsers/lever-parser.js';

export { SmartRecruitersAdapter } from './adapters/smartrecruiters-adapter.js';
export {
  fetchPostingsPage as fetchSmartRecruitersPostingsPage,
  fetchSinglePosting as fetchSingleSmartRecruitersPosting,
  pingPostings as pingSmartRecruitersPostings,
} from './transport/smartrecruiters-transport.js';
export type {
  SmartRecruitersPostingPayload,
  SmartRecruitersListPayload,
  SmartRecruitersRefPayload,
  SmartRecruitersLocationPayload,
  SmartRecruitersSalaryPayload,
} from './transport/smartrecruiters-transport.js';
export {
  parseJob as parseSmartRecruitersJob,
  parseJobsResponse as parseSmartRecruitersJobsResponse,
  isValidSmartRecruitersPosting,
} from './parsers/smartrecruiters-parser.js';

export { RecruiteeAdapter } from './adapters/recruitee-adapter.js';
export {
  fetchOffersPage as fetchRecruiteeOffersPage,
  pingOffers as pingRecruiteeOffers,
} from './transport/recruitee-transport.js';
export type {
  RecruiteeOfferPayload,
  RecruiteeListPayload,
} from './transport/recruitee-transport.js';
export {
  parseJob as parseRecruiteeJob,
  parseJobsResponse as parseRecruiteeJobsResponse,
  isValidRecruiteeOffer,
} from './parsers/recruitee-parser.js';

export {
  fetchPositions as fetchComeetPositions,
  pingPositions as pingComeetPositions,
} from './transport/comeet-transport.js';
export type {
  ComeetJobPayload,
  ComeetListPayload,
  ComeetLocationPayload,
  ComeetDetailSectionPayload,
} from './transport/comeet-transport.js';
export {
  parseJob as parseComeetJob,
  parseJobsResponse as parseComeetJobsResponse,
  isValidComeetJob,
} from './parsers/comeet-parser.js';

export { AshbyAdapter } from './adapters/ashby-adapter.js';
export {
  fetchJobBoard as fetchAshbyJobBoard,
  pingJobBoard as pingAshbyJobBoard,
} from './transport/ashby-transport.js';
export type {
  AshbyJobPayload,
  AshbyJobBoardPayload,
  AshbyEmploymentTypePayload,
} from './transport/ashby-transport.js';
export {
  parseJob as parseAshbyJob,
  parseJobsResponse as parseAshbyJobsResponse,
  isValidAshbyJob,
} from './parsers/ashby-parser.js';

export { WorkdayAdapter } from './adapters/workday-adapter.js';
export {
  fetchJobsPage as fetchWorkdayJobsPage,
  pingJobs as pingWorkdayJobs,
  buildJobUrl as buildWorkdayJobUrl,
} from './transport/workday-transport.js';
export type {
  WorkdayJobPostingPayload,
  WorkdayJobsPayload,
} from './transport/workday-transport.js';
export {
  parseJob as parseWorkdayJob,
  parseJobsResponse as parseWorkdayJobsResponse,
  isValidWorkdayJobPosting,
} from './parsers/workday-parser.js';

export { TeamtailorAdapter } from './adapters/teamtailor-adapter.js';
export {
  fetchJobsPage as fetchTeamtailorJobsPage,
  fetchSingleJob as fetchSingleTeamtailorJob,
  pingJobs as pingTeamtailorJobs,
} from './transport/teamtailor-transport.js';
export type {
  TeamtailorJobResourcePayload,
  TeamtailorJobsListPayload,
  TeamtailorJobPayload,
  TeamtailorIncludedResourcePayload,
  TeamtailorJobAttributesPayload,
} from './transport/teamtailor-transport.js';
export {
  parseJob as parseTeamtailorJob,
  parseJobsResponse as parseTeamtailorJobsResponse,
  isValidTeamtailorJob,
} from './parsers/teamtailor-parser.js';

export { PersonioAdapter } from './adapters/personio-adapter.js';
export {
  fetchXmlFeed as fetchPersonioXmlFeed,
  pingXmlFeed as pingPersonioXmlFeed,
  buildJobUrl as buildPersonioJobUrl,
} from './transport/personio-transport.js';
export {
  parseFeed as parsePersonioFeed,
  splitPositions as splitPersonioPositions,
  parsePosition as parsePersonioPosition,
  toAtsRawJob as toPersonioAtsRawJob,
  isValidPersonioPosition,
} from './parsers/personio-parser.js';
export type { PersonioPositionPayload, PersonioDescriptionSection } from './parsers/personio-parser.js';

export { WorkableAdapter } from './adapters/workable-adapter.js';
export {
  fetchWidget as fetchWorkableWidget,
  pingWidget as pingWorkableWidget,
} from './transport/workable-transport.js';
export type {
  WorkableJobPayload,
  WorkableWidgetPayload,
  WorkableLocationPayload,
} from './transport/workable-transport.js';
export {
  parseJob as parseWorkableJob,
  parseJobsResponse as parseWorkableJobsResponse,
  isValidWorkableJob,
} from './parsers/workable-parser.js';
