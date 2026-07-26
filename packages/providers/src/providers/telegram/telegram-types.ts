// Public channel preview page (`https://t.me/s/<channel>`) shapes. Telegram
// has no public REST API for reading arbitrary public channels: the Bot API
// only delivers `channel_post` updates to bots that channel admins have
// explicitly added, and the MTProto client API (GramJS/Telethon) needs a
// logged-in user session — too heavy for a first ingestion pass. The `/s/`
// preview (Telegram's own SEO-indexable "instant view" of a public channel,
// no login required) is the same kind of unofficial-but-stable HTML surface
// HabrCareerFetcher/WWRFetcher already scrape for other CIS job sources, so
// this provider follows the same regex-extraction pattern rather than adding
// a headless browser or an HTML parsing library as a new dependency.

/** One `<div class="tgme_widget_message_wrap">` block parsed out of a channel preview page. */
export interface TelegramRawMessage {
  readonly channel: string;
  readonly messageId: string;
  /** Inner HTML of `.tgme_widget_message_text` — tags still present (links, `<br>`, hashtag spans). */
  readonly textHtml: string;
  /** Plain-text rendering of textHtml (tags stripped, entities decoded). */
  readonly text: string;
  readonly publishedAt: Date;
  /** `href` of every `<a>` inside the message text, in document order. */
  readonly links: readonly string[];
  /** True for Telegram's own service posts (channel created/photo updated/pinned) — never real vacancy content. */
  readonly isServiceMessage: boolean;
}

/** Rule-based extraction result pulled from a message's free text — no AI involved. */
export interface TelegramExtractedFields {
  readonly title: string;
  readonly companyName: string;
  readonly location: string;
  readonly remote: boolean;
  readonly salary?: {
    readonly from?: number;
    readonly to?: number;
    readonly currency: string;
  };
  readonly technologies: readonly string[];
  /** Best available link for a candidate to act on: explicit apply link > first external link > mailto: > t.me contact > the post's own URL. */
  readonly applyUrl: string;
  readonly emails: readonly string[];
  readonly telegramUsernames: readonly string[];
}

export interface TelegramChannelConfig {
  /** Bare channel username, no `@` or `t.me/` prefix (e.g. "remoteit"). */
  readonly username: string;
}
