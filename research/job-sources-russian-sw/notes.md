## [turn 1 · 2026-07-21T22:15:00Z]
User requested a separate source type called "Company Watch" — a dedicated provider type for monitoring company career pages directly (as opposed to job board aggregators). This would involve:
- Maintaining a list of target companies
- Periodically checking their career pages (via ATS APIs, JSON-LD, or scraping)
- Tracking new/removed positions
- This is distinct from ATS aggregation (which covers many companies via one API) — Company Watch is per-company targeted monitoring

This concept should be designed as a first-class provider type in the platform architecture.
