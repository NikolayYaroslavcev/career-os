# CIS Vacancy Sources — Audit & Ranked Roadmap

> Generated 2026-07-23 · scope: Russian/CIS-relevant vacancy sources only · builds on `REPORT.md` (2026-07-21, 80+ sources) and current `packages/providers` implementation state
> Do not implement from this document without a follow-up decision — this is an audit + prioritization artifact only.

> **2026-07-23, later same day — audit note (documentation-consistency pass):**
> Three items this document treats as not-yet-built are now implemented in
> `packages/providers/src/providers/` (filesystem timestamps show they landed
> a few hours after this document was written, so this isn't an error in the
> document at the time — it's just been overtaken by fast-moving work since):
>
> - **Habr Career** (`habr-career/`) — this doc's §1 states it "doesn't
>   appear in `packages/providers/src/providers/`"; it now does (fetcher,
>   mapper, normalizer, provider, tests, XML fixture — 737 lines).
> - **SuperJob** (`superjob/`) — listed in §2 Tier 1 and §3 Phase 1 as the
>   recommended next build; now implemented (fetcher, mapper, normalizer,
>   provider, sync-strategy, tests, fixture — 1,399 lines).
> - **Telegram channel scraping** (`telegram/`) — listed in §2 Tier 2 and §3
>   Phase 1 as needing a new "HTML/t.me scraping" capability; a Telegram
>   provider now exists (fetcher, mapper, normalizer, provider, tests, HTML
>   fixture — 1,874 lines) — not confirmed here whether it covers the exact
>   `@remoteit` + sub-channel network this doc describes, but the scraping
>   capability class this doc flagged as missing now exists.
>
> §1's provider count ("19 providers are live") is also now stale — there
> are 23 provider directories on disk as of this note. The Phase 0/1
> recommendations below (§3) for SuperJob and Habr Career are **done**;
> Telegram-network-specific coverage should be re-verified against the new
> provider rather than re-scoped from scratch. Rest of this document is left
> as-written as a historical snapshot of the audit.

## 1. Where CareerOS actually stands today

19 providers are live in `packages/providers` (see `docs/JOB_PROVIDERS.md`). Of those, exactly **one** has meaningful CIS relevance:

| Provider | CIS relevance | Why |
|---|---|---|
| **HeadHunter (`hh`)** | ★★★★★ | Only source with native RU/CIS coverage. Anonymous REST access, salary/tech/remote fields, incremental sync. |
| Other 18 (RemoteOK, Adzuna, Greenhouse, Lever, Ashby, Workday, Teamtailor, SmartRecruiters, Recruitee, Comeet, Remotive, Himalayas, Arbeitnow, Jobicy, WWR, Working Nomads, NoDesk, HN Hiring, LinkedIn) | ★ or lower | Global/int'l remote boards and ATS aggregators. CIS jobs appear only incidentally (e.g. an int'l company that happens to hire in Russia/Georgia). |

**"Habr Career" was scoped in the original EPIC-06 (`TASK-06-03`) but was never built** — it doesn't appear in `packages/providers/src/providers/` or `docs/JOB_PROVIDERS.md`. It's also already reserved as a named provider ID (`habr_career`, priority-2 Job Board) in `ADR-030`'s provider-priority table, so the data model is ready for it whenever it ships.

### Quick win already sitting in the codebase, zero new code

