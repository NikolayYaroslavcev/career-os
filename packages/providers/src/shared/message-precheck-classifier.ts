// Cheap, deterministic "is this even a job post?" gate — no LLM involved.
// Originally lived only inside TelegramFetcher (private isLikelyVacancyPost);
// pulled out here so it's platform-agnostic and reusable by anything that
// needs to filter free-text community content before spending AI tokens on
// it (e.g. the SocialMessage extraction pipeline, ADR-032 Phase 4/5) without
// duplicating the keyword bank.

// IT-specific role words: on their own, these are an unambiguous IT/tech
// signal — a post can't say "ищем разработчика" or "product manager" the way
// it can say "ищем менеджера" (sales? office? IT?) or "вакансия" (any
// industry). Includes tech-adjacent roles (product/analyst/UX) that a
// dev/QA/design-focused channel post might not pair with a TECH_KEYWORDS
// stack mention every time.
export const IT_ROLE_KEYWORDS = [
  'developer', 'engineer', 'designer', 'tester', 'architect',
  'разработчик', 'программист', 'инженер', 'дизайнер', 'тестировщик', 'архитектор',
  'product manager', 'product owner', 'продакт', 'продукт-менеджер', 'продукт менеджер',
  'ux', 'ui', 'ux/ui', 'ui/ux',
  'data analyst', 'бизнес-аналитик', 'бизнес аналитик', 'системный аналитик', 'аналитик данных',
];

// Generic hiring-intent words: signal "this is a job post" but say nothing
// about industry — a cleaner, driver, or sales-manager vacancy uses these
// exact words as often as an IT one does, so none of these may pass the gate
// by itself (see isLikelyJobPost below).
export const GENERIC_HIRING_KEYWORDS = [
  'vacancy', 'vacancies', 'hiring', 'we are looking', "we're looking", 'job opening', 'position',
  'manager', 'analyst', 'fulltime', 'parttime',
  'вакансия', 'вакансии', 'ищем', 'требуется', 'требуются', 'набираем',
  'менеджер', 'аналитик', 'откликнуться', 'резюме',
];

export const TECH_KEYWORDS = [
  'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'golang', 'go', 'rust',
  '1c', '1с', 'php', 'ruby', 'scala', 'kotlin', 'swift', 'dart', 'flutter',
  'react', 'vue', 'angular', 'node', 'node.js', 'nodejs', 'express', 'django', 'flask', 'spring', 'laravel',
  'nextjs', 'next.js', 'nuxtjs', 'svelte', 'unity',
  'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'k8s', 'terraform', 'ansible',
  'postgresql', 'postgres', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'clickhouse', 'kafka',
  'git', 'ci/cd', 'jenkins', 'gitlab', 'github actions',
  'html', 'css', 'scss', 'less', 'tailwind',
  'sql', 'nosql', 'graphql', 'rest', 'grpc',
  'linux', 'bash', 'powershell',
  'machine learning', 'ml', 'ai', 'data science', 'pandas', 'pytorch', 'tensorflow',
  'android', 'ios', 'unreal',
  'figma', 'sketch', 'qa', 'devops',
];

/**
 * True when free text plausibly describes an IT/tech job post: not a service
 * message, long enough to carry real content, and containing at least one
 * tech-stack or IT-role signal. A generic hiring-intent word alone
 * ("вакансия", "ищем", "manager") is NOT sufficient — that phrasing is just
 * as common on a cleaner/driver/sales-manager post as on a dev one, and
 * community channels mix both. Requiring an actual IT/tech signal keeps
 * obviously non-IT posts out before any AI call, without a second filtering
 * pipeline downstream. False negatives are expected and fine (a message with
 * no IT signal reaching an LLM anyway would be worse) — this is a recall
 * gate for spend, not a precision classifier.
 */
export function isLikelyJobPost(text: string, options: { isServiceMessage?: boolean } = {}): boolean {
  if (options.isServiceMessage) return false;
  if (!text || text.trim().length < 15) return false;

  const lower = text.toLowerCase();
  const hasItRoleKeyword = IT_ROLE_KEYWORDS.some((k) => lower.includes(k));
  const hasTechKeyword = TECH_KEYWORDS.some((k) => lower.includes(k));
  return hasItRoleKeyword || hasTechKeyword;
}

