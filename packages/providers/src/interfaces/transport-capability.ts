/**
 * How a SocialMessageTransport moves data — the axis the registry dispatches
 * on (see registry/social-message-transport-registry.ts), independent of any
 * specific platform. A provider can register several transports covering
 * different capabilities (e.g. Telegram: PULL via HTML preview, API via Bot
 * API, STREAM via MTProto); callers ask for a capability, never a platform.
 */
export type TransportCapability =
  | 'PULL' // polls/scrapes on an interval — Telegram HTML preview, RSS
  | 'PUSH' // receives events pushed to us — webhooks, Bot API updates
  | 'API' // authenticated request/response API — Bot API, REST, Slack Web API
  | 'BROWSER' // requires a real browser session/session cookies
  | 'FILE' // reads from an export/dump file
  | 'STREAM'; // long-lived persistent connection — MTProto, Discord Gateway