`packages/shared/src/config.ts:126` — `HH_AREAS: z.string().default('113')` (Russia only). The comment on that line already documents `"113,40,16"` (Russia, Kazakhstan, Belarus) as a supported format, and the HH API covers Georgia, Uzbekistan, Azerbaijan, and Kyrgyzstan through the same endpoint with different area IDs. **Widening `HH_AREAS` is a config change, not an integration** — it multiplies CIS coverage from the one already-live source before any new provider work starts. Confirm exact area IDs for KZ/BY/UZ/AZ/KG against `https://api.hh.ru/areas` before setting (headhunter.ge in particular may be a separate deployment, not just another area ID under api.hh.ru — verify before assuming it's covered).

---

## 2. Audit table — CIS/Russian-relevant sources

Scored on the requested dimensions. "CIS relevance" is Russian-speaking-developer-focused per the original brief, so it includes strong diaspora markets (Israel, Baltics) alongside core CIS states.

### Tier 1 — Official APIs, low effort

| Source | API | RSS | Scraping | Auth | Est. volume | Complexity | CIS relevance |
|---|---|---|---|---|---|---|---|
| **HeadHunter** (hh.ru/kz/by/.ge presence) | REST, OpenAPI, anon + OAuth | No | Not needed | None required (token optional, raises limits) | HIGH — largest RU board | **Done** — expand `HH_AREAS` | ★★★★★ |
| **SuperJob** (superjob.ru) | REST, free API key | No | Not needed | API key (free registration) | HIGH — 2nd largest RU board | Low | ★★★★★ |
| **Trudvsem.ru** (Rabota Rossii, govt) | Open Data XML API | No | Not needed | None | MEDIUM, lower quality (govt postings skew non-tech) | Low | ★★★★ |

### Tier 2 — No official API, but structurally scrapeable / high value

| Source | API | RSS | Scraping | Auth | Est. volume | Complexity | CIS relevance |
|---|---|---|---|---|---|---|---|
| **Telegram Inflow network** (`@remoteit` + 10 sub-channels: gamedevjobs, cvflow, itmoscow, spboffice, nskoffice, jobfeeds, remotejun, job41c, goutstaff, fromlinked) | No official API | No | Yes — `t.me/s/{channel}` public preview pages, no auth, HTML but consistently structured (`ROLE \| LOCATION \| COMPANY #tags`) | None | 20-30 IT jobs/day across the network, 49K+ subscribers on main channel | Medium — HTML scraping + `teletype.in` link-following for full descriptions, but pages have been stable for years | ★★★★★ — single best non-API CIS source found |
| **Habr Career** (career.habr.com) | No public API | No | Yes, but JS-rendered (needs headless browser) | None | HIGH — best-quality dev-specific RU vacancies | Medium-High | ★★★★★ |
| **Djinni** (djinni.co) | No official API | No | Yes, JS-rendered | None | MEDIUM (Ukraine-centric but broadly CIS dev audience) | Medium-High | ★★★★ |
| **FL.ru** | No API | No | Yes, easy (session-based, static-ish) | None | 1,500+ freelance orders/day (not FT roles — separate "freelance" track) | Low | ★★★★★ |
| **Habr Freelance** (freelance.habr.com) | No API | No | Yes, easy | None | 3K+ freelance postings | Low | ★★★★★ |
| **Kwork** (kwork.ru) | No API | No | Yes, easy | None | 5K+ fixed-price gigs | Low | ★★★★★ |
| **Rabota.by** (Belarus) | No API | No | Yes, medium (SPA-ish) | None | MEDIUM | Medium | ★★★★ |
| **hh.kz / enbek.kz** (Kazakhstan) | hh.kz = same HH API; enbek.kz = govt, unclear API | No | enbek.kz likely scraping | None | MEDIUM | Very Low (hh.kz), Medium (enbek.kz) | ★★★★ |

### Tier 3 — High volume but hostile to automated access

| Source | API | RSS | Scraping | Auth | Est. volume | Complexity | CIS relevance |
|---|---|---|---|---|---|---|---|
| **Avito Rabota** | None | No | Technically possible, heavy anti-bot | None (but blocked in practice) | VERY HIGH | High — same class of problem the HH DDoS-Guard incident (`docs/hh-api-403-investigation.md`) already documented for a *cooperative* API; Avito has no cooperative path at all | ★★★★ (volume) but risk-adjusted low |
| **Zarplata.ru** | Unclear — old GitHub repos reference an API from 2017, unverified as still live | No | Medium | Unclear | HIGH claimed, LOW confidence | Medium (needs live verification first) | ★★★ |
| **Job.ru** | None found | No | Medium | None | HIGH claimed, LOW confidence | Medium | ★★ |

### Tier 4 — CIS diaspora markets (Russian-speaking population, not CIS territory)

| Source | API | RSS | Scraping | Auth | Est. volume | Complexity | CIS relevance |
|---|---|---|---|---|---|---|---|
| **CV-Online** (Lithuania/Latvia/Estonia, Alma Career network) | Partner API only | No | Hard without partner deal | OAuth2, requires business agreement | LT ~4.1K, LV ~2.2K, EE ~3.8K, IT-tagged subset smaller | Medium-High (needs a partner conversation, not just code) | ★★★★ — Baltic Russian-speaking minorities (up to ~25% in LV/EE), explicit RU-language filter on the Estonian site |
| **Poslovi Infostud** (Serbia) | No public API | **Yes** — RSS available | Moderate | None | 13,385+ postings (not all tech) | Low | ★★★★ — historically strong RU ties |
| **HR.ge** (Georgia) | None | No | Moderate | None | 3,653 listings | Medium | ★★★★ |
| **AllJobs / JobMaster** (Israel) | None | No | Moderate, RTL Hebrew handling required | None | AllJobs ~35K, JobMaster ~20K | Medium (Hebrew text pipeline is real added work) | ★★★★ — ~1M Russian-speaking immigrants, tech-heavy |

### Dead ends (confirmed, don't revisit without new evidence)

Careerist.com and VC.ru (content platforms, not job boards, negligible structured data) · Joblist.am / Teamly.am (Armenia — DNS failures, likely defunct).

---

## 3. Ranked roadmap

Ranking is CIS-impact-per-unit-effort, sequenced against what's already built.

### Phase 0 — Config only (do this first, ships same day)
1. **Widen `HH_AREAS`** to include Kazakhstan, Belarus, Uzbekistan, Azerbaijan, Kyrgyzstan area IDs (verify each against `api.hh.ru/areas` first). Zero new code, multiplies the one CIS source already in production.

### Phase 1 — Highest ROI new sources (official API, follows the exact `Fetcher/Mapper/Normalizer/SyncStrategy` pattern every existing provider uses)
2. **SuperJob** — free API key, same shape of integration as HH, second-largest RU board. Lowest-risk net-new provider.
3. **Telegram Inflow network** — no other single source matches its CIS-specificity-to-effort ratio (49K+ subscribers, 20-30 jobs/day, stable scraping target). This is a new *source type* for the codebase (HTML/t.me scraping rather than JSON API) — closer in shape to the HN Hiring provider's text-parsing than to a REST integration.
4. **Habr Career** — completes the original EPIC-06 scope (`TASK-06-03`, never built). Highest quality RU dev vacancies but needs a headless-browser fetcher, a new capability class for this codebase (every current provider is fetch()-based, none run a browser).

### Phase 2 — Freelance/project track (only if CareerOS decides to support freelance, not just FTE, listings — a product decision, not just a technical one)
5. **FL.ru**, **Habr Freelance**, **Kwork** — all easy scraping targets, all native RU, but represent a different vacancy *type* (freelance gigs) than the FTE-focused model `ADR-030` currently canonicalizes around. Flag for a product decision before building.

### Phase 3 — Diaspora extension (after core CIS is saturated)
6. **Poslovi Infostud (Serbia)** — has an RSS feed, lowest-effort of the diaspora tier.
7. **CV-Online Baltics** — gated behind an Alma Career partner conversation, not pure engineering; sequence this as a business-development task in parallel with engineering work, not after it.
8. **HR.ge**, **AllJobs/JobMaster (Israel)** — moderate scraping effort, real audience, but lower urgency than Phase 1/2.

### Explicitly deprioritized
- **Avito Rabota**: volume is real but the anti-bot posture is a strictly harder version of the problem already logged in `docs/hh-api-403-investigation.md` for a *cooperative* source. Don't attempt until Phase 1-3 are done and there's appetite for an adversarial-scraping investment (proxies, headless browser fleets, likely churn).
- **Zarplata.ru, Job.ru**: unverified/stale evidence. Needs a cheap verification spike (confirm the site and any API still exist) before it's worth ranking properly — don't build against a 2017 GitHub repo's assumptions.

---

## 4. One-line recommendation

Do Phase 0 today (it's a config change), then build **SuperJob** next — it's the only Phase 1 item that fits the existing REST-API provider pattern with no new architectural capability (no headless browser, no HTML scraping, no product-model question). Telegram and Habr Career are the right *next* moves after that, but each requires a capability the provider framework doesn't have yet (scraping/parsing, headless rendering) and should be scoped as its own small ADR before implementation.