// ==================== DETERMINISTIC CATEGORY REJECTION ====================
//
// isLikelyJobPost() above answers "is this IT-relevant at all?" — it says
// nothing about *what kind* of IT-relevant post it is. A course ad, a
// recruiter's "I'll find you a job" pitch, or a candidate's own "hire me"
// post all mention tech/role keywords and sail through it. The rules below
// answer the narrower question "does this look like one of the specific
// non-vacancy content types we know show up on these channels?" — run
// BEFORE isLikelyJobPost so a course ad that happens to say "React" is
// rejected for being a course, not waved through by the tech-keyword gate.
//
// Every rule is deliberately conservative: broad single-word keyword lists
// are only used for topics that essentially never legitimately co-occur
// with a real vacancy post (crypto, giveaways, courses, webinars,
// affiliate/sponsorship, newsletters/news). The two riskiest categories —
// a candidate's own job-seeking post, and a recruiter/agency's *self*-
// promotion — use multi-word phrase anchors instead of single words,
// because their most obvious single-word signals ("резюме", "вакансия")
// are also completely normal inside a real employer's vacancy post (e.g.
// "пришлите резюме на …"). See each constant's comment for the specific
// false-positive this was designed to avoid.

export type PrecheckRejectionCategory =
  | 'service_message'
  | 'too_short'
  | 'not_it_relevant'
  | 'resume_candidate_seeking'
  | 'recruiter_self_promotion'
  | 'agency_promotion'
  | 'course_bootcamp'
  | 'webinar_event'
  | 'giveaway'
  | 'crypto'
  | 'affiliate_sponsorship'
  | 'newsletter_news';

export interface PrecheckRejection {
  readonly category: PrecheckRejectionCategory;
  /** Stable id of the specific rule that fired, e.g. "course_bootcamp.ru_course_keyword" — for audit logs, not user-facing. */
  readonly ruleId: string;
  /** The literal substring that matched, lowercased — proof of why this rejected, not a full quote of the message. */
  readonly matchedText: string;
}

export type PrecheckDecision = { readonly accepted: true } | ({ readonly accepted: false } & PrecheckRejection);

interface CategoryRule {
  readonly ruleId: string;
  readonly category: PrecheckRejectionCategory;
  readonly keywords: readonly string[];
}

// First-person job-seeking phrasing only — never a bare "резюме"/"вакансия"
// (both are normal in a real employer post like "пришлите резюме на …").
// False-positive guard: "Пришлите резюме на hr@company.com" must NOT match
// any of these — it contains no first-person seeking phrase.
const RESUME_CANDIDATE_SEEKING_PHRASES = [
  'ищу работу', 'ищу вакансию', 'в поиске работы', 'в активном поиске работы',
  'рассматриваю предложения', 'открыт к предложениям', 'открыта к предложениям',
  'рассмотрю предложения', 'резюме на позицию',
  'looking for a job', "looking for a new role", 'open to work', 'open to opportunities',
  'seeking a position', 'seeking employment', 'available for hire', 'hire me',
];

// Service-OFFER phrasing ("I will find you a job / review your CV for a
// fee"), never "a recruiter posted one specific role" — a post naming a
// concrete title/company/requirements is a normal (and welcome) vacancy
// post even when it comes from a recruiter/agency, and must not match here.
const RECRUITER_SELF_PROMOTION_PHRASES = [
  'подберу вакансию', 'подберу вам работу', 'помогу с трудоустройством',
  'помогу найти работу', 'консультация по резюме', 'составлю резюме',
  'career coaching', 'resume review service', 'cv review service',
];

const AGENCY_PROMOTION_PHRASES = [
  'подбор персонала для вас', 'кадровое агентство приглашает',
  'рекрутинговое агентство предлагает', 'staffing agency', 'recruitment agency services',
  'аутстаффинг персонала', 'аутсорсинг персонала',
];

const COURSE_BOOTCAMP_KEYWORDS = [
  'курс по', 'онлайн-курс', 'онлайн курс', 'запись на курс', 'набор на курс', 'старт потока',
  'bootcamp', 'буткемп', 'обучающая программа', 'учебный курс',
  'online course', 'coding bootcamp', 'enroll now', 'записаться на курс',
];

const WEBINAR_EVENT_KEYWORDS = [
  'вебинар', 'webinar', 'мастер-класс', 'masterclass', 'воркшоп', 'workshop',
  'митап', 'meetup', 'конференция', 'conference', 'приглашаем на мероприятие',
  'регистрация на событие', 'register for the event',
];

