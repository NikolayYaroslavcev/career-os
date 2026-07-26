# Telegram Channel Research — IT Vacancy Sources for CIS/RU Job Seekers

**Date:** 2026-07-23
**Author:** Research pass, research-only — no source, config, or `.env` files were modified.
**Scope:** Candidate public Telegram channels for CareerOS's Telegram provider, covering Frontend, Backend, Fullstack, JavaScript/TypeScript/React/Angular/Vue, Python, DevOps, QA, Data/AI, Remote IT, and CIS-company vacancies (RU, BY, KZ, UA, GE, AM, AZ, KG, UZ, TJ, MD).

## Methodology

1. **Discovery.** Used web search for queries such as "телеграм канал вакансии frontend разработчик", "телеграм канал вакансии python разработчик", "телеграм канал вакансии DevOps", "телеграм канал вакансии QA тестировщик", "телеграм канал вакансии Data Science AI Machine Learning", "телеграм канал IT вакансии Казахстан Беларусь удаленная работа", plus two curated round-up articles (potok.io "101 Telegram-канал..." and huntflow.media "75 телеграм-каналов...") which were fetched directly to extract lists of channel usernames.
2. **Verification.** For every candidate, fetched `https://t.me/s/<username>` directly (the same unauthenticated public-preview endpoint CareerOS's `telegram-fetcher.ts` uses — no bot token, no login). The fetch tool renders the page to text/markdown and I asked it to report: display name, subscriber count if visible, whether messages actually render, visible post timestamps, count of genuine vacancy posts vs. other content, language, and tech-stack relevance.
3. **No fabrication.** Every row below reflects an actual fetch of the stated URL on 2026-07-23. Where the preview didn't load messages, or a guessed username resolved to an unrelated/unexpected channel, that is stated explicitly rather than papered over.

### Known limitations (read before trusting the numbers)

- **Subscriber counts**: shown on most `/s/` channel headers, but **not** for channels that are actually Telegram *group chats* rather than broadcast *channels* — those instead show "members + N online," which is itself a strong signal that `/s/` preview will *not* render (group chats have no public preview; only channels do). I've flagged these explicitly as "preview blocked — appears to be a group chat, not a channel."
- **Exact calendar dates**: the `/s/` HTML embeds a full ISO timestamp in a `<time datetime="...">` attribute, but the rendered text most fetches surfaced to me was only the human-visible `HH:MM`. Where I could not confirm full calendar dates, "vacancies/day" below is an *approximation* inferred from context (post density, explicit day references in Russian like "23 июля"/"завтра"), not a precise count. Treat frequency estimates as directional, not exact.
- **Content judgment** (vacancy vs. not) was made by the fetch tool's summarization model reading rendered text, not by me inspecting raw HTML per post — spot-checked but not independently re-verified line by line. Borderline calls (e.g., candidate resumes mixed with vacancies, forwarded posts) are noted in "notes" columns.
- A few guessed usernames from search results **did not correspond to the channel I intended** (the handle exists but is a different, unrelated channel). These are marked "USERNAME MISMATCH" — they are not usable as replacements for the channel the search snippet described.

---

## 1. Already-integrated channels (baseline, for comparison)

Configured today via `TELEGRAM_CHANNELS` in `.env.example`: `remoteit, frontend_jobs, it_vacancy, jobforjunior`.

| username | display name | subscribers | preview works? | visible vacancy posts (of ~20) | est. vacancies/day | language | notes |
|---|---|---|---|---|---|---|---|
| `remoteit` | Remote IT (Inflow) | 49.3K | Y | ~18/19 | High (looks like several/day) | ru/en mixed | Broad: backend (Java/Python/Kotlin/Go/Rust/C#/Scala), Web3, gamedev QA. Healthy, active. |
| `frontend_jobs` | "Frontend Jobs" | 247 | **N — no messages rendered**, only channel metadata shown | 0/0 | Cannot assess | en (interface only) | Preview loaded but showed **no post content at all**, just the channel header. Worth a developer double-checking this is the intended/correct channel — very low subscriber count (247) is itself suspicious for a channel meant to be a primary vacancy source. |
| `it_vacancy` | "IT Vacancy" (@it_vacancy) | 21 | Technically loads, but **only shows channel-creation/photo-update service messages**, zero actual vacancy posts | 0/~3 (all admin/service messages) | None currently | en | Appears to be a near-dead or brand-new channel with 21 subscribers and no real vacancy content yet. Description mentions PHP/JS/HTML/Magento/WordPress but nothing posted. |
| `jobforjunior` | Job for Junior | 81.9K | Y | ~22/23 (~96%) | High | ru/en mixed | Very active, broad junior/entry-level roles across QA, DevOps, product, data, gamedev. Strongest of the 4 baseline channels. |

**Notable observation (reporting only, no action taken):** two of the four currently-configured channels (`frontend_jobs`, `it_vacancy`) rendered essentially no usable vacancy content in this pass — `frontend_jobs` showed zero messages and only 247 listed subscribers; `it_vacancy` showed only administrative service messages with 21 subscribers. This may mean the channels have gone quiet/were placeholders, or that these usernames don't match the channels the team originally intended. This is flagged for the developer's awareness only; per task scope, no config change was made.

---

## 2. HIGH PRIORITY — active, good vacancy density, scrapable

All rows below: preview loaded real content, vacancy-post ratio was roughly ≥65% of visible messages, and posting cadence looked frequent enough to survive a rolling ~20-message / 15-minute-sync window.

| username | display name | subscribers | tech relevance | language | preview works? | vacancy posts (of ~20) | est. vacancies/day | notes |
|---|---|---|---|---|---|---|---|---|
| `rabotafrontend` | FrontEnd Работа | 3.14K | Frontend, React, Angular, Vue, TS, .NET fullstack | ru (some en terms) | Y | ~13/16 (~81%) | Several/day | Reposts from talanto.work job board; entry-through-senior frontend roles. |
| `forfrontend` | Job for Frontend (JavaScript + Node.js) Developers | 13K | Frontend (React/Vue/Angular), Node.js backend, some AI/ML | ru/en mixed | Y | ~18/19 (~95%) | Several/day | Wide seniority range; also covers Node backend and infra (Docker/K8s/Kafka). |
| `golangjob` | Golang Jobs | 3.78K | Backend (Go) | ru/en mixed | Y | ~18/18 (~100%) | Several/day | Exclusively Golang backend; strong signal-to-noise. |
| `java_c_net_golang_jobs` | Вакансии .Net, Java, C#, C++ и Golang разработчиков | 9.22K | Backend (.NET/C#, Java, C++, Go) | ru (mixed en terms) | Y | ~16/20 (~80%) | Several/day | Includes named CIS employers (Sber, MTS, YADRO, Gaijin). |
| `job_python` | Python Job | Вакансии | Стажировки | 22.3K | Python/backend, AI/ML, data, QA (SDET) | ru (en tech terms) | Y | ~19-20/22 (~90%) | Several/day | Broad Python ecosystem coverage incl. internships. |
| `fordevops` | Job for Sysadmin & DevOps | 4.55K | DevOps, SRE, sysadmin, cloud/K8s | ru/en mixed | Y | ~19/20 (~95%) | Several/day | Very clean vacancy channel, minimal noise. |
| `jobforqa` | QA Вакансии / QaRocks | 14.3K | QA (manual, automation, SDET, ML/LLM testing) | ru (en terms) | Y | ~13/18 (~72%) | Several/day | Some safety-warning/webinar noise but majority genuine QA vacancies. |
| `ai_rabota` | AI Работа Вакансии DS/ML | 2.75K | Data/AI, ML, LLM/NLP, Python backend | ru (en tech terms) | Y | ~20/22 (~91%) | Several/day | Small subscriber base but very dense, near-pure vacancy feed. |
| `datasciencejobs` | Data Science Jobs | 21.3K | Data Science, ML, LLM, MLOps | ru/en mixed | Y | ~20/25 (~80%) | Several/day | Large, active, high-quality data/AI channel. |
| `data_science_job` | Вакансии data science и машинное обучение | 600 | Data Science, ML, data engineering | ru (some en) | Y | ~20/20 (100%) | Several/day | Small audience but every visible message was a genuine vacancy. |
| `geekjobs` | Job in IT&Digital (GeekJob project channel) | 48.8K | Broad: backend, iOS/mobile, data, QA, product/design | ru/en mixed | Y | ~15/16 (~94%) | Several/day | Large general IT channel, high signal. |
| `Relocats` | IT Relocation (Inflow) | 32.2K | Backend, DevOps, gamedev, ML/research, frontend/UI | en (mostly), ru description | Y | ~16-17/19 (~85%) | Several/day | Focused on relocation-friendly roles for RU/UA/CIS engineers — matches "CIS companies"/remote focus well. |
| `jobfortm` | Job for IT-TOP (Technical Managers) | 14.5K | Eng. leadership, backend, DevOps, QA, AI (tech-lead/CTO level) | ru/en mixed | Y | ~18/19 (~95%) | Several/day | More senior/management-skewed but still core tech domains. |
| `workitkz` | IT Вакансии Казахстан | 33.9K | Backend, frontend, mobile, DevOps, data/ML, infosec, sysadmin | ru | Y | ~20/20 (100%) | Several/day | Strongest CIS-regional (Kazakhstan) find — large, dense, on-topic. |
| `Getitrussia` | Get IT | 20.6K | Data analytics, QA, backend (.NET), business analysis, security | ru (en hashtags) | Y | ~16-18/20 (~85%) | Several/day | Notable CIS-region reach: postings referencing Uzbekistan and Kyrgyzstan roles specifically. |

---

## 3. MEDIUM PRIORITY — useful but lower density / mixed content / narrower reach

| username | display name | subscribers | tech relevance | language | preview works? | vacancy posts (of ~20) | est. vacancies/day | notes |
|---|---|---|---|---|---|---|---|---|
| `godevjob` | Go jobs — вакансии по Go | 10.9K | Backend (Go) | ru | Y | ~7/15 (~47%) | ~Daily but noisy | Roughly half the feed is course/webinar promotion rather than vacancies. |
| `pydevjob` | Python jobs — вакансии по питону, Django, Flask | 9.47K | Python/Django/Flask backend | ru | Y | ~10/18 (~55%) | ~Daily but noisy | Named CIS employers (Avito, Тензор, Doubletapp) but ~45% promotional/educational filler. |
| `testerrjob` | Вакансии по QA — тестирование, manual testing, autotests | 7.75K | QA (manual, automation, API/UI) | ru (en terms) | Y | ~12/20 (~60%) | Daily-ish | FinTech/banking-heavy; sizable share of course-promo content. |
| `datajob` | Data jobs — вакансии по data science, аналитике, ИИ | 14.3K | Data Science, analytics, data engineering, AI | ru | Y | ~8/15 (~53%) | Daily-ish | Legit named employers but ~half the feed is Proglib Academy course promotion. |
| `devops_jobs_feed` | Devops Jobs — вакансии и резюме | 21.2K | DevOps, SRE, DevSecOps, cloud | ru/en mixed | Y | ~9/17 (~53%, and roughly half of those are candidate resumes, not employer postings) | Daily-ish | Two-way board (companies AND candidates post) — lower employer-vacancy density than the name suggests. |
| `it_vac` | IT Jobs \| вакансии, фриланс | 8.6K | Nominally broad IT/freelance | ru | Y | ~8-10/25 (~35%) | Uncertain | **Caution:** roughly half the visible feed looked like low-quality "easy money"/survey-for-pay style posts rather than real vacancies — quality risk if ingested unfiltered. |

---

## 4. LOW PRIORITY — inactive, preview broken, not IT-relevant, or username mismatch

| username | display name (as found) | subscribers | preview works? | issue |
|---|---|---|---|---|
| `front_end_dev` | FrontEndDev | 26.3K | Y | Zero vacancy posts — it's a frontend **news/tutorial** channel (CSS, React, TS articles), not a job board. |
| `forwebdev` | For Web — фронтенд, дизайн, программирование | 13.3K | Y | Zero vacancy posts — tutorials/tools/articles only. |
| `javascript_jobs` | "JavaScript Jobs — чат" | 27.2K members, 7.3K online | **N — appears to be a group chat, not a broadcast channel**; `/s/` preview shows only header, no messages. |
| `sysadmin_rabota` | Вакансии Системный Администратор, DevOps | 3.6K members | **N — same group-chat pattern**, no messages rendered. |
| `qa_jobs` | "QA — вакансии" | 58.2K members, 16.2K online | **N — group chat**, no messages rendered; description points to a separate `@qa_ru` chat and `@qa_resumes` channel instead. |
| `jobs_it` | 💻☕️ Jobs_IT | 10.6K members, 1.4K online | **N — group chat**, no messages rendered. |
| `myjobit` | Telegram IT Job | 17.9K members, 5.4K online | **N — group chat**, no messages rendered. |
| `fordev` | Вакансии Backend/Frontend | 15.4K members, 4.1K online | **N — group chat**, no messages rendered. |
| `mobile_jobs` | Mobile Dev Jobs — вакансии и резюме | 20.4K members, 6.5K online | **N — group chat**, no messages rendered. (Kept for completeness; mobile isn't a listed focus area anyway.) |
| `ru_pythonjobs` | Вакансии для Python-разработчиков / Python Jobs | 10.2K | Technically loads | Channel explicitly states via pinned message that **it no longer accepts or publishes vacancies** — inactive as a job source despite subscriber count. |
| `vacancykz` | Вакансии KZ | 344 | Y | Only ~3-4 of ~20 visible posts are IT-related; the rest are general labor-market jobs (couriers, seamstresses, call-center). Not IT-vacancy-dense enough to justify inclusion. |
| `remowork_ru` | — | — | **USERNAME MISMATCH**: this handle resolved to an unrelated general-tech channel ("KHARON by Turing / канал для программистов"), a news/education channel with zero vacancies — not the "remote work vacancies" channel referenced in search results. Do not use this username as a substitute. |
| `tprogers` | — | — | **USERNAME MISMATCH**: resolved to "Типичные айтишники \| Чат об IT," an unrelated small IT chat (812 members), not the tech-news channel implied by search snippets. Preview also didn't render messages (group-chat pattern). |

---

## Recommendations

**This section is a recommendation only — no `.env`, config, or source changes were made as part of this research task.**

Based on verified vacancy density, posting frequency, scrapability (preview actually renders content), and relevance to CareerOS's target tech stack/regions, the following HIGH PRIORITY channels look like the strongest candidates for a developer to manually evaluate and add to `TELEGRAM_CHANNELS`:

- **Broad/general, largest reach:** `geekjobs`, `Relocats`, `workitkz`, `Getitrussia`
- **Frontend-specific:** `rabotafrontend`, `forfrontend`
- **Backend-specific:** `golangjob`, `java_c_net_golang_jobs`
- **Python-specific:** `job_python`
- **DevOps-specific:** `fordevops`
- **QA-specific:** `jobforqa`
- **Data/AI-specific:** `datasciencejobs`, `ai_rabota`, `data_science_job` (smallest audience of the three but cleanest signal)
- **Engineering-management-adjacent (optional):** `jobfortm`

Suggested next steps for whoever picks this up (not performed here):
1. Spot-check 2-3 of these manually in a real Telegram client to confirm ongoing activity beyond this single snapshot (channels can go quiet or get sold).
2. Re-verify `frontend_jobs` and `it_vacancy` in the current baseline — both rendered essentially no vacancy content in this pass and may need replacing or investigating.
3. If channel volume grows, consider adding a simple keyword/heuristic filter for promotional/course-advertisement posts, since several otherwise-good channels (e.g. `godevjob`, `pydevjob`, `datajob`, `devops_jobs_feed`) mix ~40-50% non-vacancy promotional content into their feed.
4. Avoid channels marked "group chat" above (`javascript_jobs`, `qa_jobs`, `mobile_jobs`, etc.) — the `/s/` public-preview endpoint CareerOS relies on only works for broadcast channels, not group chats, regardless of how good their content might be inside Telegram itself.
