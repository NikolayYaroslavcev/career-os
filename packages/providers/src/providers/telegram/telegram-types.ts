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

export interface TelegramChannelConfig {
  /** Bare channel username, no `@` or `t.me/` prefix (e.g. "remoteit"). */
  readonly username: string;
}