const GIVEAWAY_KEYWORDS = [
  'розыгрыш', 'giveaway', 'конкурс репостов', 'участвуй и выиграй', 'разыгрываем',
  'win a prize', 'enter to win',
];

const CRYPTO_KEYWORDS = [
  'криптовалют', 'crypto', 'bitcoin', 'биткоин', 'ethereum', 'airdrop', 'nft', 'defi',
  'token sale', 'ico ', 'web3', 'blockchain investment',
];

const AFFILIATE_SPONSORSHIP_KEYWORDS = [
  'на правах рекламы', 'sponsored post', 'реферальная ссылка', 'referral link',
  'промокод', 'promo code', 'affiliate link', 'партнёрская ссылка',
];

const NEWSLETTER_NEWS_KEYWORDS = [
  'дайджест новостей', 'news digest', 'подпишитесь на канал', 'подписывайтесь на канал',
  'дайджест недели', 'weekly digest',
];

// Order matters: checked top-to-bottom, first match wins. Category-specific
// rules run ahead of nothing else here — isLikelyJobPost (the IT-relevance
// gate) is a separate, later check in runTelegramPrecheck.
const CATEGORY_RULES: readonly CategoryRule[] = [
  { ruleId: 'resume_candidate_seeking.first_person_phrase', category: 'resume_candidate_seeking', keywords: RESUME_CANDIDATE_SEEKING_PHRASES },
  { ruleId: 'recruiter_self_promotion.service_offer_phrase', category: 'recruiter_self_promotion', keywords: RECRUITER_SELF_PROMOTION_PHRASES },
  { ruleId: 'agency_promotion.service_offer_phrase', category: 'agency_promotion', keywords: AGENCY_PROMOTION_PHRASES },
  { ruleId: 'course_bootcamp.keyword', category: 'course_bootcamp', keywords: COURSE_BOOTCAMP_KEYWORDS },
  { ruleId: 'webinar_event.keyword', category: 'webinar_event', keywords: WEBINAR_EVENT_KEYWORDS },
  { ruleId: 'giveaway.keyword', category: 'giveaway', keywords: GIVEAWAY_KEYWORDS },
  { ruleId: 'crypto.keyword', category: 'crypto', keywords: CRYPTO_KEYWORDS },
  { ruleId: 'affiliate_sponsorship.keyword', category: 'affiliate_sponsorship', keywords: AFFILIATE_SPONSORSHIP_KEYWORDS },
  { ruleId: 'newsletter_news.keyword', category: 'newsletter_news', keywords: NEWSLETTER_NEWS_KEYWORDS },
];

/**
 * Deterministic, no-LLM classification of specific non-vacancy content
 * types (resumes, recruiter/agency self-promo, courses, webinars,
 * giveaways, crypto, affiliate/sponsorship, newsletters/news). Returns the
 * first matching rule, or null if none match — null does NOT mean "this is
 * a job post", only "none of these specific rejection categories fired".
 */
export function classifyDeterministicRejection(text: string): PrecheckRejection | null {
  if (!text) return null;
  const lower = text.toLowerCase();

  for (const rule of CATEGORY_RULES) {
    const matched = rule.keywords.find((k) => lower.includes(k));
    if (matched) {
      return { category: rule.category, ruleId: rule.ruleId, matchedText: matched };
    }
  }
  return null;
}

/**
 * Single entry point combining every deterministic (no-LLM) precheck stage,
 * in order: service-message/length → category rejection (courses, crypto,
 * candidate-seeking, etc.) → IT-relevance (isLikelyJobPost). Both
 * TelegramFetcher (V1 RawJob path) and SocialMessagePipeline (V2 AI
 * extraction gate) call this instead of isLikelyJobPost directly, so the
 * two never drift into checking different things.
 */
export function runTelegramPrecheck(text: string, options: { isServiceMessage?: boolean } = {}): PrecheckDecision {
  if (options.isServiceMessage) {
    return { accepted: false, category: 'service_message', ruleId: 'service_message', matchedText: '' };
  }
  if (!text || text.trim().length < 15) {
    return { accepted: false, category: 'too_short', ruleId: 'too_short', matchedText: text?.trim() ?? '' };
  }

  const categoryRejection = classifyDeterministicRejection(text);
  if (categoryRejection) {
    return { accepted: false, ...categoryRejection };
  }

  if (!isLikelyJobPost(text)) {
    return { accepted: false, category: 'not_it_relevant', ruleId: 'not_it_relevant', matchedText: '' };
  }

  return { accepted: true };
}
